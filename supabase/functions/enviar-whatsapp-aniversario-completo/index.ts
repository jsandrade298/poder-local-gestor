import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO ENVIO ANIVERSÁRIOS ===');

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'whatsapp_instancia_aniversario',
        'whatsapp_mensagem_aniversario', 
        'whatsapp_aniversario_ativo',
        'whatsapp_tempo_minimo_aniversario',
        'whatsapp_tempo_maximo_aniversario'
      ]);

    const configMap = new Map(configs?.map(c => [c.chave, c.valor]) || []);
    
    const instanceName = configMap.get('whatsapp_instancia_aniversario');
    const messageTemplate = configMap.get('whatsapp_mensagem_aniversario');
    const isActive = configMap.get('whatsapp_aniversario_ativo') === 'true';
    const tempoMinimo = parseInt(configMap.get('whatsapp_tempo_minimo_aniversario') || '1');
    const tempoMaximo = parseInt(configMap.get('whatsapp_tempo_maximo_aniversario') || '3');

    console.log('Configurações carregadas:', { instanceName, isActive, tempoMinimo, tempoMaximo });

    if (!isActive) {
      console.log('Envio de aniversários desativado');
      return new Response(JSON.stringify({ message: 'Envio desativado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!instanceName || !messageTemplate) {
      throw new Error('Configurações incompletas');
    }

    // Buscar instância WhatsApp
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .eq('active', true)
      .single();

    if (!instance) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    console.log(`Instância encontrada: ${instance.display_name}`);

    // Buscar aniversariantes de hoje
    const today = new Date().toISOString().slice(5, 10); // MM-DD
    
    const { data: aniversariantes } = await supabase
      .from('municipes')
      .select('id, nome, telefone, data_nascimento')
      .not('telefone', 'is', null)
      .neq('telefone', '')
      .like('data_nascimento', `%-${today}`);

    if (!aniversariantes || aniversariantes.length === 0) {
      console.log('Nenhum aniversariante encontrado para hoje');
      
      // Log do envio vazio
      await supabase.from('logs_aniversario').insert({
        quantidade: 0,
        success: true,
        aniversariantes: [],
        data_envio: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        message: 'Nenhum aniversariante encontrado',
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Encontrados ${aniversariantes.length} aniversariantes`);

    // Headers da API
    const apiHeaders = {
      'Content-Type': 'application/json',
      'apikey': instance.instance_token
    };

    console.log('Token configurado:', instance.instance_token ? 'Sim' : 'Não');

    // Função para normalizar número brasileiro
    const normalizePhone = (phone: string) => {
      let digits = String(phone).replace(/\D/g, "");
      
      // Remove código do país se presente
      if (digits.startsWith("55")) {
        digits = digits.slice(2);
      }
      
      // Adiciona 9 para celular se necessário
      if (digits.length === 10) {
        const ddd = digits.slice(0, 2);
        const numero = digits.slice(2);
        if (/^[987]/.test(numero)) {
          digits = ddd + "9" + numero;
        }
      }
      
      // Adiciona código do país
      return "55" + digits;
    };

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // Processar aniversariantes
    for (let i = 0; i < aniversariantes.length; i++) {
      const aniversariante = aniversariantes[i];
      const normalizedPhone = normalizePhone(aniversariante.telefone);
      
      console.log(`\n🎂 [${i + 1}/${aniversariantes.length}] Processando: ${aniversariante.nome} (${normalizedPhone})`);
      
      // Aplicar delay entre envios (exceto no primeiro)
      if (i > 0) {
        const delaySeconds = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
        const delayMs = Math.round(delaySeconds * 1000);
        
        console.log(`⏳ Aguardando ${delayMs}ms (${delaySeconds.toFixed(1)}s) antes do próximo envio...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        console.log('✅ Delay concluído, enviando próxima mensagem...');
      }

      try {
        // Personalizar mensagem
        const mensagemPersonalizada = messageTemplate
          .replace('{nome}', aniversariante.nome)
          .replace('{NOME}', aniversariante.nome.toUpperCase());

        console.log(`Mensagem: ${mensagemPersonalizada}`);

        // Enviar mensagem
        const url = `${instance.api_url}/message/sendText/${instance.instance_id}`;
        const payload = {
          number: normalizedPhone,
          text: mensagemPersonalizada,
          linkPreview: false,
          delay: 1200
        };

        console.log(`URL da API: ${url}`);
        console.log(`Payload:`, JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`Status da resposta: ${response.status}`);
        console.log(`Resposta da API: ${responseText}`);

        if (response.ok) {
          console.log('✅ Mensagem de aniversário enviada com sucesso');
          successCount++;
          results.push({
            nome: aniversariante.nome,
            telefone: aniversariante.telefone,
            status: 'sucesso'
          });
        } else {
          console.error('❌ Erro ao enviar mensagem de aniversário:', responseText);
          errorCount++;
          results.push({
            nome: aniversariante.nome,
            telefone: aniversariante.telefone,
            status: 'erro',
            erro: `HTTP ${response.status}`
          });
        }
      } catch (error) {
        console.error(`❌ Erro geral ao enviar para ${aniversariante.nome}:`, error);
        errorCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: aniversariante.telefone,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`\n🎉 Envio de aniversários concluído: ${successCount} sucessos, ${errorCount} erros`);

    // Log do envio
    await supabase.from('logs_aniversario').insert({
      quantidade: aniversariantes.length,
      success: errorCount === 0,
      aniversariantes: results,
      data_envio: new Date().toISOString(),
      error_message: errorCount > 0 ? `${errorCount} erros de envio` : null
    });

    return new Response(JSON.stringify({
      message: 'Envio concluído',
      total: aniversariantes.length,
      sucessos: successCount,
      erros: errorCount,
      resultados: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no envio de aniversários:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});