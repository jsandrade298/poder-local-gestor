import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  // Para Evolution API, teste primeiro sem código do país
  return { 
    digits: digits, // Apenas DDD + número
    jid: digits + "@s.whatsapp.net" 
  };
}

async function callEvolution(url: string, payload: any, apikey: string) {
  try {
    console.log(`🔄 Chamando Evolution API: ${url}`, payload);
    
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
    
    console.log(`📡 Evolution API Response - Status: ${res.status}, Body:`, body);
    
    // Verificar erros específicos da API
    if (!res.ok) {
      console.error(`❌ Erro HTTP ${res.status}:`, body);
      return { 
        ok: false, 
        status: res.status, 
        body: body,
        error: body?.message || `HTTP ${res.status}` 
      };
    }
    
    return { ok: true, status: res.status, body };
    
  } catch (error) {
    console.error("❌ Erro na requisição:", error);
    return { 
      ok: false, 
      status: 0, 
      body: null, 
      error: error.message 
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
    } = await req.json();

    // Logs de debug melhorados
    console.log("🚀 === INICIANDO ENVIO WHATSAPP ===");
    console.log("📋 Parâmetros recebidos:", {
      instanceName,
      incluirTodos,
      totalTelefones: telefones.length,
      temMensagem: !!mensagem,
      totalMidias: mediaFiles.length,
      tempoMinimo,
      tempoMaximo
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // valida instância
    const { data: instance, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .eq("active", true)
      .single();

    if (instErr || !instance) {
      console.error("❌ Instância não encontrada:", instErr);
      return new Response(
        JSON.stringify({ success: false, error: "Instância WhatsApp não encontrada ou inativa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Instância encontrada:", instance.instance_name);

    // monta lista de números
    let list: string[] = Array.isArray(telefones) ? telefones : [];
    if (incluirTodos) {
      const { data: municipes, error: mErr } = await supabase
        .from("municipes")
        .select("telefone")
        .not("telefone", "is", null);
      if (!mErr && municipes) list = list.concat(municipes.map((m) => m.telefone));
    }
    // limpa e deduplica
    list = [...new Set(list.filter(Boolean))];
    console.log(`📞 Total de números para envio: ${list.length}`);

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error("❌ Credenciais Evolution não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Evolution API não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔗 Evolution API URL:", evolutionApiUrl);

    // corrige delays
    let min = Number(tempoMinimo) || 1;
    let max = Number(tempoMaximo) || 3;
    if (min > max) [min, max] = [max, min];
    console.log(`⏱️ Delays configurados: ${min}s - ${max}s`);

    const results: any[] = [];

    for (const rawPhone of list) {
      const { digits, jid } = normalizeBrNumber(rawPhone);
      if (!digits) {
        console.log(`❌ Número inválido: ${rawPhone}`);
        results.push({ telefone: rawPhone, status: "erro", erro: "Número inválido" });
        continue;
      }

      console.log(`📱 Processando: ${rawPhone} -> ${digits}`);

      // util local para tentar com dígitos e, se falhar, com JID
      const trySend = async (builder: (numberField: string) => Promise<{ ok: boolean; status: number; body: any; error?: string }>) => {
        const r1 = await builder(digits);
        if (r1.ok) return r1;
        if (jid) {
          console.log(`🔄 Tentando com JID: ${jid}`);
          const r2 = await builder(jid);
          if (r2.ok) return r2;
          return r2; // retorna último erro
        }
        return r1;
      };

      // delay aleatório entre min..max
      const delayMs = (Math.random() * (max - min) + min) * 1000;
      console.log(`⏳ Aguardando ${Math.round(delayMs)}ms antes do envio para ${digits}`);
      await new Promise((r) => setTimeout(r, delayMs));

      try {
        // 1) Enviar TODAS as mídias (com caption quando suportado)
        for (const media of mediaFiles) {
          console.log(`📎 Enviando mídia ${media.type} para ${digits}`);
          
          const sendMedia = async (numberValue: string) => {
            let url, payload;
            
            if (media.type === "audio") {
              // Para áudio, usar endpoint específico
              url = `${evolutionApiUrl}/message/sendWhatsAppAudio/${instanceName}`;
              payload = { 
                number: numberValue, 
                audio: media.url 
              };
            } else {
              // Para outros tipos de mídia
              url = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
              payload = { 
                number: numberValue, 
                mediatype: media.type, 
                media: media.url
              };
              
              // Adicionar caption se houver mensagem
              if (mensagem && (media.type === "image" || media.type === "video")) {
                payload.caption = mensagem;
              }
              
              // Para documentos, adicionar nome do arquivo
              if (media.type === "document") {
                payload.fileName = media.filename || media.fileName || "document.pdf";
              }
            }
            
            return await callEvolution(url, payload, evolutionApiKey);
          };

          const resp = await trySend(sendMedia);
          results.push({
            telefone: rawPhone,
            tipo: media.type,
            status: resp.ok ? "sucesso" : "erro",
            step: "midia",
            http: resp.status,
            retorno: resp.body,
            erro: resp.error || null
          });

          // respiro entre mídias
          await new Promise((r) => setTimeout(r, 500));
        }

        // 2) Só enviar texto separado se não tiver mídia que suporte caption
        const temMidiaComCaption = mediaFiles.some(m => 
          ['image', 'video'].includes(m.type)
        );

        if (mensagem && String(mensagem).trim().length && !temMidiaComCaption) {
          console.log(`💬 Enviando texto para ${digits}`);
          
          const sendText = async (numberValue: string) => {
            const url = `${evolutionApiUrl}/message/sendText/${instanceName}`;
            const payload = { 
              number: numberValue, 
              text: mensagem,
              delay: 1200,
              linkPreview: false
            };
            return await callEvolution(url, payload, evolutionApiKey);
          };

          const resp = await trySend(sendText);
          results.push({
            telefone: rawPhone,
            status: resp.ok ? "sucesso" : "erro",
            step: "texto",
            http: resp.status,
            retorno: resp.body,
            erro: resp.error || null
          });
        }

      } catch (err: any) {
        console.error(`❌ Erro ao enviar para ${rawPhone}:`, err);
        results.push({ telefone: rawPhone, status: "erro", erro: String(err?.message || err) });
      }
    }

    const sucessos = results.filter((r) => r.status === "sucesso").length;
    const erros = results.filter((r) => r.status === "erro").length;

    console.log("📊 === RESUMO FINAL ===");
    console.log(`Total de passos: ${results.length}`);
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);

    return new Response(
      JSON.stringify({ success: true, resumo: { total_passos: results.length, sucessos, erros }, resultados: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("💥 Erro geral na função:", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});