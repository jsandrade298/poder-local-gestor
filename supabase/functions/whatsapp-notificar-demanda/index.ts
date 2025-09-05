import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificacaoDemanda {
  demanda_id: string;
  municipe_nome: string;
  municipe_telefone: string;
  status: string;
  status_anterior?: string;
  titulo_demanda: string;
  protocolo: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notificacao: NotificacaoDemanda = await req.json();
    
    console.log('Notificação de mudança de status:', notificacao);

    // Buscar configurações
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['whatsapp_instancia_demandas', 'whatsapp_mensagem_demandas', 'whatsapp_demandas_ativo']);

    if (!configs) {
      throw new Error('Configurações não encontradas');
    }

    const configMap = configs.reduce((acc: any, item: any) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {});

    // Verificar se está ativo
    if (configMap.whatsapp_demandas_ativo !== 'true') {
      console.log('Notificações de demanda desativadas');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Notificações desativadas' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const instancia = configMap.whatsapp_instancia_demandas;
    const mensagemTemplate = configMap.whatsapp_mensagem_demandas;

    if (!instancia || !mensagemTemplate) {
      throw new Error('Configurações incompletas');
    }

    // Personalizar mensagem
    const mensagemPersonalizada = mensagemTemplate
      .replace('{nome}', notificacao.municipe_nome)
      .replace('{status}', notificacao.status)
      .replace('{protocolo}', notificacao.protocolo)
      .replace('{titulo}', notificacao.titulo_demanda);

    // Enviar via WhatsApp
    const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones: [notificacao.municipe_telefone],
        mensagem: mensagemPersonalizada,
        instanceName: instancia,
        tempoMinimo: 1,
        tempoMaximo: 2
      }
    });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificação enviada',
      resultado: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});