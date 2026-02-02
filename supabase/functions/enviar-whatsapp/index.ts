import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Configuração Z-API padrão
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

function substituirVariaveis(texto: string, variaveis: Record<string, string>): string {
  let resultado = texto;
  Object.entries(variaveis).forEach(([chave, valor]) => {
    resultado = resultado.replace(new RegExp(`\\{${chave}\\}`, 'gi'), valor || '');
  });
  return resultado;
}

function calcularDelayTyping(mensagem: string): number {
  return Math.min(Math.max(Math.ceil(mensagem.length / 50), 2), 50);
}

function embaralharArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildZApiUrl(instanceId: string, token: string, endpoint: string): string {
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
}

async function callZApi(
  instanceId: string, token: string, clientToken: string,
  endpoint: string, payload: any, method: "GET" | "POST" = "POST"
): Promise<{ ok: boolean; status: number; body: any; error?: string }> {
  const url = buildZApiUrl(instanceId, token, endpoint);
  
  try {
    console.log(`🔄 Z-API ${method}: ${endpoint}`);
    
    const options: RequestInit = {
      method,
      headers: { "Content-Type": "application/json", "Client-Token": clientToken }
    };
    
    if (method === "POST" && payload) options.body = JSON.stringify(payload);
    
    const response = await fetch(url, options);
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    
    console.log(`📡 Response: ${response.status}`);
    
    if (!response.ok) {
      return { ok: false, status: response.status, body, error: body?.error || body?.message || `HTTP ${response.status}` };
    }
    
    return { ok: true, status: response.status, body };
  } catch (error: any) {
    console.error("❌ Erro Z-API:", error);
    return { ok: false, status: 500, body: null, error: error.message };
  }
}

function detectMediaType(media: any): 'image' | 'video' | 'audio' | 'document' {
  const mimeType = media.mimetype || media.type || '';
  const filename = (media.filename || media.fileName || '').toLowerCase();
  
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/.test(filename)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|avi|mov|webm)$/.test(filename)) return 'video';
  if (mimeType.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|opus)$/.test(filename)) return 'audio';
  return 'document';
}

// ==================== FUNÇÕES DE ENVIO ====================

async function enviarTexto(iId: string, tok: string, cTok: string, phone: string, msg: string) {
  return callZApi(iId, tok, cTok, 'send-text', { phone, message: msg, delayTyping: calcularDelayTyping(msg) });
}

async function enviarImagem(iId: string, tok: string, cTok: string, phone: string, url: string, caption?: string) {
  return callZApi(iId, tok, cTok, 'send-image', { phone, image: url, caption: caption || '' });
}

async function enviarVideo(iId: string, tok: string, cTok: string, phone: string, url: string, caption?: string) {
  return callZApi(iId, tok, cTok, 'send-video', { phone, video: url, caption: caption || '' });
}

async function enviarAudio(iId: string, tok: string, cTok: string, phone: string, url: string) {
  return callZApi(iId, tok, cTok, 'send-audio', { phone, audio: url });
}

async function enviarDocumento(iId: string, tok: string, cTok: string, phone: string, url: string, fileName: string) {
  return callZApi(iId, tok, cTok, 'send-document/pdf', { phone, document: url, fileName });
}

async function enviarLocalizacao(iId: string, tok: string, cTok: string, phone: string, lat: number, lng: number, name?: string, addr?: string) {
  return callZApi(iId, tok, cTok, 'send-location', { phone, latitude: String(lat), longitude: String(lng), name: name || '', address: addr || '' });
}

async function enviarContato(iId: string, tok: string, cTok: string, phone: string, cName: string, cPhone: string, cDesc?: string) {
  return callZApi(iId, tok, cTok, 'send-contact', { phone, contactName: cName, contactPhone: normalizePhone(cPhone), contactBusinessDescription: cDesc || '' });
}

async function enviarEnquete(iId: string, tok: string, cTok: string, phone: string, pergunta: string, opcoes: string[], multiplas: boolean = false) {
  return callZApi(iId, tok, cTok, 'send-poll', { phone, pollTitle: pergunta, options: opcoes, allowMultipleAnswers: multiplas });
}

// ==================== HANDLER PRINCIPAL ====================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Configuração Supabase ausente");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const requestData = await req.json();
    
    const {
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 2,
      tempoMaximo = 5,
      mediaFiles = [],
      customMessages = {},
      tipo = 'texto',
      conteudo = {},
      localizacao,
      contato,
      enquete,
      ordemAleatoria = false,
      variaveis = {},
      salvarHistorico = false,
      tituloEnvio = '',
      usuarioId = null,
      usuarioNome = ''
    } = requestData;

    console.log("=== ENVIO WHATSAPP Z-API ===");
    console.log("Tipo:", tipo, "| Instância:", instanceName, "| Telefones:", telefones.length);

    let instanceId = ZAPI_INSTANCE_ID;
    let token = ZAPI_TOKEN;
    let clientToken = ZAPI_CLIENT_TOKEN;
    let instanciaDbId = null;

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
        clientToken = instance.client_token || clientToken;
        instanciaDbId = instance.id;
        console.log("✅ Usando:", instance.display_name);
      }
    }

    let phoneList: string[] = [];
    
    if (incluirTodos) {
      const { data: municipes } = await supabase.from("municipes").select("telefone").not("telefone", "is", null);
      if (municipes) phoneList = municipes.map(m => m.telefone).filter(Boolean);
    } else {
      phoneList = telefones.map((t: any) => typeof t === 'object' ? t.telefone : t).filter(Boolean);
    }
    
    phoneList = [...new Set(phoneList)];
    
    if (phoneList.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum telefone válido" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (ordemAleatoria) {
      phoneList = embaralharArray(phoneList);
      console.log("🔀 Ordem aleatória");
    }

    let envioId = null;
    if (salvarHistorico) {
      const { data: envio } = await supabase.from('whatsapp_envios').insert({
        titulo: tituloEnvio || `Envio ${new Date().toLocaleDateString('pt-BR')}`,
        tipo,
        conteudo: { mensagem, ...conteudo, localizacao, contato, enquete },
        total_destinatarios: phoneList.length,
        ordem_aleatoria: ordemAleatoria,
        delay_min: tempoMinimo,
        delay_max: tempoMaximo,
        usuario_id: usuarioId,
        usuario_nome: usuarioNome,
        instancia_id: instanciaDbId,
        instancia_nome: instanceName,
        status: 'enviando',
        iniciado_em: new Date().toISOString()
      }).select().single();
      
      if (envio) envioId = envio.id;
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < phoneList.length; i++) {
      const rawPhone = phoneList[i];
      const normalizedPhone = normalizePhone(rawPhone);
      
      console.log(`\n📱 [${i + 1}/${phoneList.length}] ${rawPhone}`);
      
      if (i > 0) {
        const delayMs = Math.round((Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo) * 1000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const varsDestinatario = {
        ...variaveis,
        telefone: rawPhone,
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      
      const mensagemFinal = customMessages[rawPhone] 
        ? substituirVariaveis(customMessages[rawPhone], varsDestinatario)
        : substituirVariaveis(mensagem, varsDestinatario);
      
      let resp: any;
      
      try {
        switch (tipo) {
          case 'localizacao':
            if (localizacao) resp = await enviarLocalizacao(instanceId, token, clientToken, normalizedPhone, localizacao.latitude, localizacao.longitude, localizacao.nome, localizacao.endereco);
            break;
          case 'contato':
            if (contato) resp = await enviarContato(instanceId, token, clientToken, normalizedPhone, contato.nome, contato.telefone, contato.descricao);
            break;
          case 'enquete':
            if (enquete) {
              const perguntaFinal = substituirVariaveis(enquete.pergunta, varsDestinatario);
              resp = await enviarEnquete(instanceId, token, clientToken, normalizedPhone, perguntaFinal, enquete.opcoes, enquete.multiplas);
            }
            break;
          case 'imagem':
            if (mediaFiles.length > 0 || conteudo?.url) {
              const url = conteudo?.url || mediaFiles[0]?.url;
              const caption = conteudo?.legenda ? substituirVariaveis(conteudo.legenda, varsDestinatario) : mensagemFinal;
              resp = await enviarImagem(instanceId, token, clientToken, normalizedPhone, url, caption);
            }
            break;
          case 'video':
            if (mediaFiles.length > 0 || conteudo?.url) {
              const url = conteudo?.url || mediaFiles[0]?.url;
              const caption = conteudo?.legenda ? substituirVariaveis(conteudo.legenda, varsDestinatario) : mensagemFinal;
              resp = await enviarVideo(instanceId, token, clientToken, normalizedPhone, url, caption);
            }
            break;
          case 'audio':
            if (mediaFiles.length > 0 || conteudo?.url) {
              const url = conteudo?.url || mediaFiles[0]?.url;
              resp = await enviarAudio(instanceId, token, clientToken, normalizedPhone, url);
            }
            break;
          case 'documento':
            if (mediaFiles.length > 0 || conteudo?.url) {
              const url = conteudo?.url || mediaFiles[0]?.url;
              const fileName = substituirVariaveis(conteudo?.nomeArquivo || mediaFiles[0]?.filename || 'documento.pdf', varsDestinatario);
              resp = await enviarDocumento(instanceId, token, clientToken, normalizedPhone, url, fileName);
            }
            break;
          default:
            let textSent = false;
            for (const media of mediaFiles) {
              const mediaType = detectMediaType(media);
              const mediaUrl = media.url || media.data;
              
              if (mediaType === 'image') {
                resp = await enviarImagem(instanceId, token, clientToken, normalizedPhone, mediaUrl, textSent ? '' : mensagemFinal);
                textSent = true;
              } else if (mediaType === 'video') {
                resp = await enviarVideo(instanceId, token, clientToken, normalizedPhone, mediaUrl, textSent ? '' : mensagemFinal);
                textSent = true;
              } else if (mediaType === 'audio') {
                resp = await enviarAudio(instanceId, token, clientToken, normalizedPhone, mediaUrl);
              } else {
                resp = await enviarDocumento(instanceId, token, clientToken, normalizedPhone, mediaUrl, media.filename || 'documento');
              }
              if (!resp.ok) break;
              await new Promise(r => setTimeout(r, 1000));
            }
            
            if (!textSent && mensagemFinal) {
              resp = await enviarTexto(instanceId, token, clientToken, normalizedPhone, mensagemFinal);
            }
        }
        
        if (resp?.ok) {
          console.log('✅ OK');
          successCount++;
          results.push({ telefone: rawPhone, status: 'sucesso', zapiId: resp.body?.zapiId || resp.body?.messageId || resp.body?.id });
          
          if (envioId) {
            await supabase.from('whatsapp_envios_destinatarios').insert({
              envio_id: envioId,
              telefone: rawPhone,
              telefone_formatado: normalizedPhone,
              status: 'enviado',
              mensagem_enviada: mensagemFinal,
              zapi_message_id: resp.body?.zapiId || resp.body?.messageId,
              enviado_em: new Date().toISOString(),
              ordem: i
            });
          }
        } else {
          throw new Error(resp?.error || 'Erro desconhecido');
        }
        
      } catch (error: any) {
        console.error(`❌ Erro:`, error.message);
        errorCount++;
        results.push({ telefone: rawPhone, status: 'erro', erro: error.message });
        
        if (envioId) {
          await supabase.from('whatsapp_envios_destinatarios').insert({
            envio_id: envioId,
            telefone: rawPhone,
            telefone_formatado: normalizedPhone,
            status: 'erro',
            erro_mensagem: error.message,
            ordem: i
          });
        }
      }
    }

    if (envioId) {
      await supabase.from('whatsapp_envios').update({
        status: errorCount === phoneList.length ? 'erro' : 'concluido',
        total_enviados: successCount,
        total_erros: errorCount,
        concluido_em: new Date().toISOString()
      }).eq('id', envioId);
    }

    console.log(`\n📊 RESUMO: ✅ ${successCount} | ❌ ${errorCount}`);

    return new Response(JSON.stringify({
      success: true,
      envioId,
      resumo: { total: phoneList.length, sucessos: successCount, erros: errorCount },
      resultados: results
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("💥 Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
