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
  if (digits.startsWith("55")) digits = digits.slice(2);

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (/^[987]\d{7}$/.test(rest)) digits = ddd + "9" + rest;
  }
  if (digits.length !== 10 && digits.length !== 11) return { digits: null, jid: null };

  const full = "55" + digits;
  return { digits: full, jid: full + "@s.whatsapp.net" };
}

async function callEvolution(url: string, payload: any, apikey: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let body: any = raw;
  try { body = JSON.parse(raw); } catch { /* mantém texto cru */ }
  console.log(`Evolution API Call - URL: ${url}, Status: ${res.status}, Body:`, body);
  return { ok: res.ok, status: res.status, body };
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

    console.log("=== Iniciando envio WhatsApp ===");
    console.log("Instance:", instanceName);
    console.log("Incluir todos:", incluirTodos);
    console.log("Telefones diretos:", telefones);
    console.log("Mídia anexada:", mediaFiles.length);

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
      console.error("Instância não encontrada:", instErr);
      return new Response(
        JSON.stringify({ success: false, error: "Instância WhatsApp não encontrada ou inativa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Instância encontrada:", instance.instance_name);

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
    console.log(`Total de números para envio: ${list.length}`);

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error("Credenciais Evolution não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Evolution API não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Evolution API URL:", evolutionApiUrl);

    // corrige delays
    let min = Number(tempoMinimo) || 1;
    let max = Number(tempoMaximo) || 3;
    if (min > max) [min, max] = [max, min];
    console.log(`Delays configurados: ${min}s - ${max}s`);

    const results: any[] = [];

    for (const rawPhone of list) {
      const { digits, jid } = normalizeBrNumber(rawPhone);
      if (!digits) {
        console.log(`Número inválido: ${rawPhone}`);
        results.push({ telefone: rawPhone, status: "erro", erro: "Número inválido" });
        continue;
      }

      console.log(`Processando: ${rawPhone} -> ${digits}`);

      // util local para tentar com dígitos e, se falhar, com JID
      const trySend = async (builder: (numberField: string) => Promise<{ ok: boolean; status: number; body: any }>) => {
        const r1 = await builder(digits);
        if (r1.ok) return r1;
        if (jid) {
          console.log(`Tentando com JID: ${jid}`);
          const r2 = await builder(jid);
          if (r2.ok) return r2;
          return r2; // retorna último erro
        }
        return r1;
      };

      // delay aleatório entre min..max
      const delayMs = (Math.random() * (max - min) + min) * 1000;
      console.log(`Aguardando ${delayMs}ms antes do envio para ${digits}`);
      await new Promise((r) => setTimeout(r, delayMs));

      try {
        // 1) Enviar TODAS as mídias (com caption quando suportado)
        for (const media of mediaFiles) {
          console.log(`Enviando mídia ${media.type} para ${digits}`);
          
          const sendMedia = async (numberValue: string) => {
            let url = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
            let payload: any = { number: numberValue, mediatype: media.type, media: media.url };

            if (media.type === "document") {
              payload.fileName = media.filename || media.fileName || "document.pdf";
              if (mensagem) payload.caption = mensagem; // algumas versões suportam caption em doc
            } else if (media.type === "image" || media.type === "video") {
              if (mensagem) payload.caption = mensagem;
            } else if (media.type === "audio") {
              url = `${evolutionApiUrl}/message/sendWhatsAppAudio/${instanceName}`;
              payload = { number: numberValue, audio: media.url };
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
          });

          // respiro entre mídias
          await new Promise((r) => setTimeout(r, 500));
        }

        // 2) Enviar TEXTO SEMPRE que houver mensagem
        if (mensagem && String(mensagem).trim().length) {
          console.log(`Enviando texto para ${digits}`);
          
          const sendText = async (numberValue: string) => {
            const url = `${evolutionApiUrl}/message/sendText/${instanceName}`;
            const payload = { number: numberValue, text: mensagem };
            return await callEvolution(url, payload, evolutionApiKey);
          };

          const resp = await trySend(sendText);
          results.push({
            telefone: rawPhone,
            status: resp.ok ? "sucesso" : "erro",
            step: "texto",
            http: resp.status,
            retorno: resp.body,
          });
        }

      } catch (err: any) {
        console.error(`Erro ao enviar para ${rawPhone}:`, err);
        results.push({ telefone: rawPhone, status: "erro", erro: String(err?.message || err) });
      }
    }

    const sucessos = results.filter((r) => r.status === "sucesso").length;
    const erros = results.filter((r) => r.status === "erro").length;

    console.log("=== Resumo Final ===");
    console.log(`Total de passos: ${results.length}`);
    console.log(`Sucessos: ${sucessos}`);
    console.log(`Erros: ${erros}`);

    return new Response(
      JSON.stringify({ success: true, resumo: { total_passos: results.length, sucessos, erros }, resultados: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Erro geral na função:", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});