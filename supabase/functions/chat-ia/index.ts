import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('healthz') === '1') {
      return new Response(
        JSON.stringify({ ok: true }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY não configurado');
      return new Response(
        JSON.stringify({ error: 'Chave da API OpenAI não configurada' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // MULTI-TENANT: Identificar o tenant do usuário autenticado
    // ============================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair token do header Authorization
    const authHeader = req.headers.get('Authorization');
    let tenantId: string | null = null;

    if (authHeader) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (user && !userError) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        
        tenantId = profile?.tenant_id || null;
      }
    }

    console.log('🏢 Tenant ID:', tenantId || 'não identificado');
    // ============================================================

    const { message, conversationHistory = [], documentosContexto = [], model = 'gpt-5-mini' } = await req.json();
    
    const validModels = ['gpt-5', 'gpt-5-mini'];
    const modelMap: Record<string, string> = {
      'gpt-5': 'gpt-5-2025-08-07',
      'gpt-5-mini': 'gpt-5-mini-2025-08-07'
    };
    
    if (!validModels.includes(model)) {
      return new Response(
        JSON.stringify({ error: `Modelo inválido. Use: ${validModels.join(', ')}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem é obrigatória' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando mensagem para IA:', message);
    console.log('Modelo selecionado:', model);
    console.log('Histórico de conversa:', conversationHistory.length, 'mensagens');
    console.log('Documentos no contexto:', documentosContexto.length);

    const truncarTexto = (texto: string, maxChars: number = 10000): string => {
      if (!texto || texto.length <= maxChars) return texto;
      return texto.substring(0, maxChars) + '\n[... texto truncado ...]';
    };

    let contextosDocumentos = '';
    if (documentosContexto.length > 0) {
      contextosDocumentos = '\n\n=== DOCUMENTOS DE REFERÊNCIA ===\n';
      documentosContexto.forEach((doc: any, index: number) => {
        const conteudoTruncado = truncarTexto(doc.conteudo, 10000);
        contextosDocumentos += `\n[DOCUMENTO ${index + 1}: ${doc.nome} - Categoria: ${doc.categoria}]\n`;
        contextosDocumentos += `${conteudoTruncado}\n`;
        contextosDocumentos += '---\n';
      });
      contextosDocumentos += '\n=== FIM DOS DOCUMENTOS DE REFERÊNCIA ===\n\n';
    }

    const systemPrompt = `Você é um Assessor Legislativo Municipal especializado em redação de documentos oficiais. Sua função é redigir:

- Requerimentos de informação
- Indicações legislativas  
- Projetos de Lei (PLs)
- Moções
- Ofícios oficiais
- Requerimentos diversos
- Outros documentos legislativos municipais

INSTRUÇÕES IMPORTANTES:
1. Use EXCLUSIVAMENTE os documentos de referência fornecidos como base para a estrutura, formato e linguagem
2. NÃO invente informações, base legal ou dados que não estejam nos documentos fornecidos
3. Mantenha a linguagem formal e técnica adequada para documentos oficiais
4. Preserve a estrutura e formatação típica dos documentos legislativos
5. Se não houver documentos de referência suficientes, informe que precisa de modelos adequados

${documentosContexto.length > 0 ? 
  'DOCUMENTOS DISPONÍVEIS: Use os documentos abaixo como referência OBRIGATÓRIA para estrutura, formato e linguagem. Não cite informações externas aos documentos fornecidos.' : 
  'ATENÇÃO: Sem documentos de referência, posso apenas orientar sobre estruturas gerais. Para redação específica, forneça documentos-modelo.'}

${contextosDocumentos}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelMap[model],
        messages: messages,
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro da API OpenAI:', response.status, errorData);
      
      try {
        const errorJson = JSON.parse(errorData);
        return new Response(
          JSON.stringify({ error: errorJson.error?.message || 'Erro na API OpenAI' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ error: `Erro OpenAI: ${errorData}` }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida');

    const assistantMessage = data.choices[0].message.content;

    // ============================================================
    // MULTI-TENANT: Registrar uso de tokens no tenant_usage
    // ============================================================
    if (tenantId && data.usage) {
      const tokensInput = data.usage.prompt_tokens || 0;
      const tokensOutput = data.usage.completion_tokens || 0;
      
      const mesAtual = new Date().toISOString().substring(0, 7) + '-01'; // '2026-02-01'
      
      // Upsert: incrementar contadores do mês
      const { error: usageError } = await supabase.rpc('increment_openai_usage', {
        p_tenant_id: tenantId,
        p_mes: mesAtual,
        p_chamadas: 1,
        p_tokens_input: tokensInput,
        p_tokens_output: tokensOutput
      });

      if (usageError) {
        // Fallback: tentar insert/update manual
        console.warn('⚠️ Erro no RPC, tentando upsert direto:', usageError.message);
        
        const { data: existing } = await supabase
          .from('tenant_usage')
          .select('id, openai_chamadas, openai_tokens_input, openai_tokens_output')
          .eq('tenant_id', tenantId)
          .eq('mes', mesAtual)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('tenant_usage')
            .update({
              openai_chamadas: (existing.openai_chamadas || 0) + 1,
              openai_tokens_input: (existing.openai_tokens_input || 0) + tokensInput,
              openai_tokens_output: (existing.openai_tokens_output || 0) + tokensOutput,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('tenant_usage')
            .insert({
              tenant_id: tenantId,
              mes: mesAtual,
              openai_chamadas: 1,
              openai_tokens_input: tokensInput,
              openai_tokens_output: tokensOutput
            });
        }
      }

      console.log(`📊 Uso registrado: ${tokensInput} in + ${tokensOutput} out tokens`);
    }
    // ============================================================

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        conversationId: Date.now().toString()
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função chat-ia:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
