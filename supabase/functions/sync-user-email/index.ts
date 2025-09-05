import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncEmailRequest {
  userId: string;
  newEmail: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando sincronização de email...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Criar cliente admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId, newEmail }: SyncEmailRequest = await req.json();
    
    if (!userId || !newEmail) {
      console.log('❌ Dados incompletos:', { userId, newEmail });
      return new Response(
        JSON.stringify({ error: 'userId e newEmail são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`👤 Sincronizando email para usuário: ${userId}`);
    console.log(`📧 Novo email: ${newEmail}`);

    // Atualizar email no sistema de autenticação
    const { data: userData, error: userError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: true
      }
    );

    if (userError) {
      console.log('❌ Erro ao atualizar email no auth:', userError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar email de autenticação', details: userError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Atualizar email na tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId);

    if (profileError) {
      console.log('❌ Erro ao atualizar email no profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar email no perfil', details: profileError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Email sincronizado com sucesso!');
    console.log(`📧 Email atualizado para: ${newEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sincronizado com sucesso',
        updatedEmail: newEmail
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.log('❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});