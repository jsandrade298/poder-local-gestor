// ============================================================
// Webhook "Ao receber" da instância W-API de notificações
//
// Marca o resumo como confirmado quando o usuário clica no botão
// "✅ Recebi" (ou responde OK, quando a instância não tem plano PRO
// e o resumo saiu como texto puro).
//
// Configure em: painel W-API → Webhooks → Ao receber
//   https://<projeto>.supabase.co/functions/v1/wapi-webhook-notificacoes
//
// A W-API exige HTTPS no webhook — a URL da edge function já atende.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

// ============================================================
// Parser do webhook "Ao receber" da W-API (event: webhookReceived)
//
// Embutido de propósito: as funções deste projeto são publicadas
// pelo editor do Dashboard, que não resolve imports de pastas
// acima da própria função.
// ============================================================

interface WApiIncomingMessage {
  instanceId: string | null;
  messageId: string | null;
  fromMe: boolean;
  isGroup: boolean;
  /** Telefone do remetente, só dígitos. */
  senderPhone: string | null;
  /** Texto digitado, quando a mensagem for de texto. */
  text: string | null;
  /** buttonId do botão clicado, quando a resposta vier de send-button-list. */
  selectedButtonId: string | null;
}

/**
 * Extrai os campos que nos interessam, tolerando as várias formas
 * que `msgContent` pode assumir.
 */
function parseIncoming(payload: any): WApiIncomingMessage {
  const content = payload?.msgContent ?? {};

  const buttonsResponse =
    content.buttonsResponseMessage ??
    content.templateButtonReplyMessage ??
    content.listResponseMessage ??
    null;

  const text: string | null =
    content.conversation ??
    content.extendedTextMessage?.text ??
    buttonsResponse?.selectedDisplayText ??
    buttonsResponse?.title ??
    null;

  const selectedButtonId: string | null =
    buttonsResponse?.selectedButtonId ??
    buttonsResponse?.selectedId ??
    buttonsResponse?.singleSelectReply?.selectedRowId ??
    null;

  const rawSender = payload?.sender?.id ?? payload?.chat?.id ?? null;

  return {
    instanceId: payload?.instanceId ?? null,
    messageId: payload?.messageId ?? null,
    fromMe: payload?.fromMe === true,
    isGroup: payload?.isGroup === true,
    senderPhone: rawSender ? String(rawSender).replace(/\D/g, "") : null,
    text: typeof text === "string" ? text : null,
    selectedButtonId,
  };
}

// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Confirmações aceitas quando o resumo foi enviado como texto puro. */
const RESPOSTAS_DE_CONFIRMACAO = /^\s*(ok|okay|ciente|recebi|confirmo|confirmado|👍|✅)\s*[.!]?\s*$/i;

/** Só aceitamos "OK" avulso como confirmação de um resumo recente. */
const JANELA_CONFIRMACAO_HORAS = 24;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await req.json();
    const msg = parseIncoming(payload);

    console.log(
      `📥 W-API webhook: event=${payload?.event} de=${msg.senderPhone} ` +
        `botao=${msg.selectedButtonId ?? "-"} texto=${(msg.text ?? "").slice(0, 40)}`,
    );

    // Ignora o que não interessa: mensagens próprias e grupos
    if (msg.fromMe || msg.isGroup) {
      return ok({ ignorado: msg.fromMe ? "mensagem própria" : "grupo" });
    }

    // ---------- Caminho 1: clique no botão ----------
    // buttonId sai como "confirmar:<uuid do resumo>"
    if (msg.selectedButtonId?.startsWith("confirmar:")) {
      const resumoId = msg.selectedButtonId.slice("confirmar:".length);

      const { data, error } = await supabase
        .from("notificacao_whatsapp_resumos")
        .update({
          confirmado_em: new Date().toISOString(),
          confirmacao_texto: msg.text || "botão",
        })
        .eq("id", resumoId)
        .is("confirmado_em", null)
        .select("id, destinatario_id, total_itens")
        .maybeSingle();

      if (error) {
        console.error("❌ Erro ao confirmar resumo:", error);
        return ok({ erro: error.message });
      }

      if (!data) {
        console.log(`ℹ️ Resumo ${resumoId} não encontrado ou já confirmado`);
        return ok({ confirmado: false, motivo: "inexistente ou já confirmado" });
      }

      console.log(`✅ Resumo ${data.id} confirmado (${data.total_itens} itens)`);
      return ok({ confirmado: true, resumo_id: data.id });
    }

    // ---------- Caminho 2: resposta em texto ("OK") ----------
    if (msg.senderPhone && msg.text && RESPOSTAS_DE_CONFIRMACAO.test(msg.text)) {
      const limite = new Date(
        Date.now() - JANELA_CONFIRMACAO_HORAS * 60 * 60 * 1000,
      ).toISOString();

      const { data: resumo } = await supabase
        .from("notificacao_whatsapp_resumos")
        .select("id, total_itens")
        .eq("destinatario_telefone", msg.senderPhone)
        .is("confirmado_em", null)
        .gte("enviado_em", limite)
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resumo) {
        console.log(`ℹ️ Nenhum resumo pendente de confirmação para ${msg.senderPhone}`);
        return ok({ confirmado: false, motivo: "sem resumo pendente" });
      }

      await supabase
        .from("notificacao_whatsapp_resumos")
        .update({
          confirmado_em: new Date().toISOString(),
          confirmacao_texto: msg.text,
        })
        .eq("id", resumo.id);

      console.log(`✅ Resumo ${resumo.id} confirmado por texto`);
      return ok({ confirmado: true, resumo_id: resumo.id });
    }

    // Qualquer outra mensagem segue para o Assessor Virtual, que tem
    // seu próprio webhook — aqui apenas confirmamos o recebimento.
    return ok({ recebido: true });
  } catch (error: any) {
    console.error("💥 Erro no webhook:", error);
    // Sempre 200: a W-API reenfileira webhooks que respondem erro.
    return ok({ erro: error.message });
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
