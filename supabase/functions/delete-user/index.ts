// ============================================================
// delete-user — saída de um usuário do gabinete (página Usuários).
//
// Revisão 24/11/2026: NADA do que a pessoa registrou é apagado.
//   Antes, excluir apagava as atividades das demandas, o prontuário,
//   os anexos e as agendas da pessoa — e falhava quando ela tinha
//   cadastrado demandas.
//
// Ações (corpo JSON):
//   { userId, acao: "desativar" }  bloqueia o login; o nome continua no
//                                  histórico (recomendado)
//   { userId, acao: "reativar" }   devolve o acesso
//   { userId, acao: "excluir", transferirPara }
//                                  passa TUDO para outra pessoa do mesmo
//                                  gabinete (public.transferir_vinculos_usuario)
//                                  e só então exclui a conta
//
// Quem pode: admin do gabinete (ou super admin), sobre usuário do mesmo
// gabinete; ninguém age sobre si mesmo nem sobre um super admin.
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
  if (!superAdmin && !perfil?.tenant_id) throw new HttpError(403, "Usuário sem gabinete");

  return { userId, tenantId: perfil?.tenant_id ?? null, superAdmin };
}

/** Alvo precisa ser do mesmo gabinete (super admin pode qualquer um) e não ser super admin. */
async function conferirAlvo(admin: SupabaseClient, chamador: Chamador, alvoId: string) {
  const [{ data: alvo }, { data: papeis }] = await Promise.all([
    admin.from("profiles").select("tenant_id, nome").eq("id", alvoId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", alvoId),
  ]);
  if (!alvo) throw new HttpError(404, "Usuário não encontrado");
  if (!chamador.superAdmin && alvo.tenant_id !== chamador.tenantId) {
    throw new HttpError(403, "Usuário não pertence ao seu gabinete");
  }
  if ((papeis ?? []).some((p: { role: string }) => p.role === "super_admin")) {
    throw new HttpError(403, "Não é permitido agir sobre um super admin");
  }
  return alvo as { tenant_id: string | null; nome: string | null };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const chamador = await identificarChamador(req, supabase);
    const body = await req.json();
    const userId: string | undefined = body.userId || body.user_id;
    const acao: string = body.acao || "excluir";
    if (!userId) throw new HttpError(400, "User ID é obrigatório");
    if (userId === chamador.userId) throw new HttpError(400, "Você não pode fazer isto com o seu próprio usuário");

    const alvo = await conferirAlvo(supabase, chamador, userId);

    // ── Desativar / reativar: só o acesso muda ──────────────────
    if (acao === "desativar" || acao === "reativar") {
      const ativo = acao === "reativar";
      const { error: eBan } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: ativo ? "none" : "876000h", // ~100 anos
      } as any);
      if (eBan) throw new HttpError(500, `Erro ao ${ativo ? "reativar" : "desativar"} o acesso: ${eBan.message}`);
      const { error: eP } = await supabase.from("profiles").update({ ativo }).eq("id", userId);
      if (eP) throw new HttpError(500, eP.message);
      console.log(`🔒 ${acao} ${userId} por ${chamador.userId}`);
      return json({ success: true, message: ativo ? "Acesso reativado" : "Acesso desativado" });
    }

    if (acao !== "excluir") throw new HttpError(400, "Ação inválida");

    // ── Excluir: transfere tudo antes ───────────────────────────
    const para: string | undefined = body.transferirPara;
    if (!para) throw new HttpError(400, "Escolha quem vai receber as demandas e os registros antes de excluir");
    if (para === userId) throw new HttpError(400, "Escolha outra pessoa para receber");
    const { data: destino } = await supabase.from("profiles").select("tenant_id, ativo").eq("id", para).maybeSingle();
    if (!destino || destino.tenant_id !== alvo.tenant_id) {
      throw new HttpError(400, "Quem recebe precisa ser do mesmo gabinete");
    }

    const { data: transferido, error: eT } = await supabase.rpc("transferir_vinculos_usuario", { p_de: userId, p_para: para });
    if (eT) throw new HttpError(500, `Erro ao transferir: ${eT.message}`);

    // O que é só da pessoa (não é registro do gabinete) pode ir embora
    await supabase.from("notificacoes").delete().or(`destinatario_id.eq.${userId},remetente_id.eq.${userId}`);
    await supabase.from("tarefa_prazo_notificacoes").delete().eq("destinatario_id", userId);
    await supabase.from("tarefa_colaboradores").delete().eq("colaborador_id", userId);
    await supabase.from("whatsapp_assessor_sessoes").update({ profile_id: null }).eq("profile_id", userId);
    await supabase.from("whatsapp_assessor_logs").update({ profile_id: null }).eq("profile_id", userId);
    await supabase.from("conversations").delete().eq("user_id", userId);
    await supabase.from("user_integrations").delete().eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);

    const { error: eProfile } = await supabase.from("profiles").delete().eq("id", userId);
    if (eProfile) throw new HttpError(500, `Não foi possível excluir: ${eProfile.message}`);

    const { error: eAuth } = await supabase.auth.admin.deleteUser(userId);
    if (eAuth) throw new HttpError(500, `Erro ao excluir a conta de acesso: ${eAuth.message}`);

    console.log(`✅ ${userId} excluído; tudo transferido para ${para}`, transferido);
    return json({ success: true, message: "Usuário excluído", transferido });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("❌ delete-user:", error?.message);
    return json({ success: false, error: error?.message || "Erro interno" }, status);
  }
});
