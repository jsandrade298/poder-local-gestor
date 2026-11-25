// ============================================================
// google-agenda — tudo o que o Jorgeus faz com o Google Agenda.
//
// Corpo JSON { acao, ... }:
//   status                         o que está conectado e o que posso fazer
//   conectar     {tipo, voltarPara} devolve o endereço de autorização do Google
//   desconectar  {tipo}
//   calendarios  {tipo}            agendas da conta (para escolher quais aparecem)
//   escolher     {tipo, ids}       salva as agendas escolhidas
//   eventos      {de, ate}         eventos das duas agendas no intervalo
//   criar        {origem, calendarId, evento}
//   editar       {origem, calendarId, eventId, evento}
//   excluir      {origem, calendarId, eventId}
//   responder    {calendarId, eventId, resposta}  convite: accepted|declined|tentative
//   pedido-criar      {titulo, descricao?, local?, opcoes[{inicio,fim}], demandaId?, municipeId?}
//   pedido-decidir    {pedidoId, decisao: aprovar|recusar|contrapropor, opcao?, motivo?, mensagem?, reservado?, calendarId?}
//   pedido-responder  {pedidoId, aceitar}       quem pediu responde a uma contraproposta
//   pedido-cancelar   {pedidoId}
//   vinculados        {demandaId?|municipeId?}  eventos ligados a uma demanda/munícipe
//
// Regras:
//   - mandato: toda a equipe vê; criar/editar/excluir/conectar só para quem
//     está em agenda_editores (definido pelo super admin) ou super admin.
//   - pessoal: só o dono vê e mexe.
//   - representantes não usam a agenda.
// ============================================================

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import {
  FUSO, HttpError, SCOPES, clienteAdmin, corsHeaders, credenciais, esquecerToken, google, json,
  listarCalendarios, origemPermitida, tokenDeAcesso, urlCallback, type CalendarioEscolhido,
} from "../_shared/googleAgenda.ts";

type Tipo = "mandato" | "pessoal";

interface Quem {
  id: string; nome: string; tenantId: string; superAdmin: boolean; editor: boolean;
}

async function identificar(req: Request, admin: SupabaseClient): Promise<Quem> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "Não autenticado");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Sessão inválida — faça login novamente");
  const id = data.user.id;
  const [{ data: perfil }, { data: papeis }] = await Promise.all([
    admin.from("profiles").select("nome, tenant_id, role_no_tenant, ativo").eq("id", id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", id),
  ]);
  if (!perfil?.tenant_id) throw new HttpError(403, "Usuário sem gabinete");
  if (perfil.ativo === false) throw new HttpError(403, "Acesso desativado");
  if (perfil.role_no_tenant === "representante") throw new HttpError(403, "A agenda não está disponível para representantes");
  const superAdmin = (papeis ?? []).some((p: { role: string }) => p.role === "super_admin");
  const { data: ed } = await admin.from("agenda_editores").select("usuario_id").eq("tenant_id", perfil.tenant_id).eq("usuario_id", id).maybeSingle();
  return { id, nome: perfil.nome || "Alguém", tenantId: perfil.tenant_id, superAdmin, editor: superAdmin || !!ed };
}

async function contaDe(admin: SupabaseClient, quem: Quem, tipo: Tipo) {
  let q = admin.from("google_agenda_contas").select("id, google_email, calendarios, usuario_id, conectado_em").eq("tipo", tipo);
  q = tipo === "mandato" ? q.eq("tenant_id", quem.tenantId) : q.eq("usuario_id", quem.id);
  const { data } = await q.maybeSingle();
  return data as null | { id: string; google_email: string | null; calendarios: CalendarioEscolhido[]; usuario_id: string; conectado_em: string };
}

function exigirTipo(t: unknown): Tipo {
  if (t !== "mandato" && t !== "pessoal") throw new HttpError(400, "Agenda inválida");
  return t;
}

// ── Eventos: Google ⇄ Jorgeus ───────────────────────────────────

const podeEscrever = (papel?: string) => papel === "owner" || papel === "writer";

function normalizar(e: any, origem: Tipo, cal: CalendarioEscolhido, pode: boolean) {
  const self = (e.attendees || []).find((a: any) => a.self);
  const organizadorSou = !!e.organizer?.self;
  const editavel = pode && podeEscrever(cal.papel) && (organizadorSou || !e.attendees?.length || !!e.guestsCanModify || origem === "mandato");
  const priv = e.extendedProperties?.private || {};
  // Reservado: marcado no Jorgeus ou privado no próprio Google. Quem não pode
  // editar a agenda do mandato vê só o horário ocupado — os detalhes nem saem do servidor.
  const reservado = priv.jorgeus_reservado === "1" || e.visibility === "private" || e.visibility === "confidential";
  if (reservado && origem === "mandato" && !pode) {
    return {
      id: e.id, calendarId: cal.id, calendario: cal.nome, origem, cor: cal.cor,
      titulo: "Ocupado", descricao: "", local: "", diaInteiro: !!e.start?.date,
      inicio: e.start?.dateTime || e.start?.date, fim: e.end?.dateTime || e.end?.date,
      link: null, meet: null, recorrente: !!e.recurringEventId, organizador: null, souOrganizador: false,
      convidados: [], minhaResposta: null, podeEditar: false, podeExcluir: false,
      criadoNoJorgeusPor: null, editadoNoJorgeusPor: null, reservado: true, oculto: true,
      livre: e.transparency === "transparent", vinculos: {},
    };
  }
  return {
    id: e.id,
    calendarId: cal.id,
    calendario: cal.nome,
    origem,
    cor: cal.cor,
    titulo: e.summary || "(sem título)",
    descricao: e.description || "",
    local: e.location || "",
    diaInteiro: !!e.start?.date,
    inicio: e.start?.dateTime || e.start?.date,
    fim: e.end?.dateTime || e.end?.date,
    link: e.htmlLink,
    meet: e.hangoutLink || null,
    recorrente: !!e.recurringEventId,
    organizador: e.organizer?.displayName || e.organizer?.email || null,
    souOrganizador: organizadorSou,
    convidados: (e.attendees || []).filter((a: any) => !a.resource).map((a: any) => ({
      email: a.email, nome: a.displayName || null, resposta: a.responseStatus, organizador: !!a.organizer, eu: !!a.self,
    })),
    minhaResposta: origem === "pessoal" && self && !organizadorSou ? self.responseStatus : null,
    podeEditar: editavel,
    podeExcluir: editavel,
    criadoNoJorgeusPor: priv.jorgeus_criado_por || null,
    editadoNoJorgeusPor: priv.jorgeus_editado_por || null,
    reservado,
    oculto: false,
    /** "Disponível" no Google: não conta como ocupado */
    livre: e.transparency === "transparent",
    vinculos: { demandaId: priv.jorgeus_demanda_id || null, municipeId: priv.jorgeus_municipe_id || null, pedidoId: priv.jorgeus_pedido_id || null },
  };
}

function paraGoogle(ev: any, quem: Quem, criando: boolean) {
  if (!ev?.titulo?.trim()) throw new HttpError(400, "Dê um título ao evento");
  if (!ev.inicio || !ev.fim) throw new HttpError(400, "Informe início e fim");
  const corpo: any = {
    summary: ev.titulo.trim(),
    description: ev.descricao || "",
    location: ev.local || "",
    start: ev.diaInteiro ? { date: ev.inicio.slice(0, 10) } : { dateTime: ev.inicio, timeZone: FUSO },
    end: ev.diaInteiro ? { date: ev.fim.slice(0, 10) } : { dateTime: ev.fim, timeZone: FUSO },
    extendedProperties: { private: criando ? { jorgeus_criado_por: quem.nome } : { jorgeus_editado_por: quem.nome } },
  };
  if (typeof ev.reservado === "boolean") {
    corpo.visibility = ev.reservado ? "private" : "default";
    corpo.extendedProperties.private.jorgeus_reservado = ev.reservado ? "1" : "";
  }
  if (ev.vinculos?.demandaId) corpo.extendedProperties.private.jorgeus_demanda_id = String(ev.vinculos.demandaId);
  if (ev.vinculos?.municipeId) corpo.extendedProperties.private.jorgeus_municipe_id = String(ev.vinculos.municipeId);
  if (ev.vinculos?.pedidoId) corpo.extendedProperties.private.jorgeus_pedido_id = String(ev.vinculos.pedidoId);
  if (Array.isArray(ev.convidados)) {
    corpo.attendees = ev.convidados
      .map((c: any) => (typeof c === "string" ? { email: c } : c?.email ? { email: c.email, responseStatus: c.resposta } : null))
      .filter((c: any) => c && /.+@.+\..+/.test(c.email));
  }
  if (new Date(ev.fim).getTime() < new Date(ev.inicio).getTime()) throw new HttpError(400, "O fim precisa ser depois do início");
  return corpo;
}

/** Confere se quem pede pode escrever naquela agenda e devolve conta + token. */
async function paraEscrever(admin: SupabaseClient, quem: Quem, origem: Tipo, calendarId: string) {
  if (origem === "mandato" && !quem.editor) throw new HttpError(403, "Só os editores da agenda do mandato podem fazer isto");
  const conta = await contaDe(admin, quem, origem);
  if (!conta) throw new HttpError(404, origem === "mandato" ? "A agenda do mandato não está conectada" : "Sua agenda Google não está conectada");
  const cal = conta.calendarios.find((c) => c.id === calendarId);
  if (!cal) throw new HttpError(400, "Esta agenda não está entre as escolhidas no Jorgeus");
  if (!podeEscrever(cal.papel)) throw new HttpError(403, "A conta conectada não tem permissão para alterar esta agenda no Google");
  return { conta, cal, token: await tokenDeAcesso(admin, conta.id) };
}


// ── Pedidos de agenda ───────────────────────────────────────────

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function validarOpcao(o: any) {
  if (!o?.inicio || !o?.fim) throw new HttpError(400, "Cada opção precisa de início e fim");
  const a = new Date(o.inicio), b = new Date(o.fim);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) throw new HttpError(400, "Data inválida");
  if (b <= a) throw new HttpError(400, "O fim precisa ser depois do início");
  return { inicio: a.toISOString(), fim: b.toISOString() };
}

async function avisar(admin: SupabaseClient, tenantId: string, para: string[], de: string, titulo: string, mensagem: string) {
  const linhas = [...new Set(para)].filter((id) => id && id !== de).map((destinatario_id) => ({
    destinatario_id, remetente_id: de, tipo: "agenda", titulo, mensagem, url_destino: "/agenda?pedidos=1", tenant_id: tenantId,
  }));
  if (linhas.length) await admin.from("notificacoes").insert(linhas);
}

async function editoresDo(admin: SupabaseClient, tenantId: string) {
  const { data } = await admin.from("agenda_editores").select("usuario_id").eq("tenant_id", tenantId);
  return (data ?? []).map((r: any) => r.usuario_id as string);
}

async function pedidoDo(admin: SupabaseClient, quem: Quem, id: string) {
  const { data } = await admin.from("pedidos_agenda").select("*").eq("id", id).eq("tenant_id", quem.tenantId).maybeSingle();
  if (!data) throw new HttpError(404, "Pedido não encontrado");
  return data as any;
}

/** Cria o evento do pedido na agenda do mandato (com o token do mandato). */
async function criarEventoDoPedido(admin: SupabaseClient, quem: Quem, pedido: any, horario: { inicio: string; fim: string }, opts: { reservado?: boolean; calendarId?: string; aprovadoPor: string }) {
  const conta = await contaDe(admin, quem, "mandato");
  if (!conta) throw new HttpError(409, "A agenda do mandato não está conectada");
  const cal = (opts.calendarId ? conta.calendarios.find((c) => c.id === opts.calendarId) : null) ?? conta.calendarios.find((c) => podeEscrever(c.papel));
  if (!cal || !podeEscrever(cal.papel)) throw new HttpError(403, "Nenhuma agenda do mandato aceita novos eventos");
  const { data: solicitante } = await admin.from("profiles").select("nome").eq("id", pedido.solicitante_id).maybeSingle();
  const corpo = paraGoogle({
    titulo: pedido.titulo,
    descricao: [pedido.descricao || "", `Pedido por ${solicitante?.nome || "alguém da equipe"} no Jorgeus; aprovado por ${opts.aprovadoPor}.`].filter(Boolean).join("\n\n"),
    local: pedido.local || "", diaInteiro: false, inicio: horario.inicio, fim: horario.fim,
    reservado: !!opts.reservado,
    vinculos: { pedidoId: pedido.id, demandaId: pedido.demanda_id, municipeId: pedido.municipe_id },
  }, quem, true);
  const token = await tokenDeAcesso(admin, conta.id);
  const ev = await google(token, `/calendars/${encodeURIComponent(cal.id)}/events`, { method: "POST", body: JSON.stringify(corpo), query: { sendUpdates: "none" } });
  // A demanda ligada ganha o registro na linha do tempo
  if (pedido.demanda_id) {
    await admin.from("demanda_atividades").insert({
      demanda_id: pedido.demanda_id, created_by: quem.id, tipo_atividade: "comentario", tenant_id: quem.tenantId,
      titulo: `Agenda marcada: ${pedido.titulo}`, descricao: `${fmt(horario.inicio)} · agenda do mandato`,
    });
  }
  return { calendarId: cal.id, eventId: ev.id as string };
}

// ── Servidor ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = clienteAdmin();
    const quem = await identificar(req, admin);
    const body = await req.json().catch(() => ({}));
    const acao = body.acao as string;

    switch (acao) {
      case "status": {
        let configurado = true;
        try { credenciais(); } catch { configurado = false; }
        const [m, p] = await Promise.all([contaDe(admin, quem, "mandato"), contaDe(admin, quem, "pessoal")]);
        let conectadoPor: string | null = null;
        if (m?.usuario_id) {
          const { data } = await admin.from("profiles").select("nome").eq("id", m.usuario_id).maybeSingle();
          conectadoPor = data?.nome ?? null;
        }
        return json({
          configurado,
          souEditorMandato: quem.editor,
          mandato: m ? { email: m.google_email, calendarios: m.calendarios, conectadoPor, conectadoEm: m.conectado_em } : null,
          pessoal: p ? { email: p.google_email, calendarios: p.calendarios, conectadoEm: p.conectado_em } : null,
        });
      }

      case "conectar": {
        const tipo = exigirTipo(body.tipo);
        if (tipo === "mandato" && !quem.editor) throw new HttpError(403, "Só os editores da agenda do mandato podem conectá-la");
        const voltarPara = String(body.voltarPara || "");
        if (!origemPermitida(voltarPara)) throw new HttpError(400, "Endereço de retorno não permitido");
        const { id } = credenciais();
        const estado = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
        const { error } = await admin.from("google_agenda_estados").insert({ estado, tenant_id: quem.tenantId, usuario_id: quem.id, tipo, voltar_para: voltarPara });
        if (error) throw new HttpError(500, error.message);
        const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        u.searchParams.set("client_id", id);
        u.searchParams.set("redirect_uri", urlCallback());
        u.searchParams.set("response_type", "code");
        u.searchParams.set("scope", SCOPES.join(" "));
        u.searchParams.set("access_type", "offline");
        u.searchParams.set("prompt", "consent select_account");
        u.searchParams.set("include_granted_scopes", "true");
        u.searchParams.set("state", estado);
        return json({ url: u.toString() });
      }

      case "desconectar": {
        const tipo = exigirTipo(body.tipo);
        if (tipo === "mandato" && !quem.editor) throw new HttpError(403, "Só os editores da agenda do mandato podem desconectá-la");
        const conta = await contaDe(admin, quem, tipo);
        if (!conta) return json({ success: true });
        // Revoga no Google (se der) e apaga a conexão e o token do Vault
        try {
          const { data: refresh } = await admin.rpc("google_agenda_ler_token", { p_conta: conta.id });
          if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh as string)}`, { method: "POST" });
        } catch { /* segue: a conexão sai de qualquer jeito */ }
        esquecerToken(conta.id);
        const { error } = await admin.rpc("google_agenda_apagar_conta", { p_conta: conta.id });
        if (error) throw new HttpError(500, error.message);
        return json({ success: true });
      }

      case "calendarios": {
        const tipo = exigirTipo(body.tipo);
        const conta = await contaDe(admin, quem, tipo);
        if (!conta) throw new HttpError(404, "Agenda não conectada");
        const todas = await listarCalendarios(await tokenDeAcesso(admin, conta.id));
        const atuais = new Map(conta.calendarios.map((c: any) => [c.id, c]));
        return json({ calendarios: todas.map((c) => {
          const a: any = atuais.get(c.id);
          return { ...c, escolhida: !!a, ...(a?.corPersonalizada ? { cor: a.cor, corPersonalizada: true } : {}) };
        }) });
      }

      case "escolher": {
        const tipo = exigirTipo(body.tipo);
        if (tipo === "mandato" && !quem.editor) throw new HttpError(403, "Só os editores da agenda do mandato escolhem as agendas mostradas");
        const conta = await contaDe(admin, quem, tipo);
        if (!conta) throw new HttpError(404, "Agenda não conectada");
        const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
        if (ids.length === 0) throw new HttpError(400, "Escolha pelo menos uma agenda");
        const todas = await listarCalendarios(await tokenDeAcesso(admin, conta.id));
        const cores: Record<string, string> = body.cores && typeof body.cores === "object" ? body.cores : {};
        const corValida = (c: unknown) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
        const escolhidas = todas.filter((c) => ids.includes(c.id)).map((c) => {
          const antes = conta.calendarios.find((x: any) => x.id === c.id) as any;
          if (corValida(cores[c.id])) return { ...c, cor: cores[c.id], corPersonalizada: true };
          if (antes?.corPersonalizada) return { ...c, cor: antes.cor, corPersonalizada: true };
          return c;
        });
        const { error } = await admin.from("google_agenda_contas").update({ calendarios: escolhidas, atualizado_em: new Date().toISOString() }).eq("id", conta.id);
        if (error) throw new HttpError(500, error.message);
        return json({ success: true, calendarios: escolhidas });
      }

      case "eventos": {
        const de = String(body.de || ""), ate = String(body.ate || "");
        if (!de || !ate) throw new HttpError(400, "Informe o período");
        const contas = (await Promise.all((["mandato", "pessoal"] as Tipo[]).map(async (t) => ({ t, c: await contaDe(admin, quem, t) }))))
          .filter((x) => x.c && x.c.calendarios.length > 0);
        const avisos: { origem: Tipo; codigo?: string; mensagem: string }[] = [];
        const listas = await Promise.all(contas.map(async ({ t, c }) => {
          try {
            const token = await tokenDeAcesso(admin, c!.id);
            const porCal = await Promise.all(c!.calendarios.map(async (cal) => {
              const r = await google(token, `/calendars/${encodeURIComponent(cal.id)}/events`, {
                query: { timeMin: de, timeMax: ate, singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: FUSO },
              });
              return (r?.items ?? []).filter((e: any) => e.status !== "cancelled")
                .map((e: any) => normalizar(e, t, cal, t === "pessoal" || quem.editor));
            }));
            return porCal.flat();
          } catch (e: any) {
            avisos.push({ origem: t, codigo: e?.codigo, mensagem: e?.message || "Falha ao ler a agenda" });
            return [];
          }
        }));
        const eventos = listas.flat().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
        return json({ eventos, avisos });
      }

      case "criar": {
        const origem = exigirTipo(body.origem);
        const { cal, token } = await paraEscrever(admin, quem, origem, String(body.calendarId));
        const corpo = paraGoogle(body.evento, quem, true);
        const r = await google(token, `/calendars/${encodeURIComponent(cal.id)}/events`, {
          method: "POST", body: JSON.stringify(corpo),
          query: { sendUpdates: corpo.attendees?.length ? "all" : "none" },
        });
        return json({ evento: normalizar(r, origem, cal, true) });
      }

      case "editar": {
        const origem = exigirTipo(body.origem);
        const { cal, token } = await paraEscrever(admin, quem, origem, String(body.calendarId));
        const corpo = paraGoogle(body.evento, quem, false);
        const r = await google(token, `/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(String(body.eventId))}`, {
          method: "PATCH", body: JSON.stringify(corpo), query: { sendUpdates: "all" },
        });
        return json({ evento: normalizar(r, origem, cal, true) });
      }

      case "excluir": {
        const origem = exigirTipo(body.origem);
        const { cal, token } = await paraEscrever(admin, quem, origem, String(body.calendarId));
        await google(token, `/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(String(body.eventId))}`, {
          method: "DELETE", query: { sendUpdates: "all" },
        });
        return json({ success: true });
      }

      case "responder": {
        const resposta = String(body.resposta);
        if (!["accepted", "declined", "tentative"].includes(resposta)) throw new HttpError(400, "Resposta inválida");
        const conta = await contaDe(admin, quem, "pessoal");
        if (!conta) throw new HttpError(404, "Sua agenda Google não está conectada");
        const token = await tokenDeAcesso(admin, conta.id);
        const caminho = `/calendars/${encodeURIComponent(String(body.calendarId))}/events/${encodeURIComponent(String(body.eventId))}`;
        const atual = await google(token, caminho);
        const convidados = (atual?.attendees || []) as any[];
        if (!convidados.some((a) => a.self)) throw new HttpError(400, "Você não está na lista de convidados deste evento");
        const novos = convidados.map((a) => (a.self ? { ...a, responseStatus: resposta } : a));
        await google(token, caminho, { method: "PATCH", body: JSON.stringify({ attendees: novos }), query: { sendUpdates: "all" } });
        return json({ success: true });
      }

      case "pedido-criar": {
        const titulo = String(body.titulo || "").trim();
        if (!titulo) throw new HttpError(400, "Dê um título ao pedido");
        const opcoes = (Array.isArray(body.opcoes) ? body.opcoes : []).slice(0, 3).map(validarOpcao);
        if (opcoes.length === 0) throw new HttpError(400, "Informe pelo menos uma opção de horário");
        const { data, error } = await admin.from("pedidos_agenda").insert({
          tenant_id: quem.tenantId, solicitante_id: quem.id, titulo,
          descricao: body.descricao ? String(body.descricao) : null, local: body.local ? String(body.local) : null,
          opcoes, demanda_id: body.demandaId || null, municipe_id: body.municipeId || null,
        }).select("id").single();
        if (error) throw new HttpError(500, error.message);
        await avisar(admin, quem.tenantId, await editoresDo(admin, quem.tenantId), quem.id,
          "Novo pedido de agenda", `${quem.nome} pediu "${titulo}" (${opcoes.length} opção${opcoes.length > 1 ? "ões" : ""}: ${opcoes.map((o: any) => fmt(o.inicio)).join(" · ")})`);
        return json({ success: true, id: data.id });
      }

      case "pedido-decidir": {
        if (!quem.editor) throw new HttpError(403, "Só os editores da agenda do mandato decidem os pedidos");
        const pedido = await pedidoDo(admin, quem, String(body.pedidoId));
        if (!["pendente", "contraproposta"].includes(pedido.status)) throw new HttpError(409, "Este pedido já foi decidido");
        const agora = new Date().toISOString();
        const decisao = String(body.decisao);
        if (decisao === "aprovar") {
          const horario = validarOpcao(body.opcao);
          const ev = await criarEventoDoPedido(admin, quem, pedido, horario, { reservado: !!body.reservado, calendarId: body.calendarId, aprovadoPor: quem.nome });
          await admin.from("pedidos_agenda").update({
            status: "aprovado", escolhida: horario, decidido_por: quem.id, decidido_em: agora,
            google_calendar_id: ev.calendarId, google_event_id: ev.eventId, reservado: !!body.reservado, contraproposta: null,
          }).eq("id", pedido.id);
          await avisar(admin, quem.tenantId, [pedido.solicitante_id], quem.id, "Pedido de agenda aprovado", `"${pedido.titulo}" entrou na agenda do mandato: ${fmt(horario.inicio)}`);
          return json({ success: true, ...ev });
        }
        if (decisao === "recusar") {
          const motivo = String(body.motivo || "").trim() || null;
          await admin.from("pedidos_agenda").update({ status: "recusado", motivo, decidido_por: quem.id, decidido_em: agora }).eq("id", pedido.id);
          await avisar(admin, quem.tenantId, [pedido.solicitante_id], quem.id, "Pedido de agenda recusado", `"${pedido.titulo}"${motivo ? `: ${motivo}` : ""}`);
          return json({ success: true });
        }
        if (decisao === "contrapropor") {
          const horario = validarOpcao(body.opcao);
          const contraproposta = { ...horario, mensagem: String(body.mensagem || "").trim() || null };
          await admin.from("pedidos_agenda").update({ status: "contraproposta", contraproposta, decidido_por: quem.id, decidido_em: agora }).eq("id", pedido.id);
          await avisar(admin, quem.tenantId, [pedido.solicitante_id], quem.id, "Outro horário proposto",
            `Para "${pedido.titulo}": ${fmt(horario.inicio)}${contraproposta.mensagem ? ` — ${contraproposta.mensagem}` : ""}. Responda na Agenda.`);
          return json({ success: true });
        }
        throw new HttpError(400, "Decisão inválida");
      }

      case "pedido-responder": {
        const pedido = await pedidoDo(admin, quem, String(body.pedidoId));
        if (pedido.solicitante_id !== quem.id) throw new HttpError(403, "Só quem fez o pedido responde à contraproposta");
        if (pedido.status !== "contraproposta" || !pedido.contraproposta) throw new HttpError(409, "Não há contraproposta para responder");
        const editor = pedido.decidido_por as string | null;
        if (body.aceitar) {
          const horario = { inicio: pedido.contraproposta.inicio, fim: pedido.contraproposta.fim };
          const { data: quemDecidiu } = await admin.from("profiles").select("nome").eq("id", editor).maybeSingle();
          const ev = await criarEventoDoPedido(admin, quem, pedido, horario, { aprovadoPor: quemDecidiu?.nome || "um editor da agenda" });
          await admin.from("pedidos_agenda").update({ status: "aprovado", escolhida: horario, google_calendar_id: ev.calendarId, google_event_id: ev.eventId }).eq("id", pedido.id);
          if (editor) await avisar(admin, quem.tenantId, [editor], quem.id, "Contraproposta aceita", `"${pedido.titulo}" ficou para ${fmt(horario.inicio)}`);
          return json({ success: true, ...ev });
        }
        await admin.from("pedidos_agenda").update({ status: "cancelado", motivo: "Contraproposta não aceita" }).eq("id", pedido.id);
        if (editor) await avisar(admin, quem.tenantId, [editor], quem.id, "Contraproposta não aceita", `"${pedido.titulo}" foi cancelado por ${quem.nome}`);
        return json({ success: true });
      }

      case "pedido-cancelar": {
        const pedido = await pedidoDo(admin, quem, String(body.pedidoId));
        if (pedido.solicitante_id !== quem.id) throw new HttpError(403, "Só quem fez o pedido pode cancelá-lo");
        if (!["pendente", "contraproposta"].includes(pedido.status)) throw new HttpError(409, "Este pedido já foi decidido");
        await admin.from("pedidos_agenda").update({ status: "cancelado", motivo: "Cancelado por quem pediu" }).eq("id", pedido.id);
        return json({ success: true });
      }

      case "vinculados": {
        const chave = body.demandaId ? "jorgeus_demanda_id" : body.municipeId ? "jorgeus_municipe_id" : null;
        const valor = String(body.demandaId || body.municipeId || "");
        if (!chave || !valor) throw new HttpError(400, "Informe a demanda ou o munícipe");
        const de = new Date(Date.now() - 365 * 86_400_000).toISOString(), ate = new Date(Date.now() + 365 * 86_400_000).toISOString();
        const contas = (await Promise.all((["mandato", "pessoal"] as Tipo[]).map(async (t) => ({ t, c: await contaDe(admin, quem, t) })))).filter((x) => x.c);
        const listas = await Promise.all(contas.map(async ({ t, c }) => {
          try {
            const token = await tokenDeAcesso(admin, c!.id);
            const porCal = await Promise.all(c!.calendarios.map(async (cal) => {
              const r = await google(token, `/calendars/${encodeURIComponent(cal.id)}/events`, {
                query: { timeMin: de, timeMax: ate, singleEvents: "true", orderBy: "startTime", maxResults: "100", privateExtendedProperty: `${chave}=${valor}` },
              });
              return (r?.items ?? []).filter((e: any) => e.status !== "cancelled").map((e: any) => normalizar(e, t, cal, t === "pessoal" || quem.editor));
            }));
            return porCal.flat();
          } catch { return []; }
        }));
        return json({ eventos: listas.flat().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))) });
      }

      default:
        throw new HttpError(400, "Ação inválida");
    }
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("❌ google-agenda:", e?.message);
    return json({ success: false, error: e?.message || "Erro interno", codigo: e?.codigo }, status);
  }
});
