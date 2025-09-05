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
  instancia: string;
  mensagem: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando notificação de atualização de demanda');

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Receber dados da notificação
    const notificacao: NotificacaoDemanda = await req.json();
    
    console.log('Dados recebidos:', {
      demanda_id: notificacao.demanda_id,
      municipe_nome: notificacao.municipe_nome,
      status: notificacao.status,
      instancia: notificacao.instancia
    });

    // Validar dados obrigatórios
    if (!notificacao.demanda_id || !notificacao.municipe_nome || !notificacao.municipe_telefone || 
        !notificacao.status || !notificacao.instancia || !notificacao.mensagem) {
      throw new Error('Dados obrigatórios missing para notificação');
    }

    // Preparar mensagem personalizada
    const mensagemPersonalizada = notificacao.mensagem
      .replace('{nome}', notificacao.municipe_nome)
      .replace('{status}', notificacao.status);

    console.log('Mensagem personalizada:', mensagemPersonalizada);

    // Preparar dados para envio via WhatsApp
    const telefones = [{
      id: notificacao.demanda_id,
      nome: notificacao.municipe_nome,
      telefone: notificacao.municipe_telefone
    }];

    const customMessages: Record<string, string> = {};
    customMessages[notificacao.municipe_telefone] = mensagemPersonalizada;

    // Enviar mensagem via WhatsApp
    const { data: resultadoEnvio, error: envioError } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones,
        mensagem: 'Será personalizada', // Será substituída pelo customMessages
        instanceName: notificacao.instancia,
        tempoMinimo: 1,
        tempoMaximo: 2,
        customMessages
      }
    });

    if (envioError) {
      throw new Error(`Erro ao enviar mensagem: ${envioError.message}`);
    }

    console.log('Notificação enviada com sucesso:', resultadoEnvio);

    return new Response(JSON.stringify({
      message: 'Notificação de demanda enviada com sucesso',
      success: true,
      demanda_id: notificacao.demanda_id,
      municipe_nome: notificacao.municipe_nome,
      status: notificacao.status,
      resultado: resultadoEnvio
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Erro no envio de notificação de demanda:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);