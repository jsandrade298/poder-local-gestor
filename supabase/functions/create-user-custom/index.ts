import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  password: string;
  nome: string;
  telefone?: string;
  cargo?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('✅ Iniciando criação de usuário personalizada...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Usar service role para ter privilégios administrativos
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email, password, nome, telefone, cargo }: CreateUserRequest = await req.json();

    if (!email || !password || !nome) {
      throw new Error('Email, senha e nome são obrigatórios');
    }

    console.log('👤 Criando usuário:', email);

    // Usar Admin API para criar usuário sem validação de domínio
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        full_name: nome
      }
    });

    if (userError) {
      console.error('❌ Erro ao criar usuário no Auth:', userError);
      throw userError;
    }

    if (!userData.user) {
      throw new Error('Usuário não foi criado');
    }

    console.log('✅ Usuário criado no Auth:', userData.user.id);

    // Atualizar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.user.id,
        nome: nome,
        email: email,
        telefone: telefone || null,
        cargo: cargo || null
      });

    if (profileError) {
      console.error('❌ Erro ao criar perfil:', profileError);
      // Não falhar completamente, só avisar
      console.warn('Perfil não foi criado, mas usuário Auth foi criado');
    }

    // Adicionar role de admin
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userData.user.id,
        role: 'admin'
      });

    if (roleError) {
      console.error('❌ Erro ao definir role:', roleError);
      // Não falhar completamente, só avisar
      console.warn('Role não foi definido, mas usuário foi criado');
    }

    console.log('✅ Usuário criado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        user: userData.user,
        message: 'Usuário criado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na criação do usuário:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});