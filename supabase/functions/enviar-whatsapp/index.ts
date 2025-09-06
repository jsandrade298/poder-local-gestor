import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração do Supabase ausente");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const requestData = await req.json();
    const {
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 1,
      tempoMaximo = 3,
      mediaFiles = [],
      customMessages = {},
    } = requestData;

    console.log("=== INICIANDO ENVIO WHATSAPP ===");
    console.log("Instância:", instanceName);
    console.log("Total telefones:", telefones.length);
    console.log("Incluir todos:", incluirTodos);
    console.log("Mídias:", mediaFiles.length);

    // Validações
    if (!instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "Instância WhatsApp é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mensagem && mediaFiles.length === 0 && Object.keys(customMessages).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Envie uma mensagem ou arquivo de mídia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração da instância
    const { data: instance, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .eq("active", true)
      .single();

    if (instErr || !instance) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Instância ${instanceName} não encontrada ou inativa`
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Instância encontrada:", instance.display_name);
    console.log("Instance ID:", instance.instance_id);

    // Montar lista de telefones
    let phoneList = [...telefones];
    
    if (incluirTodos) {
      const { data: municipes } = await supabase
        .from("municipes")
        .select("telefone")
        .not("telefone", "is", null);
        
      if (municipes) {
        phoneList = municipes.map(m => m.telefone).filter(Boolean);
      }
    }
    
    // Remover duplicatas
    phoneList = [...new Set(phoneList)];
    
    if (phoneList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone válido para envio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enviando para ${phoneList.length} números`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Headers para Evolution API
    const apiHeaders = {
      'Content-Type': 'application/json',
      'apikey': instance.instance_token,
    };
    
    console.log('API URL:', instance.api_url);
    console.log('Instance ID:', instance.instance_id);
    console.log('Token configurado:', instance.instance_token ? 'Sim' : 'Não');

    // Função auxiliar para converter formatos de áudio
    const convertAudioFormat = (mimeType: string): string => {
      const audioMap: Record<string, string> = {
        'audio/x-m4a': 'audio/mp4',
        'audio/m4a': 'audio/mp4',
        'audio/mp4a-latm': 'audio/mp4',
        'audio/aac': 'audio/aac',
        'audio/mpeg': 'audio/mpeg',
        'audio/ogg': 'audio/ogg',
        'audio/wav': 'audio/wav',
        'audio/webm': 'audio/webm'
      };
      
      return audioMap[mimeType] || mimeType;
    };

    // Função para normalizar número brasileiro
    const normalizePhone = (phone) => {
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

    // Processar cada telefone
    for (let i = 0; i < phoneList.length; i++) {
      // Se phoneList contém objetos, extrair o telefone
      const telefoneItem = phoneList[i];
      const rawPhone = typeof telefoneItem === 'object' ? telefoneItem.telefone : telefoneItem;
      const normalizedPhone = normalizePhone(rawPhone);
      
      console.log(`\n📱 [${i + 1}/${phoneList.length}] Processando: ${normalizedPhone}`);
      
      // IMPORTANTE: Aplicar delay ANTES de processar (exceto no primeiro)
      if (i > 0) {
        // Calcular delay aleatório entre min e max
        const delaySeconds = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
        const delayMs = Math.round(delaySeconds * 1000);
        
        console.log(`⏳ Aguardando ${delayMs}ms (${delaySeconds.toFixed(1)}s) antes do próximo envio...`);
        
        // Aguardar o delay configurado
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        console.log('✅ Delay concluído, enviando próxima mensagem...');
      }
      
      try {
        let messageSent = false;
        let mediaIndex = 0;
        
        // Enviar mídias se houver
        for (const media of mediaFiles) {
          // Delay entre mídias (exceto na primeira)
          if (mediaIndex > 0) {
            const mediaDelay = 1000; // 1 segundo entre mídias
            console.log(`⏱️ Aguardando ${mediaDelay}ms entre mídias...`);
            await new Promise(r => setTimeout(r, mediaDelay));
          }
          
          console.log(`📎 Enviando mídia ${media.mimetype} (${mediaIndex + 1}/${mediaFiles.length})`);
          
          // Detectar tipo de mídia pelo mimetype
          let mediaType = 'document'; // padrão
          if (media.mimetype.startsWith('image/')) {
            mediaType = 'image';
          } else if (media.mimetype.startsWith('video/')) {
            mediaType = 'video';
          } else if (media.mimetype.startsWith('audio/')) {
            mediaType = 'audio';
          }
          try {
            if (mediaType === 'audio') {
              // Tratamento especial para áudio
              const audioUrl = `${instance.api_url}/message/sendWhatsAppAudio/${instance.instance_id}`;
              
              // Detectar formato correto do áudio
              if (media.filename && (media.filename.endsWith('.m4a') || media.filename.includes('m4a'))) {
                console.log('🎵 Detectado arquivo M4A, tratando como audio/mp4');
              }
              
              const audioPayload = {
                number: normalizedPhone,
                audio: media.data, // Enviar só o base64 sem prefixo
                encoding: true,
                delay: 1200
              };
              
              const audioResponse = await fetch(audioUrl, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(audioPayload)
              });
              
              const audioResult = await audioResponse.text();
              console.log('Resposta do envio de áudio:', audioResult);
              
              if (audioResponse.ok) {
                console.log('✅ Áudio enviado com sucesso');
                successCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: 'audio',
                  status: 'sucesso',
                  mensagem: 'Áudio enviado'
                });
              } else {
                console.error('❌ Erro ao enviar áudio:', audioResult);
                errorCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: 'audio',
                  status: 'erro',
                  erro: `Erro no áudio: ${audioResponse.status}`
                });
              }
            } else if (mediaType === 'document') {
              // Documentos (PDF, DOC, etc)
              const docUrl = `${instance.api_url}/message/sendMedia/${instance.instance_id}`;
              const docPayload = {
                number: normalizedPhone,
                mediatype: 'document',
                media: media.data, // Enviar só o base64 sem prefixo
                fileName: media.filename || 'documento.pdf',
                delay: 1200
              };
              
              if (!messageSent && mensagem) {
                docPayload.caption = mensagem;
                messageSent = true;
              }
              
              const docResponse = await fetch(docUrl, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(docPayload)
              });
              
              if (docResponse.ok) {
                console.log('✅ Documento enviado com sucesso');
                successCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: 'document',
                  status: 'sucesso',
                  mensagem: 'Documento enviado'
                });
              } else {
                errorCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: 'document',
                  status: 'erro',
                  erro: `Erro no documento: ${docResponse.status}`
                });
              }
            } else {
              // Imagens e vídeos
              const mediaUrl = `${instance.api_url}/message/sendMedia/${instance.instance_id}`;
              const mediaPayload = {
                number: normalizedPhone,
                mediatype: mediaType,
                media: media.data, // Enviar só o base64 sem prefixo
                delay: 1200
              };
              
               // Adicionar caption na primeira mídia visual
               const mensagemParaEnviar = customMessages[rawPhone] || mensagem;
               if (!messageSent && mensagemParaEnviar && (mediaType === 'image' || mediaType === 'video')) {
                 mediaPayload.caption = mensagemParaEnviar;
                 messageSent = true;
               }
              
              const mediaResponse = await fetch(mediaUrl, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(mediaPayload)
              });
              
              if (mediaResponse.ok) {
                console.log(`✅ ${mediaType} enviado com sucesso`);
                successCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: mediaType,
                  status: 'sucesso',
                  mensagem: `${mediaType} enviado`
                });
              } else {
                errorCount++;
                results.push({
                  telefone: rawPhone,
                  tipo: mediaType,
                  status: 'erro',
                  erro: `Erro na ${mediaType}: ${mediaResponse.status}`
                });
              }
            }
          } catch (mediaError) {
            console.error(`❌ Erro ao processar mídia ${mediaType}:`, mediaError);
            errorCount++;
            results.push({
              telefone: rawPhone,
              tipo: mediaType,
              status: 'erro',
              erro: mediaError.message
            });
          }
          
          mediaIndex++;
        }
        
        // Enviar texto se houver e ainda não foi enviado como caption
        const mensagemParaEnviar = customMessages[rawPhone] || mensagem;
        if (mensagemParaEnviar && !messageSent) {
          // Pequeno delay se já enviou mídia
          if (mediaFiles.length > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
          
          console.log('💬 Enviando mensagem de texto');
          console.log('Custom messages disponíveis:', Object.keys(customMessages));
          console.log('Telefone atual:', rawPhone);
          console.log('Mensagem personalizada:', customMessages[rawPhone]);
          console.log('Mensagem final:', mensagemParaEnviar);
          
          const textUrl = `${instance.api_url}/message/sendText/${instance.instance_id}`;
          console.log('URL da API:', textUrl);
          console.log('Headers da API:', JSON.stringify(apiHeaders, null, 2));
          console.log('Payload:', JSON.stringify({
            number: normalizedPhone,
            text: mensagemParaEnviar,
            linkPreview: false,
            delay: 1200
          }, null, 2));
          
          const textResponse = await fetch(textUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              number: normalizedPhone,
              text: mensagemParaEnviar,
              linkPreview: false,
              delay: 1200
            })
          });
          
          const responseText = await textResponse.text();
          console.log('Status da resposta:', textResponse.status);
          console.log('Resposta completa da API:', responseText);
          
          if (textResponse.ok) {
            console.log('✅ Texto enviado com sucesso');
            successCount++;
            results.push({
              telefone: rawPhone,
              tipo: 'texto',
              status: 'sucesso',
              mensagem: 'Texto enviado'
            });
          } else {
            console.error('❌ Erro ao enviar texto:', responseText);
            errorCount++;
            results.push({
              telefone: rawPhone,
              tipo: 'texto',
              status: 'erro',
              erro: `Erro no texto: ${textResponse.status} - ${responseText}`
            });
          }
        }
        
        // Se não teve mensagem nem mídia mas chegou aqui, registrar como processado
        if (!mensagemParaEnviar && mediaFiles.length === 0) {
          results.push({
            telefone: rawPhone,
            status: 'erro',
            erro: 'Nenhum conteúdo para enviar'
          });
          errorCount++;
        }
        
      } catch (error) {
        console.error(`❌ Erro geral ao enviar para ${rawPhone}:`, error);
        errorCount++;
        results.push({
          telefone: rawPhone,
          status: 'erro',
          erro: error.message
        });
      }
    }

    console.log(`Envio concluído: ${successCount} sucessos, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        resumo: {
          total: phoneList.length,
          sucessos: successCount,
          erros: errorCount
        },
        resultados: results
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});