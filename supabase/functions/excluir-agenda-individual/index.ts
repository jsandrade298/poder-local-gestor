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
    console.log('🗑️ Iniciando exclusão de agenda individual...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agenda_id } = await req.json();

    if (!agenda_id) {
      throw new Error('agenda_id é obrigatório');
    }

    console.log(`📋 Excluindo agenda: ${agenda_id}`);

    // Buscar a agenda para verificar se existe e está confirmada ou recusada
    const { data: agenda, error: selectError } = await supabase
      .from('agendas')
      .select('id, status, data_hora_proposta, descricao_objetivo, created_at, updated_at')
      .eq('id', agenda_id)
      .in('status', ['confirmado', 'recusado'])
      .maybeSingle();

    if (selectError) {
      console.error('❌ Erro ao buscar agenda:', selectError);
      throw selectError;
    }

    if (!agenda) {
      console.log('⚠️ Agenda não encontrada ou não está confirmada/recusada');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Agenda não encontrada ou não está confirmada/recusada',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Verificar se já passou o tempo limite para exclusão
    const agora = new Date();
    let dataLimite: Date;
    
    if (agenda.status === 'confirmado') {
      // Para confirmado: 5 minutos após a data/hora proposta
      dataLimite = new Date(agenda.data_hora_proposta);
      dataLimite.setMinutes(dataLimite.getMinutes() + 5);
    } else if (agenda.status === 'recusado') {
      // Para recusado: 5 minutos após a atualização (quando foi recusado)
      dataLimite = new Date(agenda.updated_at);
      dataLimite.setMinutes(dataLimite.getMinutes() + 5);
    }

    console.log(`🕐 Agenda ${agenda.status}: agora=${agora.toISOString()}, limite=${dataLimite!.toISOString()}`);
    console.log(`🔍 Comparação: agora(${agora.getTime()}) < limite(${dataLimite!.getTime()}) = ${agora < dataLimite!}`);

    if (agora < dataLimite!) {
      console.log(`⏰ Ainda não é hora de excluir esta agenda ${agenda.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Ainda não é hora de excluir esta agenda ${agenda.status}`,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log('🗑️ Excluindo mensagens da agenda...');
    // Primeiro, excluir mensagens relacionadas à agenda
    const { error: mensagensError } = await supabase
      .from('agenda_mensagens')
      .delete()
      .eq('agenda_id', agenda_id);

    if (mensagensError) {
      console.error('❌ Erro ao excluir mensagens:', mensagensError);
    } else {
      console.log('✅ Mensagens excluídas com sucesso');
    }

    console.log('🗑️ Excluindo acompanhantes da agenda...');
    // Excluir acompanhantes da agenda
    const { error: acompanhantesError } = await supabase
      .from('agenda_acompanhantes')
      .delete()
      .eq('agenda_id', agenda_id);

    if (acompanhantesError) {
      console.error('❌ Erro ao excluir acompanhantes:', acompanhantesError);
    } else {
      console.log('✅ Acompanhantes excluídos com sucesso');
    }

    console.log('🗑️ Excluindo agenda...');
    // Finalmente, excluir a agenda
    const { error: deleteError } = await supabase
      .from('agendas')
      .delete()
      .eq('id', agenda_id);

    if (deleteError) {
      console.error('❌ Erro ao excluir agenda:', deleteError);
      throw deleteError;
    }

    console.log('🗑️ Cancelando job de exclusão...');
    // Cancelar o job de exclusão agendado
    const { error: cancelError } = await supabase.rpc('cancelar_exclusao_agenda', {
      agenda_id_param: agenda_id
    });

    if (cancelError) {
      console.error('❌ Erro ao cancelar job de exclusão:', cancelError);
    }

    console.log(`✅ Agenda ${agenda_id} (${agenda.status}) excluída com sucesso após expiração`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Agenda ${agenda.status} excluída com sucesso após expiração`,
        deletedAgenda: {
          id: agenda.id,
          descricao: agenda.descricao_objetivo,
          dataHora: agenda.data_hora_proposta
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro na exclusão da agenda:', error);
    
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