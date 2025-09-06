import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  userId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('✅ Iniciando exclusão de usuário...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Usar service role para ter privilégios administrativos
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      throw new Error('User ID é obrigatório');
    }

    console.log('🗑️ Excluindo usuário:', userId);

    // Usar Admin API para excluir usuário
    const { data, error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      throw error;
    }

    console.log('✅ Usuário excluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário excluído com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na exclusão do usuário:', error);
    
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