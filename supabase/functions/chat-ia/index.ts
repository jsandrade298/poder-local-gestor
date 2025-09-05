import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY não configurado');
      return new Response(
        JSON.stringify({ error: 'Chave da API OpenAI não configurada' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { message, conversationHistory = [] } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem é obrigatória' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processando mensagem para IA:', message);
    console.log('Histórico de conversa:', conversationHistory.length, 'mensagens');

    // Preparar mensagens para a OpenAI
    const messages = [
      {
        role: 'system',
        content: `Você é um assistente virtual especializado em gestão pública municipal. Você trabalha para ajudar funcionários de gabinete e gestores públicos com:

- Orientações sobre legislação municipal
- Processos administrativos
- Atendimento ao cidadão
- Gestão de demandas e solicitações
- Procedimentos burocráticos
- Protocolos de atendimento
- Organização de agendas e reuniões

Seja sempre profissional, claro e objetivo. Forneça informações precisas e práticas que ajudem no dia a dia da administração pública. Se não souber algo específico sobre a legislação local, oriente a consultar os órgãos competentes.`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: messages,
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro da API OpenAI:', response.status, errorData);
      return new Response(
        JSON.stringify({ error: 'Erro ao comunicar com a IA' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida');

    const assistantMessage = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        conversationId: Date.now().toString() // ID simples para a conversa
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na função chat-ia:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});