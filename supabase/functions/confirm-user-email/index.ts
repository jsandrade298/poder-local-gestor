import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfirmUserRequest {
  userId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('✅ Iniciando confirmação de usuário...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Usar service role para ter privilégios administrativos
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId }: ConfirmUserRequest = await req.json();

    if (!userId) {
      throw new Error('User ID é obrigatório');
    }

    console.log('👤 Confirmando usuário:', userId);

    // Usar Admin API para confirmar email do usuário
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true
    });

    if (error) {
      console.error('❌ Erro ao confirmar usuário:', error);
      throw error;
    }

    console.log('✅ Usuário confirmado com sucesso:', data.user.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário confirmado com sucesso',
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
    console.error('❌ Erro na confirmação do usuário:', error);
    
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