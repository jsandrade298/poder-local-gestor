// ============================================================
// google-agenda-callback — o Google volta aqui depois que a pessoa
// autoriza o acesso. Troca o código pelos tokens, guarda o refresh
// token no Vault e devolve a pessoa para o Jorgeus.
// Público (o Google não manda o login do Jorgeus): a segurança vem do
// "estado" de uso único criado pela função google-agenda para aquele
// usuário, que expira em 1 hora.
// ============================================================

import { clienteAdmin, credenciais, listarCalendarios, origemPermitida, urlCallback } from "../_shared/googleAgenda.ts";

function voltar(destino: string, params: Record<string, string>) {
  const u = new URL(destino);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

function pagina(texto: string, status = 400) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>Jorgeus</title><body style="font-family:system-ui;padding:2rem"><p>${texto}</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const estado = url.searchParams.get("state");
  const codigo = url.searchParams.get("code");
  const erroGoogle = url.searchParams.get("error");
  if (!estado) return pagina("Link de conexão inválido. Volte ao Jorgeus e tente de novo.");

  const admin = clienteAdmin();
  await admin.rpc("google_agenda_limpar_estados");
  const { data: pedido } = await admin.from("google_agenda_estados").select("*").eq("estado", estado).maybeSingle();
  if (!pedido) return pagina("Este link de conexão expirou ou já foi usado. Volte ao Jorgeus e tente de novo.");
  await admin.from("google_agenda_estados").delete().eq("estado", estado); // uso único
  const destino = origemPermitida(pedido.voltar_para) ? pedido.voltar_para : null;
  if (!destino) return pagina("Endereço de retorno não permitido.");

  if (erroGoogle || !codigo) return voltar(destino, { google: "cancelado" });

  try {
    const { id, segredo } = credenciais();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: codigo, client_id: id, client_secret: segredo, redirect_uri: urlCallback(), grant_type: "authorization_code" }),
    });
    const tokens = await r.json();
    if (!r.ok) {
      console.error("troca de código falhou", tokens?.error, tokens?.error_description);
      return voltar(destino, { google: "erro" });
    }
    const escopos: string = tokens.scope || "";
    if (!escopos.includes("calendar.events")) return voltar(destino, { google: "sem_permissao" });
    if (!tokens.refresh_token) return voltar(destino, { google: "erro" });

    // Qual conta Google foi conectada
    const quem = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      .then((x) => x.json()).catch(() => ({}));

    // Agenda principal já vem escolhida (dá para trocar depois)
    let calendarios: any[] = [];
    try {
      const todas = await listarCalendarios(tokens.access_token);
      calendarios = todas.filter((c) => c.principal).slice(0, 1);
    } catch { /* sem lista: a pessoa escolhe depois */ }

    // Uma conta por gabinete (mandato) ou por pessoa (pessoal)
    let consulta = admin.from("google_agenda_contas").select("id").eq("tipo", pedido.tipo);
    consulta = pedido.tipo === "mandato" ? consulta.eq("tenant_id", pedido.tenant_id) : consulta.eq("usuario_id", pedido.usuario_id);
    const { data: existente } = await consulta.maybeSingle();

    let contaId = existente?.id as string | undefined;
    const dados = {
      tenant_id: pedido.tenant_id, tipo: pedido.tipo, usuario_id: pedido.usuario_id,
      google_email: quem?.email ?? null, calendarios, atualizado_em: new Date().toISOString(),
    };
    if (contaId) {
      const { error } = await admin.from("google_agenda_contas").update(dados).eq("id", contaId);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from("google_agenda_contas").insert(dados).select("id").single();
      if (error) throw error;
      contaId = data.id;
    }
    const { error: eT } = await admin.rpc("google_agenda_guardar_token", { p_conta: contaId, p_token: tokens.refresh_token });
    if (eT) throw eT;

    console.log(`✅ Google Agenda (${pedido.tipo}) conectado para ${pedido.usuario_id}`);
    return voltar(destino, { google: "conectado", tipo: pedido.tipo });
  } catch (e: any) {
    console.error("❌ google-agenda-callback:", e?.message);
    return voltar(destino, { google: "erro" });
  }
});
