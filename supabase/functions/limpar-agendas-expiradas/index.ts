import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🗑️ Iniciando limpeza de agendas expiradas...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar agendas confirmadas que já passaram 10 minutos da data/hora proposta
    const agora = new Date();
    const { data: agendasExpiradas, error: selectError } = await supabase
      .from('agendas')
      .select('id, descricao_objetivo, data_hora_proposta, status')
      .eq('status', 'confirmado')
      .lt('data_hora_proposta', new Date(agora.getTime() - 10 * 60 * 1000).toISOString());

    if (selectError) {
      console.error('❌ Erro ao buscar agendas expiradas:', selectError);
      throw selectError;
    }

    if (!agendasExpiradas || agendasExpiradas.length === 0) {
      console.log('✅ Nenhuma agenda expirada encontrada');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma agenda expirada encontrada',
          deletedCount: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`📋 Encontradas ${agendasExpiradas.length} agendas expiradas:`, agendasExpiradas);

    // Primeiro, excluir mensagens relacionadas às agendas
    const agendaIds = agendasExpiradas.map(agenda => agenda.id);
    
    console.log('🗑️ Excluindo mensagens das agendas...');
    const { error: mensagensError } = await supabase
      .from('agenda_mensagens')
      .delete()
      .in('agenda_id', agendaIds);

    if (mensagensError) {
      console.error('❌ Erro ao excluir mensagens:', mensagensError);
    } else {
      console.log('✅ Mensagens excluídas com sucesso');
    }

    // Excluir acompanhantes das agendas
    console.log('🗑️ Excluindo acompanhantes das agendas...');
    const { error: acompanhantesError } = await supabase
      .from('agenda_acompanhantes')
      .delete()
      .in('agenda_id', agendaIds);

    if (acompanhantesError) {
      console.error('❌ Erro ao excluir acompanhantes:', acompanhantesError);
    } else {
      console.log('✅ Acompanhantes excluídos com sucesso');
    }

    // Finalmente, excluir as agendas
    console.log('🗑️ Excluindo agendas...');
    const { error: deleteError } = await supabase
      .from('agendas')
      .delete()
      .in('id', agendaIds);

    if (deleteError) {
      console.error('❌ Erro ao excluir agendas:', deleteError);
      throw deleteError;
    }

    console.log(`✅ ${agendasExpiradas.length} agendas confirmadas expiradas (>10min após horário) foram excluídas com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${agendasExpiradas.length} agendas confirmadas expiradas (>10min após horário) foram excluídas`,
        deletedCount: agendasExpiradas.length,
        deletedAgendas: agendasExpiradas.map(a => ({
          id: a.id,
          descricao: a.descricao_objetivo,
          dataHora: a.data_hora_proposta
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro na limpeza de agendas:', error);
    
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