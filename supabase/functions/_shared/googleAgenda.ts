// ============================================================
// Google Agenda — peças comuns às funções google-agenda e
// google-agenda-callback (Jorgeus, 25/11/2026).
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export const FUSO = "America/Sao_Paulo";

export class HttpError extends Error {
  constructor(public status: number, message: string, public codigo?: string) { super(message); }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function credenciais() {
  const id = Deno.env.get("GOOGLE_CLIENT_ID");
  const segredo = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !segredo) throw new HttpError(500, "A integração com o Google ainda não foi configurada no servidor", "nao_configurado");
  return { id, segredo };
}

export function urlCallback() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-agenda-callback`;
}

/** Só voltamos para endereços do próprio app (evita redirecionar para sites de terceiros). */
export function origemPermitida(url: string) {
  try {
    const u = new URL(url);
    const extras = (Deno.env.get("APP_ORIGENS") || "").split(",").map((s) => s.trim()).filter(Boolean);
    return (
      u.hostname === "localhost" || u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".netlify.app") || extras.includes(u.origin)
    ) && (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

// ── Tokens ──────────────────────────────────────────────────────

const cache = new Map<string, { token: string; expira: number }>();

/** Token de acesso de uma conta (renova com o refresh token guardado no Vault). */
export async function tokenDeAcesso(admin: SupabaseClient, contaId: string): Promise<string> {
  const c = cache.get(contaId);
  if (c && c.expira > Date.now() + 60_000) return c.token;

  const { data: refresh, error } = await admin.rpc("google_agenda_ler_token", { p_conta: contaId });
  if (error) throw new HttpError(500, "Não foi possível ler a conexão com o Google");
  if (!refresh) throw new HttpError(409, "A conexão com o Google precisa ser refeita", "reconectar");

  const { id, segredo } = credenciais();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: refresh as string, grant_type: "refresh_token" }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    // invalid_grant = a pessoa revogou o acesso no Google (ou a conexão expirou)
    if (corpo?.error === "invalid_grant") throw new HttpError(409, "O acesso ao Google foi revogado ou expirou. Conecte de novo.", "reconectar");
    throw new HttpError(502, "O Google não respondeu como esperado");
  }
  cache.set(contaId, { token: corpo.access_token, expira: Date.now() + (corpo.expires_in ?? 3600) * 1000 });
  return corpo.access_token;
}

export function esquecerToken(contaId: string) { cache.delete(contaId); }

/** Chamada à API do Google Agenda com tratamento de erro legível. */
export async function google(token: string, caminho: string, init: RequestInit & { query?: Record<string, string> } = {}) {
  const url = new URL(caminho.startsWith("http") ? caminho : `https://www.googleapis.com/calendar/v3${caminho}`);
  Object.entries(init.query || {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (r.status === 204) return null;
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = corpo?.error?.message || `Erro ${r.status} no Google Agenda`;
    if (r.status === 401) throw new HttpError(409, "A conexão com o Google precisa ser refeita", "reconectar");
    if (r.status === 403) throw new HttpError(403, "O Google não deu permissão para esta ação nesta agenda");
    if (r.status === 404 || r.status === 410) throw new HttpError(404, "O evento não existe mais no Google Agenda");
    throw new HttpError(r.status >= 500 ? 502 : 400, msg);
  }
  return corpo;
}

export interface CalendarioEscolhido { id: string; nome: string; cor: string; papel: string; principal?: boolean; corPersonalizada?: boolean }

/** Agendas da conta (lista do Google), no formato do Jorgeus. */
export async function listarCalendarios(token: string): Promise<CalendarioEscolhido[]> {
  const itens: any[] = [];
  let pagina: string | undefined;
  do {
    const r = await google(token, "/users/me/calendarList", { query: { maxResults: "250", ...(pagina ? { pageToken: pagina } : {}) } });
    itens.push(...(r?.items ?? []));
    pagina = r?.nextPageToken;
  } while (pagina);
  return itens
    .filter((c) => !c.deleted && !c.hidden)
    .map((c) => ({ id: c.id, nome: c.summaryOverride || c.summary || c.id, cor: c.backgroundColor || "#4285F4", papel: c.accessRole, principal: !!c.primary }))
    .sort((a, b) => Number(!!b.principal) - Number(!!a.principal) || a.nome.localeCompare(b.nome, "pt-BR"));
}
