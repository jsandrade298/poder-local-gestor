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

    // Ler dados do corpo da requisição
    const requestData = await req.json();
    const {
      telefones = [],
      mensagem = "",
      instanceName = "",
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
      teste = false
    } = requestData;

    console.log('Dados recebidos:', { 
      telefones: telefones.length, 
      instanceName, 
      teste, 
      mediaFiles: mediaFiles.length 
    });

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let aniversariantes: any[] = [];
    let messageTemplate = "";
    let finalInstanceName = instanceName;

    if (teste && telefones.length > 0) {
      // Modo teste: usar dados enviados pelo frontend
      console.log('=== MODO TESTE ATIVADO ===');
      aniversariantes = telefones;
      messageTemplate = mensagem;
    } else {
      // Modo automático: buscar configurações e aniversariantes do dia
      console.log('=== MODO AUTOMÁTICO ===');
      
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
      
      finalInstanceName = configMap.get('whatsapp_instancia_aniversario') || '';
      messageTemplate = configMap.get('whatsapp_mensagem_aniversario') || '';
      const isActive = configMap.get('whatsapp_aniversario_ativo') === 'true';

      console.log('Configurações carregadas:', { instanceName: finalInstanceName, isActive });

      if (!isActive) {
        console.log('Envio de aniversários desativado');
        return new Response(JSON.stringify({ 
          success: false,
          message: 'Envio desativado' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!finalInstanceName || !messageTemplate) {
        throw new Error('Configurações incompletas');
      }

      // Buscar aniversariantes de hoje
      const today = new Date().toISOString().slice(5, 10); // MM-DD
      
      const { data: aniversariantesHoje } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento')
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .like('data_nascimento', `%-${today}`);

      aniversariantes = aniversariantesHoje || [];
    }

    if (!finalInstanceName) {
      throw new Error('Nome da instância não informado');
    }

    if (!messageTemplate) {
      throw new Error('Mensagem não informada');
    }

    if (aniversariantes.length === 0) {
      console.log('Nenhum aniversariante encontrado');
      
      // Log do envio vazio (apenas no modo automático)
      if (!teste) {
        await supabase.from('logs_aniversario').insert({
          quantidade: 0,
          success: true,
          aniversariantes: [],
          data_envio: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({ 
        success: false,
        message: 'Nenhum aniversariante encontrado',
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Encontrados ${aniversariantes.length} aniversariantes para processamento`);

    // Buscar instância WhatsApp
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', finalInstanceName)
      .eq('active', true)
      .single();

    if (!instance) {
      throw new Error(`Instância ${finalInstanceName} não encontrada`);
    }

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
      const telefoneContato = aniversariante.telefone;
      const normalizedPhone = normalizePhone(telefoneContato);
      
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

        // Primeiro, enviar mídias se houver
        if (mediaFiles && mediaFiles.length > 0) {
          console.log(`📎 Enviando ${mediaFiles.length} arquivo(s) de mídia`);
          
          for (let mediaIndex = 0; mediaIndex < mediaFiles.length; mediaIndex++) {
            const media = mediaFiles[mediaIndex];
            
            // Delay entre mídias
            if (mediaIndex > 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
            
            // Detectar tipo de mídia
            let mediaType = 'document';
            if (media.mimetype) {
              if (media.mimetype.startsWith('image/')) mediaType = 'image';
              else if (media.mimetype.startsWith('video/')) mediaType = 'video';
              else if (media.mimetype.startsWith('audio/')) mediaType = 'audio';
            }
            
            console.log(`📎 Enviando mídia ${mediaType} (${mediaIndex + 1}/${mediaFiles.length})`);
            
            const mediaUrl = `${instance.api_url}/message/sendMedia/${instance.instance_id}`;
            const mediaPayload = {
              number: normalizedPhone,
              mediatype: mediaType,
              media: media.data,
              fileName: media.filename || `arquivo.${mediaType}`,
              delay: 1200
            };
            
            // Adicionar caption na primeira mídia
            if (mediaIndex === 0) {
              mediaPayload.caption = mensagemPersonalizada;
            }
            
            const mediaResponse = await fetch(mediaUrl, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify(mediaPayload)
            });
            
            const mediaResponseText = await mediaResponse.text();
            console.log(`Resposta mídia ${mediaIndex + 1}: ${mediaResponse.status} - ${mediaResponseText}`);
            
            if (!mediaResponse.ok) {
              console.error(`❌ Erro ao enviar mídia ${mediaIndex + 1}`);
            }
          }
        } else {
          // Enviar apenas texto se não há mídias
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

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${responseText}`);
          }
        }

        console.log('✅ Mensagem de aniversário enviada com sucesso');
        successCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: telefoneContato,
          status: 'sucesso'
        });

      } catch (error) {
        console.error(`❌ Erro geral ao enviar para ${aniversariante.nome}:`, error);
        errorCount++;
        results.push({
          nome: aniversariante.nome,
          telefone: telefoneContato,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`\n🎉 Envio de aniversários concluído: ${successCount} sucessos, ${errorCount} erros`);

    // Log do envio (apenas no modo automático)
    if (!teste) {
      await supabase.from('logs_aniversario').insert({
        quantidade: aniversariantes.length,
        success: errorCount === 0,
        aniversariantes: results,
        data_envio: new Date().toISOString(),
        error_message: errorCount > 0 ? `${errorCount} erros de envio` : null,
        teste: false
      });
    }

    return new Response(JSON.stringify({
      success: true,
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
      success: false,
      error: error.message,
      details: 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});