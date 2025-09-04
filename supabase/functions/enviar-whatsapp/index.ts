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

    if (!mensagem && mediaFiles.length === 0) {
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
      const rawPhone = phoneList[i];
      const normalizedPhone = normalizePhone(rawPhone);
      
      console.log(`[${i + 1}/${phoneList.length}] Enviando para: ${normalizedPhone}`);
      
      // Delay entre mensagens
      if (i > 0) {
        const delay = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
        await new Promise(r => setTimeout(r, delay * 1000));
      }
      
      try {
        let messageSent = false;
        
        // Enviar mídias se houver
        for (const media of mediaFiles) {
          const mediaUrl = `${instance.api_url}/message/sendMedia/${instance.instance_id}`;
          
          const mediaPayload = {
            number: normalizedPhone,
            mediatype: media.type,
            media: media.url,
            caption: !messageSent && mensagem ? mensagem : undefined
          };
          
          // Para áudio, usar endpoint específico
          if (media.type === 'audio') {
            const audioUrl = `${instance.api_url}/message/sendWhatsAppAudio/${instance.instance_id}`;
            const audioResponse = await fetch(audioUrl, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({
                number: normalizedPhone,
                audio: media.url
              })
            });
            
            if (audioResponse.ok) {
              messageSent = true;
            }
          } else {
            const mediaResponse = await fetch(mediaUrl, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify(mediaPayload)
            });
            
            if (mediaResponse.ok && mensagem) {
              messageSent = true;
            }
          }
        }
        
        // Enviar texto se ainda não foi enviado como caption
        if (mensagem && !messageSent) {
          const textUrl = `${instance.api_url}/message/sendText/${instance.instance_id}`;
          const textResponse = await fetch(textUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              number: normalizedPhone,
              text: mensagem
            })
          });
          
          if (textResponse.ok) {
            successCount++;
            results.push({
              telefone: rawPhone,
              status: 'sucesso',
              mensagem: 'Enviado com sucesso'
            });
          } else {
            errorCount++;
            const error = await textResponse.text();
            results.push({
              telefone: rawPhone,
              status: 'erro',
              erro: `Erro ao enviar: ${textResponse.status}`
            });
          }
        } else if (messageSent || mediaFiles.length > 0) {
          successCount++;
          results.push({
            telefone: rawPhone,
            status: 'sucesso',
            mensagem: 'Mídia enviada com sucesso'
          });
        }
        
      } catch (error) {
        console.error(`Erro ao enviar para ${rawPhone}:`, error);
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