import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔑 Iniciando reset de senha...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Usar service role para ter privilégios administrativos
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId, newPassword }: ResetPasswordRequest = await req.json();

    if (!userId || !newPassword) {
      throw new Error('User ID e nova senha são obrigatórios');
    }

    if (newPassword.length < 6) {
      throw new Error('A nova senha deve ter pelo menos 6 caracteres');
    }

    console.log('👤 Atualizando senha para usuário:', userId);

    // Usar Admin API para atualizar senha diretamente
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true // Garante que o email está confirmado
    });

    if (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      throw error;
    }

    console.log('✅ Senha atualizada com sucesso para:', data.user.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha atualizada com sucesso',
        user: {
          id: data.user.id,
          email: data.user.email
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro no reset de senha:', error);
    
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