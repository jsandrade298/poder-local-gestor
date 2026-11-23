// ============================================================
// reset-password — usado pela página Usuários do gabinete.
//
// Antes: verify_jwt desligado e nenhuma checagem do chamador —
// qualquer pessoa trocava a senha de qualquer usuário.
// Agora: token verificado no servidor de Auth, chamador precisa
// ser admin do gabinete (ou super admin) e o usuário-alvo precisa
// ser do mesmo gabinete.
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
    throw new HttpError(403, "Não é permitido alterar um super admin");
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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const chamador = await identificarChamador(req, admin);

    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) throw new HttpError(400, "userId e newPassword são obrigatórios");
    if (String(newPassword).length < 6) throw new HttpError(400, "A senha deve ter pelo menos 6 caracteres");

    await garantirAlvoNoMesmoGabinete(admin, chamador, userId);

    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
    });
    if (error) throw new HttpError(400, `Erro ao alterar senha: ${error.message}`);

    console.log(`🔑 Senha redefinida para ${userId} por ${chamador.userId}`);

    return json({
      success: true,
      message: "Senha atualizada com sucesso",
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("❌ reset-password:", error?.message);
    return json({ success: false, error: error?.message || "Erro interno" }, status);
  }
});
