import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = "https://nsoedzefrqjmbgahukub.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxNDU2OCwiZXhwIjoyMDcyNDkwNTY4fQ.fVmZ3TQj6jQa6W2zKVRxfVHgGJYM_HslCEWNEvdL2sg";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body
    const { teste = false } = await req.json().catch(() => ({}));
    
    console.log('Iniciando processo de envio de mensagens de aniversário', { teste });

    // Buscar configurações
    const { data: configs, error: configError } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['whatsapp_instancia_aniversario', 'whatsapp_mensagem_aniversario', 'whatsapp_aniversario_ativo']);

    if (configError) {
      console.error('Erro ao buscar configurações:', configError);
      throw new Error('Erro ao buscar configurações');
    }

    const configMap = configs?.reduce((acc, item) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {} as Record<string, string>) || {};

    const instanciaAniversario = configMap.whatsapp_instancia_aniversario;
    const mensagemAniversario = configMap.whatsapp_mensagem_aniversario;
    const aniversarioAtivo = configMap.whatsapp_aniversario_ativo === 'true';

    console.log('Configurações carregadas:', {
      instancia: instanciaAniversario,
      ativo: aniversarioAtivo,
      mensagem: mensagemAniversario ? 'Configurada' : 'Não configurada'
    });

    // Verificar se está ativo
    if (!aniversarioAtivo && !teste) {
      console.log('Sistema de aniversário desativado');
      return new Response(
        JSON.stringify({ success: true, message: 'Sistema desativado', enviados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instanciaAniversario || !mensagemAniversario) {
      console.log('Configurações incompletas');
      return new Response(
        JSON.stringify({ success: false, message: 'Configurações incompletas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar aniversariantes do dia
    const hoje = new Date();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const dia = hoje.getDate().toString().padStart(2, '0');

    let query = supabase
      .from('municipes')
      .select('id, nome, telefone, data_nascimento')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    if (!teste) {
      // Para produção, buscar apenas aniversariantes do dia
      query = query.like('data_nascimento', `%-${mes}-${dia}`);
    } else {
      // Para teste, buscar os primeiros 2 registros com telefone
      query = query.limit(2);
    }

    const { data: aniversariantes, error: aniversariantesError } = await query;

    if (aniversariantesError) {
      console.error('Erro ao buscar aniversariantes:', aniversariantesError);
      throw new Error('Erro ao buscar aniversariantes');
    }

    console.log(`Encontrados ${aniversariantes?.length || 0} aniversariantes`);

    if (!aniversariantes || aniversariantes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: teste ? 'Nenhum munícipe com telefone encontrado para teste' : 'Nenhum aniversariante hoje',
          enviados: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar detalhes da instância
    const { data: instancia, error: instanciaError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanciaAniversario)
      .eq('active', true)
      .single();

    if (instanciaError || !instancia) {
      console.error('Instância não encontrada:', instanciaError);
      throw new Error('Instância do WhatsApp não encontrada');
    }

    if (instancia.status !== 'connected') {
      console.error('Instância não conectada:', instancia.status);
      throw new Error('Instância do WhatsApp não está conectada');
    }

    console.log('Instância encontrada:', instancia.display_name);

    // Preparar telefones e mensagens
    const telefones = aniversariantes.map(aniversariante => aniversariante.telefone).filter(Boolean);
    const mensagemPersonalizada = teste 
      ? `[TESTE] ${mensagemAniversario}`
      : mensagemAniversario;

    // Chamar função de envio de WhatsApp
    const { data: resultado, error: envioError } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones,
        mensagem: mensagemPersonalizada,
        instanceName: instanciaAniversario,
        tempoMinimo: 1,
        tempoMaximo: 3,
        incluirTodos: false,
        // Substituir {nome} pelo nome de cada aniversariante
        customMessages: aniversariantes.reduce((acc, aniversariante) => {
          if (aniversariante.telefone) {
            acc[aniversariante.telefone] = mensagemPersonalizada.replace('{nome}', aniversariante.nome);
          }
          return acc;
        }, {} as Record<string, string>)
      }
    });

    if (envioError) {
      console.error('Erro ao enviar mensagens:', envioError);
      throw new Error('Erro ao enviar mensagens via WhatsApp');
    }

    console.log('Resultado do envio:', resultado);

    const sucessos = resultado?.sucessos || 0;
    const falhas = resultado?.falhas || 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: teste 
          ? `Teste concluído: ${sucessos} enviados, ${falhas} falhas`
          : `Mensagens de aniversário enviadas: ${sucessos} sucessos, ${falhas} falhas`,
        enviados: sucessos,
        falhas,
        aniversariantes: aniversariantes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função de aniversário:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Erro interno do servidor' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});