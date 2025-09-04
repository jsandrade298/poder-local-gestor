import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefones, mensagem, incluirTodos } = await req.json();
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER'); // ex: whatsapp:+14155238886
    
    console.log('TWILIO_ACCOUNT_SID presente:', !!twilioAccountSid);
    console.log('TWILIO_AUTH_TOKEN presente:', !!twilioAuthToken);
    console.log('TWILIO_WHATSAPP_NUMBER presente:', !!twilioWhatsAppNumber);
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.error('Credenciais Twilio não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais Twilio não configuradas' 
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
    const sucessos = [];
    const erros = [];

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
          erros.push(telefone);
          continue;
        }
        
        // Para celulares, garantir que tenha 11 dígitos (adicionar 9 se necessário)
        if (telefoneFormatado.length === 10) {
          const ddd = telefoneFormatado.substring(0, 2);
          const numero = telefoneFormatado.substring(2);
          if (numero.startsWith('9') || numero.startsWith('8') || numero.startsWith('7')) {
            telefoneFormatado = ddd + '9' + numero;
          }
        }
        
        // Formato para Twilio: whatsapp:+5511999999999
        const numeroCompleto = `whatsapp:+55${telefoneFormatado}`;
        
        console.log(`Enviando para: ${telefone} -> ${numeroCompleto}`);

        // Preparar dados para Twilio
        const formData = new URLSearchParams();
        formData.append('From', twilioWhatsAppNumber);
        formData.append('To', numeroCompleto);
        formData.append('Body', mensagem);

        // Fazer requisição para Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const result = await response.json();
        console.log(`Response status: ${response.status}`);
        console.log(`Response result:`, JSON.stringify(result));
        
        if (response.ok && result.sid) {
          console.log(`Mensagem enviada para ${telefone}:`, result.sid);
          resultados.push({ 
            telefone, 
            status: 'sucesso',
            messageId: result.sid,
            twilioStatus: result.status
          });
          sucessos.push(telefone);
        } else {
          console.error(`Erro ao enviar para ${telefone}:`, result);
          resultados.push({ 
            telefone, 
            status: 'erro',
            erro: result.message || result.error?.message || 'Erro desconhecido'
          });
          erros.push(telefone);
        }

        // Aguardar um pouco entre envios para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Erro ao processar ${telefone}:`, error);
        resultados.push({ 
          telefone, 
          status: 'erro',
          erro: error.message
        });
        erros.push(telefone);
      }
    }

    const resumo = {
      total: telefonesList.length,
      sucessos: sucessos.length,
      erros: erros.length
    };

    console.log(`Envio concluído: ${sucessos.length} sucessos, ${erros.length} erros`);

    return new Response(
      JSON.stringify({ 
        success: true,
        resumo,
        resultados
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função enviar-whatsapp-twilio:', error);
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
});