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
  status_anterior?: string;
  titulo_demanda: string;
  protocolo: string;
  // MULTI-TENANT
  tenant_id?: string;
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

    // ============================================================
    // MULTI-TENANT: Identificar tenant
    // ============================================================
    let tenantId = notificacao.tenant_id || null;

    // Se não veio no body, tentar extrair do usuário autenticado
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

    // MULTI-TENANT: filtrar configurações por tenant_id
    const configQuery = supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['whatsapp_instancia_demandas', 'whatsapp_mensagem_demandas', 'whatsapp_demandas_ativo']);

    if (tenantId) configQuery.eq('tenant_id', tenantId);

    const { data: configs } = await configQuery;

    if (!configs) {
      throw new Error('Configurações não encontradas');
    }

    const configMap = configs.reduce((acc: any, item: any) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {});

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

    const primeiroNome = (notificacao.municipe_nome || '').split(' ')[0];
    const agora = new Date();
    const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    const mensagemPersonalizada = mensagemTemplate
      .replace(/\{nome\}/gi, notificacao.municipe_nome || '')
      .replace(/\{primeiro_nome\}/gi, primeiroNome)
      .replace(/\{status\}/gi, notificacao.status || '')
      .replace(/\{protocolo\}/gi, notificacao.protocolo || '')
      .replace(/\{titulo\}/gi, notificacao.titulo_demanda || '')
      .replace(/\{bairro\}/gi, notificacao.municipe_bairro || '')
      .replace(/\{data\}/gi, dataAtual)
      .replace(/\{hora\}/gi, horaAtual);

    const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
      body: {
        telefones: [notificacao.municipe_telefone],
        mensagem: mensagemPersonalizada,
        instanceName: instancia,
        tempoMinimo: 1,
        tempoMaximo: 2,
        tenant_id: tenantId  // MULTI-TENANT: passar tenant_id
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
