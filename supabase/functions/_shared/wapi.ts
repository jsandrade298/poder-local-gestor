// ============================================================
// Cliente W-API (https://docs.w-api.app)
//
// Usado APENAS pelas notificações do sistema (resumos enviados
// aos usuários do gabinete). Os disparos em massa para munícipes
// continuam na Z-API/Evolution — ver enviar-whatsapp-zapi.
//
// Autenticação: `instanceId` vai na query string e o token da
// instância no cabeçalho `Authorization: Bearer <token>`.
// ============================================================

export const WAPI_BASE_URL = "https://api.w-api.app";

export interface WApiCredentials {
  instanceId: string;
  token: string;
}

export interface WApiResult<T = any> {
  ok: boolean;
  status: number;
  body: T | null;
  error?: string;
}

/** Resposta de sucesso dos endpoints de envio. */
export interface WApiSendResponse {
  instanceId: string;
  messageId: string;
  insertedId: string;
}

/**
 * Normaliza um telefone brasileiro para o formato aceito pela W-API:
 * apenas dígitos, com DDI 55 (ex: 5511999999999).
 * Retorna null quando o número não tem tamanho válido.
 */
export function normalizeBrPhone(raw: string): string | null {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, "");

  // Remove o DDI se já veio junto
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);

  // Celular antigo de 10 dígitos: insere o 9
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (/^[987]\d{7}$/.test(rest)) digits = ddd + "9" + rest;
  }

  if (digits.length !== 10 && digits.length !== 11) return null;

  return "55" + digits;
}

async function wapiRequest<T = any>(
  creds: WApiCredentials,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<WApiResult<T>> {
  const { method = "POST", body, query = {} } = init;

  const url = new URL(`${WAPI_BASE_URL}${path}`);
  url.searchParams.set("instanceId", creds.instanceId);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await res.text();
    let parsed: any = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Algumas respostas de erro vêm em texto puro
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body: parsed,
        error: parsed?.message || parsed?.error || `HTTP ${res.status}`,
      };
    }

    // A W-API responde 200 com { error: true, message } em algumas falhas
    if (parsed && typeof parsed === "object" && parsed.error === true) {
      return { ok: false, status: res.status, body: parsed, error: parsed.message || "Erro W-API" };
    }

    return { ok: true, status: res.status, body: parsed };
  } catch (err: any) {
    return { ok: false, status: 0, body: null, error: err?.message || String(err) };
  }
}

/** POST /v1/message/send-text — disponível em todos os planos. */
export function sendText(
  creds: WApiCredentials,
  params: { phone: string; message: string; delayMessage?: number },
): Promise<WApiResult<WApiSendResponse>> {
  return wapiRequest(creds, "/v1/message/send-text", {
    body: {
      phone: params.phone,
      message: params.message,
      delayMessage: params.delayMessage ?? 3,
    },
  });
}

/**
 * POST /v1/message/send-button-list — botões de resposta rápida.
 * A escolha do usuário volta pelo webhook "Ao receber".
 *
 * ATENÇÃO: este endpoint exige plano PRO na W-API. Use
 * `sendTextWithButtons` para cair automaticamente em texto puro.
 */
export function sendButtonList(
  creds: WApiCredentials,
  params: { phone: string; message: string; buttons: { buttonId: string; label: string }[] },
): Promise<WApiResult<WApiSendResponse>> {
  return wapiRequest(creds, "/v1/message/send-button-list", {
    body: {
      phone: params.phone,
      message: params.message,
      buttons: params.buttons,
    },
  });
}

/**
 * Tenta enviar com botões e, se a instância não suportar (plano
 * inferior ao PRO ou endpoint indisponível), reenvia como texto
 * simples pedindo a confirmação por escrito.
 */
export async function sendTextWithButtons(
  creds: WApiCredentials,
  params: {
    phone: string;
    message: string;
    buttons: { buttonId: string; label: string }[];
    fallbackSuffix?: string;
    delayMessage?: number;
    /** Pula direto para o texto — útil quando já se sabe que a instância não tem plano PRO. */
    pularBotoes?: boolean;
  },
): Promise<WApiResult<WApiSendResponse> & { usouBotoes: boolean }> {
  if (!params.pularBotoes) {
    const comBotoes = await sendButtonList(creds, {
      phone: params.phone,
      message: params.message,
      buttons: params.buttons,
    });

    if (comBotoes.ok) return { ...comBotoes, usouBotoes: true };

    console.warn(`⚠️ send-button-list falhou (${comBotoes.error}) — caindo para send-text`);
  }

  const sufixo = params.fallbackSuffix ?? "\n\n✅ Responda *OK* para confirmar o recebimento.";
  const texto = await sendText(creds, {
    phone: params.phone,
    message: params.message + sufixo,
    delayMessage: params.delayMessage,
  });

  return { ...texto, usouBotoes: false };
}

/** GET /v1/instance/status-instance — checa se a instância está conectada. */
export function statusInstance(creds: WApiCredentials): Promise<WApiResult> {
  return wapiRequest(creds, "/v1/instance/status-instance", { method: "GET" });
}

/** GET /v1/contacts/phone-exists — confirma se o número tem WhatsApp. */
export function phoneExists(creds: WApiCredentials, phoneNumber: string): Promise<WApiResult> {
  return wapiRequest(creds, "/v1/contacts/phone-exists", {
    method: "GET",
    query: { phoneNumber },
  });
}

// ============================================================
// Webhook "Ao receber" (event: webhookReceived)
// ============================================================

export interface WApiIncomingMessage {
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
 * Extrai os campos que nos interessam do payload da W-API, tolerando
 * as várias formas que `msgContent` pode assumir.
 */
export function parseIncoming(payload: any): WApiIncomingMessage {
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
