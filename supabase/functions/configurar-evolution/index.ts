import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, phone, message } = await req.json();
    
    console.log(`Action: ${action}, Instance: ${instanceName}`);

    // Buscar configurações da instância
    const { data: instanceConfig, error: configError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (configError || !instanceConfig) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    // Headers para Evolution API Cloud
    const headers = {
      'Content-Type': 'application/json',
      'apikey': instanceConfig.instance_token,
    };

    let result;

    switch (action) {
      case 'connect_instance':
        try {
          // Verificar status primeiro
          const statusUrl = `${instanceConfig.api_url}/instance/connectionState/${instanceConfig.instance_id}`;
          console.log('Verificando status:', statusUrl);
          
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers,
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('Status atual:', statusData);
            
            if (statusData.state === 'open' || statusData.instance?.state === 'open') {
              result = {
                success: true,
                status: 'connected',
                message: 'WhatsApp já está conectado'
              };
              break;
            }
          }

          // Gerar QR Code
          const qrUrl = `${instanceConfig.api_url}/instance/connect/${instanceConfig.instance_id}`;
          console.log('Gerando QR Code:', qrUrl);
          
          const qrResponse = await fetch(qrUrl, {
            method: 'GET',
            headers,
          });

          if (qrResponse.ok) {
            const qrData = await qrResponse.json();
            console.log('QR Code response:', qrData);
            
            // Evolution API Cloud retorna o QR em diferentes formatos
            const qrcode = qrData.qrcode?.base64 || qrData.base64 || qrData.qr || qrData.code;
            
            if (qrcode) {
              // Se não tem o prefixo data:image, adicionar
              const qrcodeFormatted = qrcode.startsWith('data:image') 
                ? qrcode 
                : `data:image/png;base64,${qrcode}`;
                
              result = {
                success: true,
                status: 'connecting',
                qrcode: qrcodeFormatted,
                message: 'QR Code gerado com sucesso'
              };
            } else {
              result = {
                success: true,
                status: 'connecting',
                pairingCode: qrData.pairingCode || qrData.code,
                message: 'Use o código de pareamento no WhatsApp'
              };
            }
          } else {
            const errorText = await qrResponse.text();
            console.error('Erro ao gerar QR:', errorText);
            throw new Error(`Erro ao gerar QR Code: ${qrResponse.status}`);
          }
        } catch (error) {
          console.error('Erro completo:', error);
          throw error;
        }
        break;

      case 'instance_status':
        const statusUrl = `${instanceConfig.api_url}/instance/connectionState/${instanceConfig.instance_id}`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers,
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const isConnected = statusData.state === 'open' || statusData.instance?.state === 'open';
          
          result = {
            status: isConnected ? 'connected' : 'disconnected',
            state: statusData.state,
            instance: statusData.instance
          };
        } else {
          result = {
            status: 'disconnected',
            state: 'close'
          };
        }
        break;

      case 'list_instances':
        const { data: allInstances } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('active', true);

        const instancesWithStatus = [];
        
        for (const instance of allInstances || []) {
          try {
            const statusHeaders = {
              'Content-Type': 'application/json',
              'apikey': instance.instance_token,
            };
            
            const statusResponse = await fetch(
              `${instance.api_url}/instance/connectionState/${instance.instance_id}`,
              { method: 'GET', headers: statusHeaders }
            );

            let connectionStatus = 'disconnected';
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              connectionStatus = (statusData.state === 'open' || statusData.instance?.state === 'open') 
                ? 'connected' 
                : 'disconnected';
            }

            instancesWithStatus.push({
              instanceName: instance.instance_name,
              displayName: instance.display_name,
              status: connectionStatus
            });
          } catch (error) {
            console.error(`Erro ao verificar ${instance.instance_name}:`, error);
            instancesWithStatus.push({
              instanceName: instance.instance_name,
              displayName: instance.display_name,
              status: 'disconnected'
            });
          }
        }
        
        result = { instances: instancesWithStatus };
        break;

      case 'disconnect_instance':
        const logoutUrl = `${instanceConfig.api_url}/instance/logout/${instanceConfig.instance_id}`;
        const logoutResponse = await fetch(logoutUrl, {
          method: 'DELETE',
          headers,
        });

        if (logoutResponse.ok) {
          result = {
            success: true,
            message: 'Instância desconectada com sucesso'
          };
        } else {
          throw new Error('Erro ao desconectar instância');
        }
        break;

      case 'send_message':
        const sendUrl = `${instanceConfig.api_url}/message/sendText/${instanceConfig.instance_id}`;
        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: phone,
            text: message
          })
        });

        if (sendResponse.ok) {
          const sendData = await sendResponse.json();
          result = {
            success: true,
            message: 'Mensagem enviada',
            data: sendData
          };
        } else {
          throw new Error('Erro ao enviar mensagem');
        }
        break;

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Verifique os logs para mais detalhes'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});