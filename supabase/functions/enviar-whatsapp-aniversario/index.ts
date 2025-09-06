import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Municipe {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let startTime = new Date();
  let logData = {
    data_envio: startTime,
    quantidade: 0,
    teste: false,
    aniversariantes: [],
    success: false,
    error_message: null
  };

  try {
    console.log('=== INICIANDO PROCESSO DE ANIVERSÁRIOS ===');
    console.log('Timestamp:', startTime.toISOString());

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configurações
    const { data: configs, error: configError } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['whatsapp_instancia_aniversario', 'whatsapp_mensagem_aniversario', 'whatsapp_aniversario_ativo']);

    if (configError) {
      throw new Error(`Erro ao buscar configurações: ${configError.message}`);
    }

    const configMap = configs?.reduce((acc, item) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {} as Record<string, string>) || {};

    const instanciaAniversario = configMap.whatsapp_instancia_aniversario;
    const mensagemAniversario = configMap.whatsapp_mensagem_aniversario;
    const aniversarioAtivo = configMap.whatsapp_aniversario_ativo === 'true';

    console.log('Configurações:', { instanciaAniversario, aniversarioAtivo });

    // Verificar se está ativo
    if (!aniversarioAtivo) {
      console.log('Sistema de aniversário desativado');
      return new Response(JSON.stringify({ 
        message: 'Sistema de mensagens de aniversário está desativado',
        success: false 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!instanciaAniversario || !mensagemAniversario) {
      throw new Error('Configurações de aniversário incompletas');
    }

    // Verificar se é uma chamada de teste
    const body = await req.json().catch(() => ({}));
    const isTeste = body.teste === true;
    logData.teste = isTeste;
    
    console.log('Modo de execução:', isTeste ? 'TESTE' : 'PRODUÇÃO');

    let aniversariantes: Municipe[] = [];

    if (isTeste) {
      // Para teste, buscar alguns munícipes aleatórios
      const { data: municipesTeste, error: testeError } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .limit(3);

      if (testeError) throw testeError;
      aniversariantes = municipesTeste || [];
      console.log(`Modo teste: ${aniversariantes.length} munícipes para teste`);
    } else {
      // Buscar aniversariantes do dia atual
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const dia = hoje.getDate();

      // Usar SQL raw para extrair mês e dia da data de nascimento
      const { data: aniversariantesData, error: aniversariantesError } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .not('data_nascimento', 'is', null);

      if (aniversariantesError) {
        throw new Error(`Erro ao buscar aniversariantes: ${aniversariantesError.message}`);
      }

      // Filtrar aniversariantes do dia no JavaScript
      aniversariantes = (aniversariantesData || []).filter(municipe => {
        if (!municipe.data_nascimento) return false;
        const dataNascimento = new Date(municipe.data_nascimento);
        return dataNascimento.getMonth() + 1 === mes && dataNascimento.getDate() === dia;
      });

      console.log(`Encontrados ${aniversariantes.length} aniversariantes do dia ${dia}/${mes}`);
    }

    if (aniversariantes.length === 0) {
      return new Response(JSON.stringify({
        message: isTeste ? 'Nenhum munícipe encontrado para teste' : 'Nenhum aniversariante hoje',
        success: true,
        count: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Preparar dados para envio
    const telefones = aniversariantes
      .filter(m => m.telefone && m.telefone.trim() !== '')
      .map(m => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone
      }));

    if (telefones.length === 0) {
      return new Response(JSON.stringify({
        message: 'Nenhum aniversariante com telefone válido',
        success: true,
        count: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Preparar mensagens personalizadas para cada aniversariante
    const customMessages: Record<string, string> = {};
    telefones.forEach(telefone => {
      const mensagemPersonalizada = mensagemAniversario.replace('{nome}', telefone.nome);
      const mensagemFinal = isTeste 
        ? `[TESTE] ${mensagemPersonalizada}` 
        : mensagemPersonalizada;
      customMessages[telefone.telefone] = mensagemFinal;
    });

    console.log('Mensagens personalizadas preparadas:', Object.keys(customMessages).length);

    // Chamar função de envio do WhatsApp
    const { data: resultadoEnvio, error: envioError } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones,
        mensagem: 'Mensagem será personalizada', // Será substituída pelo customMessages
        instanceName: instanciaAniversario,
        tempoMinimo: 3,
        tempoMaximo: 5,
        customMessages // Passar mensagens personalizadas
      }
    });

    if (envioError) {
      throw new Error(`Erro ao enviar mensagens: ${envioError.message}`);
    }

    console.log('Resultado do envio:', resultadoEnvio);

    // Atualizar dados do log com sucesso
    logData.quantidade = telefones.length;
    logData.success = true;
    logData.aniversariantes = aniversariantes.map(a => ({
      nome: a.nome,
      telefone: a.telefone
    }));

    // Salvar log no banco
    try {
      await supabase.from('logs_aniversario').insert(logData);
      console.log('Log salvo com sucesso');
    } catch (logError) {
      console.error('Erro ao salvar log:', logError);
    }

    const resposta = {
      message: isTeste 
        ? `Mensagens de teste enviadas para ${telefones.length} contatos`
        : `Mensagens de aniversário enviadas para ${telefones.length} aniversariantes`,
      success: true,
      count: telefones.length,
      resultado: resultadoEnvio,
      aniversariantes: aniversariantes.map(a => ({
        nome: a.nome,
        telefone: a.telefone
      })),
      executedAt: startTime.toISOString()
    };

    console.log('=== PROCESSO CONCLUÍDO COM SUCESSO ===');
    return new Response(JSON.stringify(resposta), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('=== ERRO NO PROCESSO DE ANIVERSÁRIOS ===');
    console.error('Erro detalhado:', error);
    
    // Atualizar dados do log com erro
    logData.success = false;
    logData.error_message = error.message;

    // Tentar salvar log de erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from('logs_aniversario').insert(logData);
      console.log('Log de erro salvo');
    } catch (logError) {
      console.error('Erro ao salvar log de erro:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        executedAt: startTime.toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);