// ============================================================
// delete-user — usado pela página Usuários do gabinete.
//
// Antes: verify_jwt desligado e nenhuma checagem do chamador —
// qualquer pessoa apagava qualquer usuário (e os dados dele).
// Agora: token verificado no servidor de Auth, chamador precisa
// ser admin do gabinete (ou super admin), o usuário-alvo precisa
// ser do mesmo gabinete e ninguém apaga a si mesmo.
//
// A limpeza de referências (passos 1 a 5) é a mesma da versão
// que estava publicada.
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Chamador {
  userId: string;
  tenantId: string | null;
  superAdmin: boolean;
}

/** Valida o token no servidor de Auth e exige admin do gabinete ou super admin. */
async function identificarChamador(req: Request, admin: SupabaseClient): Promise<Chamador> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new HttpError(401, "Não autenticado");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Sessão inválida — faça login novamente");

  const userId = data.user.id;
  const [{ data: perfil }, { data: papeis }] = await Promise.all([
    admin.from("profiles").select("tenant_id, role_no_tenant").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const superAdmin = (papeis ?? []).some((p: { role: string }) => p.role === "super_admin");
  if (!superAdmin && perfil?.role_no_tenant !== "admin") {
    throw new HttpError(403, "Apenas administradores do gabinete podem fazer isto");
  }
  if (!superAdmin && !perfil?.tenant_id) {
    throw new HttpError(403, "Usuário sem gabinete");
  }

  return { userId, tenantId: perfil?.tenant_id ?? null, superAdmin };
}

/** Impede agir sobre usuário de outro gabinete ou sobre um super admin. */
async function garantirAlvoNoMesmoGabinete(admin: SupabaseClient, chamador: Chamador, alvoId: string) {
  if (chamador.superAdmin) return;

  const [{ data: alvo }, { data: papeis }] = await Promise.all([
    admin.from("profiles").select("tenant_id").eq("id", alvoId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", alvoId),
  ]);

  if (!alvo || alvo.tenant_id !== chamador.tenantId) {
    throw new HttpError(403, "Usuário não pertence ao seu gabinete");
  }
  if ((papeis ?? []).some((p: { role: string }) => p.role === "super_admin")) {
    throw new HttpError(403, "Não é permitido excluir um super admin");
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const chamador = await identificarChamador(req, supabase);

    const body = await req.json();
    // Aceitar tanto { userId } quanto { user_id } para compatibilidade
    const userId = body.userId || body.user_id;
    if (!userId) throw new HttpError(400, "User ID é obrigatório");
    if (userId === chamador.userId) throw new HttpError(400, "Você não pode excluir o seu próprio usuário");

    await garantirAlvoNoMesmoGabinete(supabase, chamador, userId);

    console.log(`🗑️ Excluindo usuário ${userId} a pedido de ${chamador.userId}`);

    // ============================================================
    // 1. LIMPAR REFERÊNCIAS EM TABELAS QUE REFERENCIAM profiles(id)
    // ============================================================

    const { error: e1 } = await supabase
      .from("notificacoes")
      .delete()
      .or(`destinatario_id.eq.${userId},remetente_id.eq.${userId}`);
    if (e1) console.warn("⚠️ notificacoes:", e1.message);

    const { error: e2 } = await supabase.from("tarefa_colaboradores").delete().eq("colaborador_id", userId);
    if (e2) console.warn("⚠️ tarefa_colaboradores:", e2.message);

    const { error: e3 } = await supabase.from("tarefa_comentarios").delete().eq("autor_id", userId);
    if (e3) console.warn("⚠️ tarefa_comentarios:", e3.message);

    const { error: e4 } = await supabase.from("tarefa_prazo_notificacoes").delete().eq("destinatario_id", userId);
    if (e4) console.warn("⚠️ tarefa_prazo_notificacoes:", e4.message);

    const { error: e5 } = await supabase.from("kanban_historico").update({ movido_por: null }).eq("movido_por", userId);
    if (e5) console.warn("⚠️ kanban_historico:", e5.message);

    // created_by é NOT NULL — as atividades do usuário são removidas
    const { error: e6 } = await supabase.from("demanda_atividades").delete().eq("created_by", userId);
    if (e6) console.warn("⚠️ demanda_atividades:", e6.message);

    const { error: e7 } = await supabase.from("municipe_atividades").delete().eq("created_by", userId);
    if (e7) console.warn("⚠️ municipe_atividades:", e7.message);

    const { error: e8a } = await supabase.from("planos_acao").update({ responsavel_id: null }).eq("responsavel_id", userId);
    if (e8a) console.warn("⚠️ planos_acao responsavel:", e8a.message);

    // planos_acao.created_by é NOT NULL
    const { error: e8b } = await supabase.from("planos_acao").delete().eq("created_by", userId);
    if (e8b) console.warn("⚠️ planos_acao created_by:", e8b.message);

    const { error: e9 } = await supabase.from("projeto_atualizacoes").update({ autor_id: null }).eq("autor_id", userId);
    if (e9) console.warn("⚠️ projeto_atualizacoes:", e9.message);

    const { error: e10 } = await supabase
      .from("planilha_linha_atualizacoes")
      .update({ autor_id: null })
      .eq("autor_id", userId);
    if (e10) console.warn("⚠️ planilha_linha_atualizacoes:", e10.message);

    const { error: e11a } = await supabase.from("projetos_plano").update({ responsavel_id: null }).eq("responsavel_id", userId);
    if (e11a) console.warn("⚠️ projetos_plano responsavel:", e11a.message);

    // ============================================================
    // 2. LIMPAR REFERÊNCIAS EM TABELAS QUE REFERENCIAM auth.users(id)
    // ============================================================

    const { error: e12a } = await supabase.from("demandas").update({ responsavel_id: null }).eq("responsavel_id", userId);
    if (e12a) console.warn("⚠️ demandas responsavel:", e12a.message);

    // demandas.criado_por é NOT NULL — mantido como referência órfã

    const { error: e13 } = await supabase.from("tarefas").update({ responsavel_id: null }).eq("responsavel_id", userId);
    if (e13) console.warn("⚠️ tarefas responsavel:", e13.message);

    const { error: e14 } = await supabase.from("agenda_acompanhantes").delete().eq("usuario_id", userId);
    if (e14) console.warn("⚠️ agenda_acompanhantes:", e14.message);

    const { error: e14b } = await supabase.from("agenda_mensagens").delete().eq("remetente_id", userId);
    if (e14b) console.warn("⚠️ agenda_mensagens:", e14b.message);

    const { error: e15 } = await supabase.from("areas").update({ responsavel_id: null }).eq("responsavel_id", userId);
    if (e15) console.warn("⚠️ areas:", e15.message);

    // uploaded_by é NOT NULL
    const { error: e16 } = await supabase.from("anexos").delete().eq("uploaded_by", userId);
    if (e16) console.warn("⚠️ anexos:", e16.message);

    const { error: e17 } = await supabase.from("camadas_geograficas").update({ created_by: null }).eq("created_by", userId);
    if (e17) console.warn("⚠️ camadas_geograficas:", e17.message);

    const { error: e18 } = await supabase.from("dados_eleitorais").update({ created_by: null }).eq("created_by", userId);
    if (e18) console.warn("⚠️ dados_eleitorais:", e18.message);

    const { error: e19 } = await supabase.from("conversations").delete().eq("user_id", userId);
    if (e19) console.warn("⚠️ conversations:", e19.message);

    // Rotas: usuario_id é NOT NULL
    const { data: rotasDoUsuario } = await supabase.from("rotas").select("id").eq("usuario_id", userId);
    if (rotasDoUsuario && rotasDoUsuario.length > 0) {
      const rotaIds = rotasDoUsuario.map((r: { id: string }) => r.id);
      await supabase.from("kanban_rotas").delete().in("rota_id", rotaIds);
      await supabase.from("rota_pontos").delete().in("rota_id", rotaIds);
      const { error: eRotas } = await supabase.from("rotas").delete().eq("usuario_id", userId);
      if (eRotas) console.warn("⚠️ rotas:", eRotas.message);
    }

    const { error: e20 } = await supabase.from("user_integrations").delete().eq("user_id", userId);
    if (e20) console.warn("⚠️ user_integrations:", e20.message);

    // ============================================================
    // 3. user_roles   4. profile   5. auth user
    // ============================================================
    const { error: eRoles } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (eRoles) console.warn("⚠️ user_roles:", eRoles.message);

    const { error: eProfile } = await supabase.from("profiles").delete().eq("id", userId);
    if (eProfile) console.warn("⚠️ profiles:", eProfile.message);

    const { error: eAuth } = await supabase.auth.admin.deleteUser(userId);
    if (eAuth) {
      throw new HttpError(500, `Erro ao excluir usuário da autenticação: ${eAuth.message}`);
    }

    console.log("✅ Usuário excluído com sucesso!");
    return json({ success: true, message: "Usuário excluído com sucesso" });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("❌ delete-user:", error?.message);
    return json({ success: false, error: error?.message || "Erro interno" }, status);
  }
});
