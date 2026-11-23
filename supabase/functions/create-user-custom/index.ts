// ============================================================
// create-user-custom — usado pela página Usuários do gabinete.
//
// Antes: verify_jwt desligado e o token era lido SEM conferir a
// assinatura (atob no payload) — dava para forjar um token e criar
// um admin em qualquer gabinete. Além disso, se o e-mail já
// existisse, a função trocava a senha daquela conta e a movia para
// o gabinete de quem chamou, mesmo que fosse de outro gabinete.
//
// Agora: token verificado no servidor de Auth, chamador precisa ser
// admin do gabinete, e um e-mail que já pertence a outro gabinete
// é recusado.
//
// Comportamento mantido: todo usuário criado aqui entra como admin
// do gabinete (decisão de produto a rever, não de segurança).
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

interface CreateUserRequest {
  email: string;
  password: string;
  nome: string;
  telefone?: string;
  cargo?: string;
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

  return { userId, tenantId: perfil?.tenant_id ?? null, superAdmin };
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
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const chamador = await identificarChamador(req, adminClient);

    const tenantId = chamador.tenantId;
    if (!tenantId) {
      throw new HttpError(400, "O usuário solicitante não está associado a nenhum gabinete");
    }

    const { email, password, nome, telefone, cargo }: CreateUserRequest = await req.json();
    if (!email || !password || !nome) throw new HttpError(400, "Email, senha e nome são obrigatórios");
    if (String(password).length < 6) throw new HttpError(400, "A senha deve ter pelo menos 6 caracteres");

    console.log("👤 Criando usuário:", email, "no tenant:", tenantId, "por", chamador.userId);

    // ── 1. Criar (ou recuperar) usuário no Auth ──
    let authUserId: string;
    let wasExisting = false;

    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });

    if (userError) {
      if (userError.code !== "email_exists") throw new HttpError(400, userError.message);

      // E-mail já existe (ex.: tentativa anterior que falhou no perfil).
      // Só pode ser reaproveitado se a conta não pertence a outro gabinete.
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw new HttpError(500, `Erro ao buscar usuário existente: ${listError.message}`);

      const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) throw new HttpError(400, "Usuário não encontrado mesmo com email duplicado");

      const [{ data: perfilExistente }, { data: papeisExistentes }] = await Promise.all([
        adminClient.from("profiles").select("tenant_id").eq("id", existingUser.id).maybeSingle(),
        adminClient.from("user_roles").select("role").eq("user_id", existingUser.id),
      ]);

      if ((papeisExistentes ?? []).some((p: { role: string }) => p.role === "super_admin")) {
        throw new HttpError(409, "Este e-mail pertence a um super admin");
      }
      if (perfilExistente?.tenant_id && perfilExistente.tenant_id !== tenantId) {
        throw new HttpError(409, "Este e-mail já está em uso por um usuário de outro gabinete");
      }

      authUserId = existingUser.id;
      wasExisting = true;

      await adminClient.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: nome },
      });
    } else {
      if (!userData.user) throw new HttpError(500, "Usuário não foi criado");
      authUserId = userData.user.id;
    }

    // ── 2. Perfil com tenant_id e role_no_tenant = 'admin' ──
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: authUserId,
      nome,
      email,
      telefone: telefone || null,
      cargo: cargo || null,
      tenant_id: tenantId,
      role_no_tenant: "admin",
    });

    if (profileError) {
      if (!wasExisting) await adminClient.auth.admin.deleteUser(authUserId);
      throw new HttpError(400, `Erro ao criar perfil: ${profileError.message}`);
    }

    // ── 3. Role 'admin' em user_roles ──
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: authUserId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) console.error("❌ Erro ao definir role (não crítico):", roleError);

    return json({
      success: true,
      user: { id: authUserId, email },
      message: "Usuário criado com sucesso",
    });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("❌ create-user-custom:", error?.message);
    return json({ success: false, error: error?.message || "Erro interno do servidor" }, status);
  }
});
