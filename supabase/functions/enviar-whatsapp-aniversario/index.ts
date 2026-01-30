import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuração padrão Z-API
const ZAPI_DEFAULT_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_DEFAULT_TOKEN = "8FBCD627DCF04CA3F24CD5EC";

/**
 * Constrói URL da Z-API
 */
function buildZApiUrl(instanceId: string, token: string, endpoint: string): string {
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
}

/**
 * Chama Z-API
 */
async function callZApi(
  instanceId: string, 
  token: string, 
  endpoint: string, 
  payload: any
): Promise<{ ok: boolean; body: any; error?: string }> {
  const url = buildZApiUrl(instanceId, token, endpoint);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": token
      },
      body: JSON.stringify(payload)
    });
    
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    
    if (!response.ok) {
      return { ok: false, body, error: body?.error || `HTTP ${response.status}` };
    }
    
    return { ok: true, body };
  } catch (error: any) {
    return { ok: false, body: null, error: error.message };
  }
}

/**
 * Simula digitação antes de enviar
 */
async function simulateTyping(
  instanceId: string, 
  token: string, 
  phone: string, 
  messageLength: number
): Promise<void> {
  try {
    const typingTimeMs = Math.min(Math.max(messageLength * 50, 2000), 8000);
    
    await callZApi(instanceId, token, 'send-typing', { phone, value: true });
    await new Promise(resolve => setTimeout(resolve, typingTimeMs));
    await callZApi(instanceId, token, 'send-typing', { phone, value: false });
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.warn("Erro ao simular digitação:", error);
  }
}

/**
 * Normaliza número de telefone
 */
function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[987]/.test(numero)) {
      digits = ddd + "9" + numero;
    }
  }
  
  return "55" + digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO ENVIO ANIVERSÁRIOS VIA Z-API ===');

    const requestData = await req.json();
    const {
      telefones = [],
      mensagem = "",
      instanceName = "",
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
      teste = false
    } = requestData;

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let aniversariantes: any[] = [];
    let messageTemplate = "";
    let instanceId = ZAPI_DEFAULT_INSTANCE_ID;
    let token = ZAPI_DEFAULT_TOKEN;

    if (teste && telefones.length > 0) {
      console.log('=== MODO TESTE ===');
      aniversariantes = telefones;
      messageTemplate = mensagem;
    } else {
      console.log('=== MODO AUTOMÁTICO ===');
      
      // Buscar configurações
      const { data: configs } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'whatsapp_instancia_aniversario',
          'whatsapp_mensagem_aniversario', 
          'whatsapp_aniversario_ativo'
        ]);

      const configMap = new Map(configs?.map(c => [c.chave, c.valor]) || []);
      
      const finalInstanceName = configMap.get('whatsapp_instancia_aniversario') || '';
      messageTemplate = configMap.get('whatsapp_mensagem_aniversario') || '';
      const isActive = configMap.get('whatsapp_aniversario_ativo') === 'true';

      if (!isActive) {
        return new Response(JSON.stringify({ 
          success: false, message: 'Envio desativado' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Buscar instância
      if (finalInstanceName) {
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('instance_name', finalInstanceName)
          .eq('active', true)
          .single();

        if (instance) {
          instanceId = instance.instance_id || instanceId;
          token = instance.instance_token || token;
        }
      }

      // Buscar aniversariantes de hoje
      const today = new Date().toISOString().slice(5, 10);
      
      const { data: aniversariantesHoje } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .like('data_nascimento', `%-${today}`);

      aniversariantes = aniversariantesHoje || [];
    }

    if (!messageTemplate) {
      throw new Error('Mensagem não configurada');
    }

    if (aniversariantes.length === 0) {
      console.log('Nenhum aniversariante encontrado');
      
      if (!teste) {
        await supabase.from('logs_aniversario').insert({
          quantidade: 0,
          success: true,
          aniversariantes: [],
          data_envio: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({ 
        success: false, message: 'Nenhum aniversariante', total: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📱 ${aniversariantes.length} aniversariantes para processar`);

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // Processar aniversariantes
    for (let i = 0; i < aniversariantes.length; i++) {
      const aniversariante = aniversariantes[i];
      const normalizedPhone = normalizePhone(aniversariante.telefone);
      
      console.log(`\n🎂 [${i + 1}/${aniversariantes.length}] ${aniversariante.nome}`);
      
      // Delay entre envios
      if (i > 0) {
        const delaySeconds = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
        const delayMs = Math.round(delaySeconds * 1000);
        console.log(`⏳ Aguardando ${(delayMs/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        // Personalizar mensagem
        const mensagemPersonalizada = messageTemplate
          .replace(/{nome}/gi, aniversariante.nome)
          .replace(/{NOME}/g, aniversariante.nome.toUpperCase());

        // Enviar mídias se houver
        if (mediaFiles && mediaFiles.length > 0) {
          for (let mi = 0; mi < mediaFiles.length; mi++) {
            const media = mediaFiles[mi];
            if (mi > 0) await new Promise(r => setTimeout(r, 1000));
            
            let endpoint = 'send-image';
            let payload: any = { phone: normalizedPhone };
            
            const mimeType = media.mimetype || '';
            if (mimeType.startsWith('video/')) {
              endpoint = 'send-video';
              payload.video = media.data;
            } else if (mimeType.startsWith('audio/')) {
              endpoint = 'send-audio';
              payload.audio = media.data;
            } else {
              payload.image = media.data;
            }
            
            if (mi === 0) payload.caption = mensagemPersonalizada;
            
            await callZApi(instanceId, token, endpoint, payload);
          }
        } else {
          // Simular digitação e enviar texto
          await simulateTyping(instanceId, token, normalizedPhone, mensagemPersonalizada.length);
          
          const resp = await callZApi(instanceId, token, 'send-text', {
            phone: normalizedPhone,
            message: mensagemPersonalizada
          });

          if (!resp.ok) {
            throw new Error(resp.error || 'Erro no envio');
          }
        }

        console.log('✅ Enviado com sucesso');
        successCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: aniversariante.telefone,
          status: 'sucesso'
        });

      } catch (error: any) {
        console.error(`❌ Erro: ${error.message}`);
        errorCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: aniversariante.telefone,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`\n🎉 Concluído: ${successCount} sucessos, ${errorCount} erros`);

    // Log do envio
    if (!teste) {
      await supabase.from('logs_aniversario').insert({
        quantidade: aniversariantes.length,
        success: errorCount === 0,
        aniversariantes: results,
        data_envio: new Date().toISOString(),
        error_message: errorCount > 0 ? `${errorCount} erros` : null,
        teste: false
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Envio concluído',
      total: aniversariantes.length,
      sucessos: successCount,
      erros: errorCount,
      resultados: results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
