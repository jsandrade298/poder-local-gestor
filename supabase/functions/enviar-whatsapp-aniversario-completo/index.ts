import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[987]/.test(numero)) digits = ddd + "9" + numero;
  }
  return "55" + digits;
}

function calcularDelayTyping(mensagem: string): number {
  return Math.min(Math.max(Math.ceil(mensagem.length / 50), 2), 50);
}

async function callZApi(
  instanceId: string, token: string, clientToken: string,
  endpoint: string, payload: any
): Promise<{ ok: boolean; body: any; error?: string }> {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(payload)
    });
    
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    
    if (!response.ok) {
      return { ok: false, body, error: body?.error || body?.message || `HTTP ${response.status}` };
    }
    return { ok: true, body };
  } catch (error: any) {
    return { ok: false, body: null, error: error.message };
  }
}

function detectMediaType(media: any): string {
  const mimeType = media.mimetype || media.type || '';
  const filename = (media.filename || media.fileName || '').toLowerCase();
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/.test(filename)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|avi|mov|webm)$/.test(filename)) return 'video';
  if (mimeType.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|opus)$/.test(filename)) return 'audio';
  return 'document';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ENVIO ANIVERSÁRIOS COMPLETO (MULTI-TENANT) ===');

    const requestData = await req.json();
    const {
      telefones = [],
      mensagem = "",
      instanceName = "",
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
      teste = false,
      tenant_id: tenantIdParam = null,
    } = requestData;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // MULTI-TENANT: Se não veio tenant_id, processar todos os tenants
    if (!tenantIdParam && !teste) {
      console.log('🏢 Modo CRON: processando todos os tenants ativos...');
      
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, nome')
        .eq('ativo', true);

      if (!tenants || tenants.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, message: 'Nenhum tenant ativo' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const resultadosPorTenant: any[] = [];

      for (const tenant of tenants) {
        console.log(`\n🏢 Processando tenant: ${tenant.nome}`);
        
        const { data, error } = await supabase.functions.invoke('enviar-whatsapp-aniversario-completo', {
          body: { ...requestData, tenant_id: tenant.id }
        });

        resultadosPorTenant.push({
          tenant: tenant.nome,
          resultado: data || { error: error?.message }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Processamento multi-tenant concluído',
        tenants: resultadosPorTenant
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenantId = tenantIdParam;

    let aniversariantes: any[] = [];
    let messageTemplate = "";
    let finalInstanceName = instanceName;
    let finalTempoMinimo = tempoMinimo;
    let finalTempoMaximo = tempoMaximo;

    if (teste && telefones.length > 0) {
      console.log('=== MODO TESTE ===');
      aniversariantes = telefones;
      messageTemplate = mensagem;
    } else {
      const configQuery = supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'whatsapp_instancia_aniversario',
          'whatsapp_mensagem_aniversario', 
          'whatsapp_aniversario_ativo',
          'whatsapp_tempo_minimo_aniversario',
          'whatsapp_tempo_maximo_aniversario'
        ]);

      if (tenantId) configQuery.eq('tenant_id', tenantId);

      const { data: configs } = await configQuery;
      const configMap = new Map(configs?.map(c => [c.chave, c.valor]) || []);
      
      finalInstanceName = configMap.get('whatsapp_instancia_aniversario') || '';
      messageTemplate = configMap.get('whatsapp_mensagem_aniversario') || '';
      const isActive = configMap.get('whatsapp_aniversario_ativo') === 'true';
      finalTempoMinimo = parseInt(configMap.get('whatsapp_tempo_minimo_aniversario') || '1') || 1;
      finalTempoMaximo = parseInt(configMap.get('whatsapp_tempo_maximo_aniversario') || '3') || 3;

      if (!isActive) {
        return new Response(JSON.stringify({ 
          success: false, message: 'Envio desativado' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!finalInstanceName || !messageTemplate) {
        throw new Error('Configurações incompletas');
      }

      const today = new Date().toISOString().slice(5, 10);
      
      const municipeQuery = supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .like('data_nascimento', `%-${today}`);

      if (tenantId) municipeQuery.eq('tenant_id', tenantId);

      const { data: aniversariantesHoje } = await municipeQuery;
      aniversariantes = aniversariantesHoje || [];
    }

    if (!messageTemplate) throw new Error('Mensagem não configurada');

    if (aniversariantes.length === 0) {
      if (!teste) {
        await supabase.from('logs_aniversario').insert({
          quantidade: 0, success: true, aniversariantes: [],
          data_envio: new Date().toISOString(),
          tenant_id: tenantId
        });
      }
      return new Response(JSON.stringify({ 
        success: false, message: 'Nenhum aniversariante', total: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`🎂 ${aniversariantes.length} aniversariantes`);

    // Buscar credenciais Z-API (SEM FALLBACK HARDCODED)
    const instanceQuery = supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', finalInstanceName)
      .eq('active', true);

    if (tenantId) instanceQuery.eq('tenant_id', tenantId);

    const { data: instance } = await instanceQuery.maybeSingle();

    if (!instance?.instance_id || !instance?.instance_token || !instance?.client_token) {
      throw new Error(`Instância '${finalInstanceName}' não encontrada ou credenciais incompletas.`);
    }

    const instanceId = instance.instance_id;
    const zapiToken = instance.instance_token;
    const clientToken = instance.client_token;

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (let i = 0; i < aniversariantes.length; i++) {
      const aniversariante = aniversariantes[i];
      const phone = normalizePhone(aniversariante.telefone);
      
      if (i > 0) {
        const delayMs = Math.round((Math.random() * (finalTempoMaximo - finalTempoMinimo) + finalTempoMinimo) * 1000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const mensagemPersonalizada = messageTemplate
          .replace(/{nome}/gi, aniversariante.nome || '')
          .replace(/{primeiro_nome}/gi, (aniversariante.nome || '').split(' ')[0])
          .replace(/{NOME}/g, (aniversariante.nome || '').toUpperCase());

        const mensagemFinal = teste ? `[TESTE] ${mensagemPersonalizada}` : mensagemPersonalizada;

        let sent = false;

        if (mediaFiles && mediaFiles.length > 0) {
          for (let mi = 0; mi < mediaFiles.length; mi++) {
            const media = mediaFiles[mi];
            if (mi > 0) await new Promise(r => setTimeout(r, 1000));
            
            const mediaType = detectMediaType(media);
            const mediaUrl = media.data 
              ? `data:${media.mimetype || 'application/octet-stream'};base64,${media.data}` 
              : (media.url || '');
            
            let resp: any;
            
            if (mediaType === 'image') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-image', { 
                phone, image: mediaUrl, caption: !sent ? mensagemFinal : '' 
              });
              if (resp.ok) sent = true;
            } else if (mediaType === 'video') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-video', { 
                phone, video: mediaUrl, caption: !sent ? mensagemFinal : '' 
              });
              if (resp.ok) sent = true;
            } else if (mediaType === 'audio') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-audio', { phone, audio: mediaUrl });
            } else {
              resp = await callZApi(instanceId, zapiToken, clientToken, `send-document/${(media.filename || 'documento.pdf').split('.').pop()?.toLowerCase() || 'pdf'}`, { 
                phone, document: mediaUrl, fileName: media.filename || 'documento' 
              });
            }
          }
        }

        if (!sent && mensagemFinal) {
          const resp = await callZApi(instanceId, zapiToken, clientToken, 'send-text', {
            phone, message: mensagemFinal, delayTyping: calcularDelayTyping(mensagemFinal)
          });
          if (!resp.ok) throw new Error(resp.error || 'Erro no envio');
        }

        successCount++;
        results.push({ nome: aniversariante.nome, telefone: aniversariante.telefone, status: 'sucesso' });
      } catch (error: any) {
        errorCount++;
        results.push({ nome: aniversariante.nome, telefone: aniversariante.telefone, status: 'erro', erro: error.message });
      }
    }

    if (!teste) {
      await supabase.from('logs_aniversario').insert({
        quantidade: aniversariantes.length, success: errorCount === 0,
        aniversariantes: results, data_envio: new Date().toISOString(),
        error_message: errorCount > 0 ? `${errorCount} erros` : null,
        teste: false, tenant_id: tenantId
      });
    }

    if (tenantId && successCount > 0) {
      const mesAtual = new Date().toISOString().substring(0, 7) + '-01';
      await supabase.rpc('increment_whatsapp_usage', {
        p_tenant_id: tenantId, p_mes: mesAtual, p_envios: successCount
      });
    }

    return new Response(JSON.stringify({
      success: true, total: aniversariantes.length,
      sucessos: successCount, erros: errorCount, resultados: results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('💥 Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
