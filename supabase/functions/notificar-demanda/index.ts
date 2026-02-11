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
  municipe_bairro?: string;
  status: string;
  instancia: string;
  mensagem: string;
  titulo_demanda?: string;
  protocolo?: string;
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
      titulo_demanda: notificacao.titulo_demanda,
      protocolo: notificacao.protocolo,
      bairro: notificacao.municipe_bairro,
      instancia: notificacao.instancia
    });

    // Validar dados obrigatórios
    if (!notificacao.demanda_id || !notificacao.municipe_nome || !notificacao.municipe_telefone || 
        !notificacao.status || !notificacao.instancia || !notificacao.mensagem) {
      throw new Error('Dados obrigatórios missing para notificação');
    }

    // Preparar mensagem personalizada - substituir TODAS as variáveis
    const primeiroNome = (notificacao.municipe_nome || '').split(' ')[0];
    const agora = new Date();
    const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    const mensagemPersonalizada = notificacao.mensagem
      .replace(/\{nome\}/gi, notificacao.municipe_nome || '')
      .replace(/\{primeiro_nome\}/gi, primeiroNome)
      .replace(/\{status\}/gi, notificacao.status || '')
      .replace(/\{protocolo\}/gi, notificacao.protocolo || '')
      .replace(/\{titulo\}/gi, notificacao.titulo_demanda || '')
      .replace(/\{bairro\}/gi, notificacao.municipe_bairro || '')
      .replace(/\{data\}/gi, dataAtual)
      .replace(/\{hora\}/gi, horaAtual);

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
