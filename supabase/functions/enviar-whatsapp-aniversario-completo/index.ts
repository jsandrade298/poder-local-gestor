import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais Z-API padrão (fallback se não estiverem no banco)
const ZAPI_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_TOKEN = "8FBCD627DCF04CA3F24CD5EC";
const ZAPI_CLIENT_TOKEN = "F1c345cff72034ecbbcbe4e942ade925bS";

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
    console.log(`🔄 Z-API: ${endpoint}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(payload)
    });
    
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    
    console.log(`📡 Z-API Response: ${response.status}`);
    
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
    console.log('=== INICIANDO ENVIO ANIVERSÁRIOS (Z-API) ===');

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

    console.log('Dados recebidos:', { 
      telefones: telefones.length, 
      instanceName, 
      teste, 
      mediaFiles: mediaFiles.length 
    });

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let aniversariantes: any[] = [];
    let messageTemplate = "";
    let finalInstanceName = instanceName;
    let finalTempoMinimo = tempoMinimo;
    let finalTempoMaximo = tempoMaximo;

    if (teste && telefones.length > 0) {
      console.log('=== MODO TESTE ATIVADO ===');
      aniversariantes = telefones;
      messageTemplate = mensagem;
    } else {
      console.log('=== MODO AUTOMÁTICO ===');
      
      const { data: configs } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'whatsapp_instancia_aniversario',
          'whatsapp_mensagem_aniversario', 
          'whatsapp_aniversario_ativo',
          'whatsapp_tempo_minimo_aniversario',
          'whatsapp_tempo_maximo_aniversario'
        ]);

      const configMap = new Map(configs?.map(c => [c.chave, c.valor]) || []);
      
      finalInstanceName = configMap.get('whatsapp_instancia_aniversario') || '';
      messageTemplate = configMap.get('whatsapp_mensagem_aniversario') || '';
      const isActive = configMap.get('whatsapp_aniversario_ativo') === 'true';
      finalTempoMinimo = parseInt(configMap.get('whatsapp_tempo_minimo_aniversario') || '1') || 1;
      finalTempoMaximo = parseInt(configMap.get('whatsapp_tempo_maximo_aniversario') || '3') || 3;

      console.log('Configurações carregadas:', { instanceName: finalInstanceName, isActive });

      if (!isActive) {
        console.log('Envio de aniversários desativado');
        return new Response(JSON.stringify({ 
          success: false,
          message: 'Envio desativado' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!finalInstanceName || !messageTemplate) {
        throw new Error('Configurações incompletas');
      }

      // Buscar aniversariantes de hoje
      const today = new Date().toISOString().slice(5, 10); // MM-DD
      
      const { data: aniversariantesHoje } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .like('data_nascimento', `%-${today}`);

      aniversariantes = aniversariantesHoje || [];
    }

    if (!finalInstanceName) {
      throw new Error('Nome da instância não informado');
    }

    if (!messageTemplate) {
      throw new Error('Mensagem não informada');
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
        success: false,
        message: 'Nenhum aniversariante encontrado',
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Encontrados ${aniversariantes.length} aniversariantes para processamento`);

    // ========== BUSCAR CREDENCIAIS Z-API DA INSTÂNCIA ==========
    let instanceId = ZAPI_INSTANCE_ID;
    let zapiToken = ZAPI_TOKEN;
    let clientToken = ZAPI_CLIENT_TOKEN;

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', finalInstanceName)
      .eq('active', true)
      .maybeSingle();

    if (instance) {
      instanceId = instance.instance_id || instanceId;
      zapiToken = instance.instance_token || zapiToken;
      clientToken = instance.client_token || clientToken;
      console.log(`✅ Instância encontrada: ${instance.display_name}`);
    } else {
      console.log(`⚠️ Instância '${finalInstanceName}' não encontrada no banco, usando credenciais padrão Z-API`);
    }

    console.log(`🔗 Z-API Instance ID: ${instanceId.substring(0, 8)}...`);

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // ========== PROCESSAR ANIVERSARIANTES ==========
    for (let i = 0; i < aniversariantes.length; i++) {
      const aniversariante = aniversariantes[i];
      const telefoneContato = aniversariante.telefone;
      const phone = normalizePhone(telefoneContato);
      
      console.log(`\n🎂 [${i + 1}/${aniversariantes.length}] Processando: ${aniversariante.nome} (${phone})`);
      
      // Delay entre envios (exceto no primeiro)
      if (i > 0) {
        const delaySeconds = Math.random() * (finalTempoMaximo - finalTempoMinimo) + finalTempoMinimo;
        const delayMs = Math.round(delaySeconds * 1000);
        console.log(`⏳ Aguardando ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        // Personalizar mensagem
        const mensagemPersonalizada = messageTemplate
          .replace(/{nome}/gi, aniversariante.nome || '')
          .replace(/{primeiro_nome}/gi, (aniversariante.nome || '').split(' ')[0])
          .replace(/{NOME}/gi, (aniversariante.nome || '').toUpperCase());

        // Prefixar com [TESTE] se for teste
        const mensagemFinal = teste ? `[TESTE] ${mensagemPersonalizada}` : mensagemPersonalizada;

        console.log(`💬 Mensagem: "${mensagemFinal.substring(0, 80)}${mensagemFinal.length > 80 ? '...' : ''}"`);

        let sent = false;

        // 1) Enviar mídias se houver
        if (mediaFiles && mediaFiles.length > 0) {
          console.log(`📎 Enviando ${mediaFiles.length} arquivo(s) de mídia`);
          
          for (let mediaIndex = 0; mediaIndex < mediaFiles.length; mediaIndex++) {
            const media = mediaFiles[mediaIndex];
            
            if (mediaIndex > 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
            
            const mediaType = detectMediaType(media);
            // Suporte a base64 (frontend envia como data) e URLs
            const mediaUrl = media.data 
              ? `data:${media.mimetype || 'application/octet-stream'};base64,${media.data}` 
              : (media.url || '');
            
            console.log(`📎 Enviando mídia ${mediaType} (${mediaIndex + 1}/${mediaFiles.length})`);
            
            let resp: any;
            
            if (mediaType === 'image') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-image', { 
                phone, 
                image: mediaUrl, 
                caption: !sent ? mensagemFinal : '' 
              });
              if (resp.ok) sent = true;
            } else if (mediaType === 'video') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-video', { 
                phone, 
                video: mediaUrl, 
                caption: !sent ? mensagemFinal : '' 
              });
              if (resp.ok) sent = true;
            } else if (mediaType === 'audio') {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-audio', { 
                phone, 
                audio: mediaUrl 
              });
            } else {
              resp = await callZApi(instanceId, zapiToken, clientToken, 'send-document/pdf', { 
                phone, 
                document: mediaUrl, 
                fileName: media.filename || 'documento' 
              });
            }
            
            if (!resp.ok) {
              console.error(`❌ Erro ao enviar mídia ${mediaIndex + 1}: ${resp.error}`);
            } else {
              console.log(`✅ Mídia ${mediaIndex + 1} enviada`);
            }
          }
        }

        // 2) Enviar texto se não foi enviado como caption de mídia
        if (!sent && mensagemFinal) {
          const resp = await callZApi(instanceId, zapiToken, clientToken, 'send-text', { 
            phone, 
            message: mensagemFinal, 
            delayTyping: calcularDelayTyping(mensagemFinal) 
          });
          
          if (!resp.ok) {
            throw new Error(resp.error || 'Erro ao enviar mensagem');
          }
        }

        console.log('✅ Mensagem de aniversário enviada com sucesso');
        successCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: telefoneContato,
          status: 'sucesso'
        });

      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${aniversariante.nome}:`, error.message);
        errorCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: telefoneContato,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`\n🎉 Envio de aniversários concluído: ${successCount} sucessos, ${errorCount} erros`);

    // Log do envio (apenas no modo automático)
    if (!teste) {
      await supabase.from('logs_aniversario').insert({
        quantidade: aniversariantes.length,
        success: errorCount === 0,
        aniversariantes: results,
        data_envio: new Date().toISOString(),
        error_message: errorCount > 0 ? `${errorCount} erros de envio` : null,
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
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro no envio de aniversários:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
