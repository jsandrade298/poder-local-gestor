import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeBrNumber(raw: string): { digits: string | null; jid: string | null } {
  if (!raw) return { digits: null, jid: null };
  
  let digits = String(raw).replace(/\D/g, "");
  
  // Remove código do país se presente
  if (digits.startsWith("55")) digits = digits.slice(2);
  
  // Adiciona o 9 se for celular de 10 dígitos
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    // Verifica se é celular (inicia com 9, 8 ou 7)
    if (/^[987]\d{7}$/.test(rest)) {
      digits = ddd + "9" + rest;
    }
  }
  
  // Valida tamanho final
  if (digits.length !== 10 && digits.length !== 11) {
    return { digits: null, jid: null };
  }

  // Adiciona DDI 55 para Evolution API
  const full = "55" + digits;
  return { 
    digits: full,
    jid: full + "@s.whatsapp.net" 
  };
}

async function callEvolution(url: string, payload: any, apikey: string) {
  try {
    console.log(`🔄 Chamando Evolution API: ${url}`);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "apikey": apikey 
      },
      body: JSON.stringify(payload),
    });
    
    const raw = await res.text();
    let body: any = raw;
    
    try { 
      body = JSON.parse(raw); 
    } catch { 
      console.warn("Resposta não é JSON válido:", raw);
    }
    
    console.log(`📡 Evolution API Response - Status: ${res.status}`);
    console.log('📋 Response Body:', body);
    
    // Verificar erros específicos da API
    if (!res.ok) {
      console.error(`❌ Erro HTTP ${res.status}:`, body);
      return { 
        ok: false, 
        status: res.status, 
        body: body,
        error: body?.message || body?.error || `HTTP ${res.status}` 
      };
    }
    
    return { ok: true, status: res.status, body };
    
  } catch (error: any) {
    console.error("❌ Erro na requisição:", error);
    return { 
      ok: false, 
      status: 500, 
      body: null, 
      error: error.message || 'Erro desconhecido na chamada da API'
    };
  }
}

serve(async (req) => {
  // Tratamento de CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse do body da requisição
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      console.error("❌ Erro ao parsear JSON:", e);
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido na requisição" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
    } = requestData;

    // Logs de debug melhorados
    console.log("🚀 === INICIANDO ENVIO WHATSAPP ===");
    console.log("📋 Parâmetros recebidos:", {
      instanceName,
      incluirTodos,
      totalTelefones: telefones.length,
      temMensagem: !!mensagem,
      totalMidias: mediaFiles.length,
      tempoMinimo,
      tempoMaximo,
      telefones: telefones.slice(0, 5) // Log dos primeiros 5 números para debug
    });

    // Validação da instância
    if (!instanceName) {
      console.error("❌ Nome da instância não fornecido");
      return new Response(
        JSON.stringify({ success: false, error: "Nome da instância é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Credenciais Supabase não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Supabase não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar instância no banco - primeira tentativa por instance_name
    let { data: instance, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .eq("active", true)
      .single();

    // Se não encontrar, tentar por display_name
    if (instErr && instErr.code === "PGRST116") {
      console.log("🔄 Tentando buscar por display_name...");
      const { data: instanceByDisplay, error: displayErr } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("display_name", instanceName)
        .eq("active", true)
        .single();
      
      instance = instanceByDisplay;
      instErr = displayErr;
    }

    if (instErr || !instance) {
      console.error("❌ Erro ao buscar instância:", instErr);
      console.log("🔍 Instâncias disponíveis:");
      const { data: allInstances } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, display_name, active");
      console.log(allInstances);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Instância WhatsApp '${instanceName}' não encontrada ou inativa`,
          details: instErr?.message,
          available_instances: allInstances
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Instância encontrada:", {
      name: instance.instance_name,
      display: instance.display_name,
      active: instance.active
    });

    // Montar lista de números
    let list: string[] = Array.isArray(telefones) ? telefones : [];
    
    if (incluirTodos) {
      console.log("📱 Buscando todos os munícipes...");
      const { data: municipes, error: mErr } = await supabase
        .from("municipes")
        .select("telefone")
        .not("telefone", "is", null);
        
      if (mErr) {
        console.error("❌ Erro ao buscar munícipes:", mErr);
      } else if (municipes) {
        console.log(`✅ ${municipes.length} munícipes encontrados`);
        list = list.concat(municipes.map((m) => m.telefone));
      }
    }
    
    // Limpar e deduplicar
    list = [...new Set(list.filter(Boolean))];
    
    if (list.length === 0) {
      console.error("❌ Nenhum número válido para envio");
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum número válido para envio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`📞 Total de números únicos para envio: ${list.length}`);

    // Verificar credenciais Evolution API
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error("❌ Credenciais Evolution não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Evolution API não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔗 Evolution API URL:", evolutionApiUrl);

    // Corrigir delays
    let min = Math.max(1, Number(tempoMinimo) || 1);
    let max = Math.max(min, Number(tempoMaximo) || 3);
    console.log(`⏱️ Delays configurados: ${min}s - ${max}s`);

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Processar cada número
    for (let i = 0; i < list.length; i++) {
      const rawPhone = list[i];
      console.log(`\n📱 [${i + 1}/${list.length}] Processando: ${rawPhone}`);
      
      const { digits, jid } = normalizeBrNumber(rawPhone);
      
      if (!digits) {
        console.log(`❌ Número inválido: ${rawPhone}`);
        results.push({ 
          telefone: rawPhone, 
          status: "erro", 
          erro: "Número inválido após normalização" 
        });
        errorCount++;
        continue;
      }

      console.log(`✅ Número normalizado: ${digits}`);

      // Função auxiliar para tentar envio
      const trySend = async (
        builder: (numberField: string) => Promise<{ ok: boolean; status: number; body: any; error?: string }>
      ) => {
        // Tentar primeiro com digits
        const result = await builder(digits);
        if (result.ok) return result;
        
        // Se falhar e tivermos JID, tentar com JID
        if (jid && result.status === 404) {
          console.log(`🔄 Tentando com JID: ${jid}`);
          const jidResult = await builder(jid);
          return jidResult;
        }
        
        return result;
      };

      // Delay entre envios (exceto para o primeiro)
      if (i > 0) {
        const delayMs = Math.round((Math.random() * (max - min) + min) * 1000);
        console.log(`⏳ Aguardando ${delayMs}ms antes do próximo envio...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }

      try {
        let messagesSent = false;
        
        // 1) Enviar mídias se houver
        if (mediaFiles && mediaFiles.length > 0) {
          for (const media of mediaFiles) {
            console.log(`📎 Enviando mídia ${media.type} para ${digits}`);
            
            const sendMedia = async (numberValue: string) => {
              let url, payload;
              
              // Usar endpoint correto baseado no tipo de mídia
              if (media.type === "audio") {
                url = `${evolutionApiUrl}/message/sendWhatsAppAudio/${instance.instance_name}`;
                payload = { 
                  number: numberValue, 
                  audio: media.url,
                  delay: 1200
                };
              } else {
                url = `${evolutionApiUrl}/message/sendMedia/${instance.instance_name}`;
                payload = { 
                  number: numberValue, 
                  mediatype: media.type, 
                  media: media.url,
                  delay: 1200
                };
                
                // Adicionar caption apenas na primeira mídia se for imagem/vídeo
                if (!messagesSent && mensagem && (media.type === "image" || media.type === "video")) {
                  payload.caption = mensagem;
                  messagesSent = true; // Marcar que mensagem já foi enviada
                }
                
                // Para documentos, adicionar nome do arquivo
                if (media.type === "document") {
                  payload.fileName = media.filename || media.fileName || "documento.pdf";
                }
              }
              
              return await callEvolution(url, payload, evolutionApiKey);
            };

            const resp = await trySend(sendMedia);
            
            if (resp.ok) {
              successCount++;
              console.log(`✅ Mídia enviada com sucesso`);
            } else {
              errorCount++;
              console.log(`❌ Erro ao enviar mídia: ${resp.error}`);
            }
            
            results.push({
              telefone: rawPhone,
              tipo: `mídia_${media.type}`,
              status: resp.ok ? "sucesso" : "erro",
              http: resp.status,
              erro: resp.error || null
            });

            // Pequeno delay entre mídias
            if (mediaFiles.indexOf(media) < mediaFiles.length - 1) {
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }

        // 2) Enviar texto se houver e ainda não foi enviado como caption
        if (mensagem && String(mensagem).trim() && !messagesSent) {
          console.log(`💬 Enviando mensagem de texto para ${digits}`);
          
          const sendText = async (numberValue: string) => {
            const url = `${evolutionApiUrl}/message/sendText/${instance.instance_name}`;
            const payload = { 
              number: numberValue, 
              text: mensagem,
              delay: 1200,
              linkPreview: false
            };
            return await callEvolution(url, payload, evolutionApiKey);
          };

          const resp = await trySend(sendText);
          
          if (resp.ok) {
            successCount++;
            console.log(`✅ Texto enviado com sucesso`);
          } else {
            errorCount++;
            console.log(`❌ Erro ao enviar texto: ${resp.error}`);
          }
          
          results.push({
            telefone: rawPhone,
            tipo: "texto",
            status: resp.ok ? "sucesso" : "erro",
            http: resp.status,
            erro: resp.error || null
          });
        }

      } catch (err: any) {
        console.error(`❌ Erro inesperado ao enviar para ${rawPhone}:`, err);
        errorCount++;
        results.push({ 
          telefone: rawPhone, 
          status: "erro", 
          erro: err?.message || String(err) 
        });
      }
    }

    // Resumo final
    console.log("\n📊 === RESUMO FINAL ===");
    console.log(`📨 Total de mensagens processadas: ${results.length}`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📱 Números únicos processados: ${list.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resumo: { 
          total_numeros: list.length,
          total_mensagens: results.length,
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
    
  } catch (e: any) {
    console.error("💥 Erro geral na função:", e);
    console.error("Stack trace:", e.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: e?.message || "Erro interno do servidor",
        stack: e?.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});