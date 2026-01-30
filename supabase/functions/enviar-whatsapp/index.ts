import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Configuração padrão Z-API (pode ser sobrescrita pela tabela whatsapp_instances)
const ZAPI_DEFAULT_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_DEFAULT_TOKEN = "8FBCD627DCF04CA3F24CD5EC";

/**
 * Normaliza número de telefone brasileiro para formato Z-API
 * Formato esperado: 5511999999999 (DDI + DDD + número com 9)
 */
function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  
  // Remove código do país se presente
  if (digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  
  // Adiciona 9 para celular se necessário (números de 10 dígitos começando com 9, 8 ou 7)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[987]/.test(numero)) {
      digits = ddd + "9" + numero;
    }
  }
  
  // Retorna com DDI 55
  return "55" + digits;
}

/**
 * Constrói URL da Z-API
 */
function buildZApiUrl(instanceId: string, token: string, endpoint: string): string {
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
}

/**
 * Chama endpoint da Z-API
 */
async function callZApi(
  instanceId: string, 
  token: string, 
  endpoint: string, 
  payload: any,
  method: "GET" | "POST" = "POST"
): Promise<{ ok: boolean; status: number; body: any; error?: string }> {
  const url = buildZApiUrl(instanceId, token, endpoint);
  
  try {
    console.log(`🔄 Z-API ${method}: ${endpoint}`);
    
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Client-Token": token
      }
    };
    
    if (method === "POST" && payload) {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(url, options);
    const text = await response.text();
    let body: any = text;
    
    try {
      body = JSON.parse(text);
    } catch {
      // Mantém como texto
    }
    
    console.log(`📡 Z-API Response: ${response.status}`);
    
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        error: body?.error || body?.message || `HTTP ${response.status}`
      };
    }
    
    return { ok: true, status: response.status, body };
    
  } catch (error: any) {
    console.error("❌ Erro Z-API:", error);
    return {
      ok: false,
      status: 500,
      body: null,
      error: error.message || 'Erro desconhecido'
    };
  }
}

/**
 * Simula digitação antes de enviar (humanização)
 * Calcula tempo baseado no tamanho da mensagem
 */
async function simulateTyping(
  instanceId: string, 
  token: string, 
  phone: string, 
  messageLength: number
): Promise<void> {
  try {
    // Calcular tempo de digitação: ~50ms por caractere, mínimo 2s, máximo 8s
    const typingTimeMs = Math.min(Math.max(messageLength * 50, 2000), 8000);
    
    console.log(`⌨️ Simulando digitação por ${typingTimeMs}ms para mensagem de ${messageLength} caracteres`);
    
    // Enviar status "digitando"
    await callZApi(instanceId, token, 'send-typing', { phone, value: true });
    
    // Aguardar o tempo calculado
    await new Promise(resolve => setTimeout(resolve, typingTimeMs));
    
    // Parar status "digitando"
    await callZApi(instanceId, token, 'send-typing', { phone, value: false });
    
    // Pequena pausa antes de enviar (simula pessoa conferindo mensagem)
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.warn("⚠️ Erro ao simular digitação (continuando envio):", error);
  }
}

/**
 * Detecta tipo de mídia pelo mimetype ou extensão
 */
function detectMediaType(media: any): 'image' | 'video' | 'audio' | 'document' {
  const mimeType = media.mimetype || media.type || '';
  const filename = (media.filename || media.fileName || '').toLowerCase();
  
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/.test(filename)) {
    return 'image';
  }
  if (mimeType.startsWith('video/') || /\.(mp4|avi|mov|webm)$/.test(filename)) {
    return 'video';
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|opus)$/.test(filename)) {
    return 'audio';
  }
  return 'document';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração do Supabase ausente");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const requestData = await req.json();
    const {
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
      customMessages = {},
    } = requestData;

    console.log("=== INICIANDO ENVIO WHATSAPP VIA Z-API ===");
    console.log("Instância:", instanceName);
    console.log("Total telefones:", telefones.length);
    console.log("Incluir todos:", incluirTodos);
    console.log("Mídias:", mediaFiles.length);

    // Validações
    if (!mensagem && mediaFiles.length === 0 && Object.keys(customMessages).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Envie uma mensagem ou arquivo de mídia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração da instância (ou usar padrão)
    let instanceId = ZAPI_DEFAULT_INSTANCE_ID;
    let token = ZAPI_DEFAULT_TOKEN;

    if (instanceName) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("instance_name", instanceName)
        .eq("active", true)
        .single();

      if (instance) {
        instanceId = instance.instance_id || instanceId;
        token = instance.instance_token || token;
        console.log("✅ Usando instância do banco:", instance.display_name);
      } else {
        console.log("⚠️ Instância não encontrada, usando configuração padrão");
      }
    }

    console.log("Instance ID:", instanceId);

    // Montar lista de telefones
    let phoneList: string[] = [];
    
    if (incluirTodos) {
      const { data: municipes } = await supabase
        .from("municipes")
        .select("telefone")
        .not("telefone", "is", null);
        
      if (municipes) {
        phoneList = municipes.map(m => m.telefone).filter(Boolean);
      }
    } else {
      phoneList = telefones.map((t: any) => typeof t === 'object' ? t.telefone : t).filter(Boolean);
    }
    
    // Remover duplicatas
    phoneList = [...new Set(phoneList)];
    
    if (phoneList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone válido para envio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 Total de números para envio: ${phoneList.length}`);

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Processar cada telefone
    for (let i = 0; i < phoneList.length; i++) {
      const rawPhone = phoneList[i];
      const normalizedPhone = normalizePhone(rawPhone);
      
      console.log(`\n📱 [${i + 1}/${phoneList.length}] Processando: ${rawPhone} → ${normalizedPhone}`);
      
      // Delay entre envios (exceto no primeiro)
      if (i > 0) {
        const delaySeconds = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
        const delayMs = Math.round(delaySeconds * 1000);
        console.log(`⏳ Aguardando ${(delayMs/1000).toFixed(1)}s antes do próximo envio...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      try {
        let messageSent = false;
        let mediaIndex = 0;
        
        // Enviar mídias se houver
        for (const media of mediaFiles) {
          if (mediaIndex > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
          
          const mediaType = detectMediaType(media);
          console.log(`📎 Enviando ${mediaType} (${mediaIndex + 1}/${mediaFiles.length})`);
          
          let endpoint: string;
          let payload: any = { phone: normalizedPhone };
          const mediaData = media.url || media.data || media.media;
          
          switch (mediaType) {
            case 'image':
              endpoint = 'send-image';
              payload.image = mediaData;
              if (!messageSent) {
                const caption = customMessages[rawPhone] || mensagem;
                if (caption) {
                  payload.caption = caption;
                  messageSent = true;
                }
              }
              break;
              
            case 'video':
              endpoint = 'send-video';
              payload.video = mediaData;
              if (!messageSent) {
                const caption = customMessages[rawPhone] || mensagem;
                if (caption) {
                  payload.caption = caption;
                  messageSent = true;
                }
              }
              break;
              
            case 'audio':
              endpoint = 'send-audio';
              payload.audio = mediaData;
              break;
              
            default:
              endpoint = 'send-document/pdf';
              payload.document = mediaData;
              payload.fileName = media.filename || media.fileName || 'documento.pdf';
              break;
          }
          
          const resp = await callZApi(instanceId, token, endpoint, payload);
          
          if (resp.ok) {
            console.log(`✅ ${mediaType} enviado com sucesso`);
            successCount++;
            results.push({
              telefone: rawPhone,
              tipo: mediaType,
              status: 'sucesso',
              zapiId: resp.body?.zapiId
            });
          } else {
            console.error(`❌ Erro ao enviar ${mediaType}: ${resp.error}`);
            errorCount++;
            results.push({
              telefone: rawPhone,
              tipo: mediaType,
              status: 'erro',
              erro: resp.error
            });
          }
          
          mediaIndex++;
        }
        
        // Enviar texto se houver e ainda não foi enviado como caption
        const mensagemParaEnviar = customMessages[rawPhone] || mensagem || '';
        if (mensagemParaEnviar && !messageSent) {
          if (mediaFiles.length > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
          
          console.log('💬 Enviando mensagem de texto');
          
          // 🎯 SIMULAR DIGITAÇÃO ANTES DE ENVIAR
          await simulateTyping(instanceId, token, normalizedPhone, mensagemParaEnviar.length);
          
          const resp = await callZApi(
            instanceId, 
            token, 
            'send-text',
            {
              phone: normalizedPhone,
              message: mensagemParaEnviar
            }
          );
          
          if (resp.ok) {
            console.log('✅ Texto enviado com sucesso');
            successCount++;
            results.push({
              telefone: rawPhone,
              tipo: 'texto',
              status: 'sucesso',
              zapiId: resp.body?.zapiId
            });
          } else {
            console.error('❌ Erro ao enviar texto:', resp.error);
            errorCount++;
            results.push({
              telefone: rawPhone,
              tipo: 'texto',
              status: 'erro',
              erro: resp.error
            });
          }
        }
        
      } catch (error: any) {
        console.error(`❌ Erro geral ao enviar para ${rawPhone}:`, error);
        errorCount++;
        results.push({
          telefone: rawPhone,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`\n📊 === RESUMO ===`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        resumo: {
          total: phoneList.length,
          sucessos: successCount,
          erros: errorCount
        },
        resultados: results
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("💥 Erro na função:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
