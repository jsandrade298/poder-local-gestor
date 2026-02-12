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
  // MULTI-TENANT
  tenant_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando notificação de atualização de demanda');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notificacao: NotificacaoDemanda = await req.json();
    
    // ============================================================
    // MULTI-TENANT: Identificar tenant
    // ============================================================
    let tenantId = notificacao.tenant_id || null;

    if (!tenantId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          tenantId = profile?.tenant_id || null;
        }
      }
    }

    console.log('🏢 Tenant ID:', tenantId);
    // ============================================================
    
    console.log('Dados recebidos:', {
      demanda_id: notificacao.demanda_id,
      municipe_nome: notificacao.municipe_nome,
      status: notificacao.status,
      instancia: notificacao.instancia
    });

    if (!notificacao.demanda_id || !notificacao.municipe_nome || !notificacao.municipe_telefone || 
        !notificacao.status || !notificacao.instancia || !notificacao.mensagem) {
      throw new Error('Dados obrigatórios missing para notificação');
    }

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

    const telefones = [{
      id: notificacao.demanda_id,
      nome: notificacao.municipe_nome,
      telefone: notificacao.municipe_telefone
    }];

    const customMessages: Record<string, string> = {};
    customMessages[notificacao.municipe_telefone] = mensagemPersonalizada;

    const { data: resultadoEnvio, error: envioError } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones,
        mensagem: 'Será personalizada',
        instanceName: notificacao.instancia,
        tempoMinimo: 1,
        tempoMaximo: 2,
        customMessages,
        tenant_id: tenantId  // MULTI-TENANT: passar tenant_id
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
      resultado: resultadoEnvio
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Erro no envio de notificação de demanda:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
