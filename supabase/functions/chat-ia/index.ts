// /functions/chat-ia/index.ts
// Deno + Supabase Edge Function

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Content-Type": "application/json",
} as const;

type ChatRole = "system" | "user" | "assistant";

type HistoryItem = {
  role: ChatRole;
  content: string;
};

type DocumentoCtx = {
  nome: string;
  categoria?: string;
  conteudo?: string;
};

const ALLOWED_MODELS = ["gpt-5", "gpt-5-mini"] as const;
type AllowedModel = typeof ALLOWED_MODELS[number];

const MAX_DOC_CHARS = 10_000; // truncamento por documento
const MAX_DOCS = 12;          // segurança para contexto

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders } });
}
const ok = (b: unknown) => json(200, b);
const bad = (e: string | Record<string, unknown>) =>
  json(400, typeof e === "string" ? { error: e } : e);
const err = (e: unknown) => json(500, { error: String(e) });

function isHistoryArray(x: unknown): x is HistoryItem[] {
  return Array.isArray(x) && x.every(
    i => i && typeof i === "object" && ["system","user","assistant"].includes((i as any).role) && typeof (i as any).content === "string"
  );
}

function sanitizeHistory(arr: HistoryItem[] | undefined): HistoryItem[] {
  if (!arr) return [];
  // remove vazios e força tipos válidos
  return arr
    .map(i => ({
      role: (["system","user","assistant"].includes(i.role) ? i.role : "user") as ChatRole,
      content: String(i.content ?? "").trim()
    }))
    .filter(i => i.content.length > 0);
}

function truncate(s: string, max = MAX_DOC_CHARS) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n\n...[TRUNCADO]";
}

function buildContext(docs: DocumentoCtx[]) {
  if (!docs?.length) return "";
  const limited = docs.slice(0, MAX_DOCS);
  const blocks = limited.map((d, idx) => {
    const head = `[DOCUMENTO ${idx + 1}: ${d.nome}${d.categoria ? " – " + d.categoria : ""}]`;
    const body = truncate((d.conteudo ?? "").toString());
    return `${head}\n${body}`;
  });
  return `\n\n=== DOCUMENTOS DE REFERÊNCIA (SELECIONADOS) ===\n${blocks.join(
    "\n\n---\n\n",
  )}\n=== FIM DOS DOCUMENTOS ===\n`;
}

const SYSTEM_PROMPT = `
Você é um Assessor Legislativo Municipal (Brasil). Redija requerimentos, indicações, projetos de lei, moções e ofícios.
• Use linguagem formal, objetiva e impessoal.
• Siga a hierarquia Art., §, incisos (I, II...), alíneas (a), (b)).
• Fundamente-se apenas no que estiver no contexto do usuário e nos DOCUMENTOS DE REFERÊNCIA (SELECIONADOS).
• Se faltar base, responda assim mesmo de forma genérica, mas sem inventar citações específicas.
`.trim();

serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders } });
    }

    // Healthcheck
    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("healthz") === "1") {
        return ok({ ok: true });
      }
      return bad("Use POST para conversar com a IA (ou ?healthz=1 para healthcheck).");
    }

    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // Leitura e validação do body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return bad("JSON inválido no corpo da requisição.");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return bad("Chave da API OpenAI não configurada.");

    const message = String(body?.message ?? "").trim();
    const rawHistory = body?.conversationHistory;
    const documentosContexto = (body?.documentosContexto ?? []) as DocumentoCtx[];
    let model: AllowedModel = (body?.model ?? "gpt-5-mini") as AllowedModel;

    if (!message) return bad("Mensagem é obrigatória.");
    if (!ALLOWED_MODELS.includes(model)) {
      return bad(`Modelo inválido. Use um de: ${ALLOWED_MODELS.join(", ")}`);
    }

    const history = isHistoryArray(rawHistory)
      ? sanitizeHistory(rawHistory)
      : [];

    // Monta contexto dos documentos (apenas selecionados + truncados)
    const ctxBlock = buildContext(documentosContexto);

    // Monta mensagens (spread correto!)
    const messages = [
      { role: "system", content: SYSTEM_PROMPT + ctxBlock },
      ...history,
      { role: "user", content: message },
    ] as { role: ChatRole; content: string }[];

    // Parâmetros (ajuste conforme sua UI)
    const temperature = typeof body?.temperature === "number" ? body.temperature : 0.2;
    const maxTokens = typeof body?.maxTokens === "number" ? body.maxTokens : 1024;

    // Log útil para diagnóstico
    console.log("chat-ia request >", {
      model,
      hasMessage: !!message,
      historyLen: history.length,
      docs: documentosContexto.length,
      temperature,
      maxTokens,
    });

    // Chamada OpenAI (Chat Completions) — usa max_tokens (correto)
    const openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const rawText = await openaiRes.text();

    if (!openaiRes.ok) {
      console.error("OpenAI error", openaiRes.status, rawText);
      return bad({
        error: "Erro da OpenAI",
        status: openaiRes.status,
        details: rawText,
      });
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("OpenAI JSON parse error", rawText);
      return bad({ error: "Resposta inválida da OpenAI", details: rawText });
    }

    const content =
      data?.choices?.[0]?.message?.content?.toString()?.trim() ?? "";

    return ok({
      message: content,
      modelUsed: model,
      conversationId: body?.conversationId ?? null,
    });
  } catch (e) {
    console.error("chat-ia fatal error", e);
    return err(e);
  }
});