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
    const { telefones, mensagem, incluirTodos } = await req.json();
    
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    
    console.log('ZAPI_TOKEN presente:', !!zapiToken);
    console.log('ZAPI_INSTANCE_ID presente:', !!zapiInstanceId);
    console.log('ZAPI_TOKEN length:', zapiToken?.length || 0);
    console.log('ZAPI_INSTANCE_ID length:', zapiInstanceId?.length || 0);
    
    if (!zapiToken || !zapiInstanceId) {
      console.error('Credenciais Z-API não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais Z-API não configuradas' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    let telefonesList = telefones;

    // Se incluirTodos for true, buscar todos os telefones dos munícipes
    if (incluirTodos) {
      const { data: municipes } = await supabaseClient
        .from('municipes')
        .select('telefone')
        .not('telefone', 'is', null);

      telefonesList = municipes?.map(m => m.telefone).filter(Boolean) || [];
    }

    console.log(`Enviando mensagem para ${telefonesList.length} números`);

    const resultados = [];
    const baseUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;

    for (const telefone of telefonesList) {
      try {
        // Limpar e formatar telefone (remover caracteres especiais)
        let telefoneFormatado = telefone.replace(/\D/g, '');
        
        // Remover código do país se já tiver (+55 ou 55)
        if (telefoneFormatado.startsWith('55')) {
          telefoneFormatado = telefoneFormatado.substring(2);
        }
        
        // Verificar se é número válido (10 ou 11 dígitos)
        if (telefoneFormatado.length < 10 || telefoneFormatado.length > 11) {
          console.error(`Número inválido: ${telefone} -> ${telefoneFormatado}`);
          resultados.push({ 
            telefone, 
            status: 'erro',
            erro: 'Número de telefone inválido'
          });
          continue;
        }
        
        // Para celulares, garantir que tenha 11 dígitos (adicionar 9 se necessário)
        if (telefoneFormatado.length === 10) {
          // Se começar com 9, é celular antigo, adicionar 9
          const ddd = telefoneFormatado.substring(0, 2);
          const numero = telefoneFormatado.substring(2);
          if (numero.startsWith('9') || numero.startsWith('8') || numero.startsWith('7')) {
            telefoneFormatado = ddd + '9' + numero;
          }
        }
        
        // Adicionar código do país (55)
        const numeroCompleto = `55${telefoneFormatado}`;
        
        console.log(`Enviando para: ${telefone} -> ${numeroCompleto}`);

        console.log(`Tentando enviar para: ${numeroCompleto}`);
        console.log(`URL: ${baseUrl}/send-text`);
        
        const response = await fetch(`${baseUrl}/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiToken,
          },
          body: JSON.stringify({
            phone: numeroCompleto,
            message: mensagem
          }),
        });

        console.log(`Response status: ${response.status}`);
        const result = await response.json();
        console.log(`Response result:`, JSON.stringify(result));
        
        if (response.ok) {
          console.log(`Mensagem enviada para ${telefone}:`, result);
          resultados.push({ 
            telefone, 
            status: 'sucesso',
            messageId: result.messageId
          });
        } else {
          console.error(`Erro ao enviar para ${telefone}:`, result);
          resultados.push({ 
            telefone, 
            status: 'erro',
            erro: result.error || 'Erro desconhecido'
          });
        }

        // Aguardar um pouco entre envios para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Erro ao enviar para ${telefone}:`, error);
        resultados.push({ 
          telefone, 
          status: 'erro',
          erro: error.message
        });
      }
    }

    const sucessos = resultados.filter(r => r.status === 'sucesso').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    console.log(`Envio concluído: ${sucessos} sucessos, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true,
        resumo: {
          total: resultados.length,
          sucessos,
          erros
        },
        resultados
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})