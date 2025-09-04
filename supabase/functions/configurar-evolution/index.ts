import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestBody = await req.json();
    const { action, instanceName } = requestBody;
    
    console.log('=== Request Debug ===');
    console.log('Action:', action);
    console.log('Instance:', instanceName);

    // Para list_instances não precisa de instanceName
    if (action === 'list_instances') {
      try {
        const { data: dbInstances } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('active', true);

        // Buscar status de todas as instâncias de uma vez
        if (dbInstances.length === 0) {
          return new Response(
            JSON.stringify({ instances: [] }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const fetchUrl = `${dbInstances[0].api_url}/instance/fetchInstances`;
        const response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': dbInstances[0].instance_token, // Usar token de qualquer instância
          },
        });

        let apiInstances = [];
        if (response.ok) {
          const data = await response.json();
          apiInstances = Array.isArray(data) ? data : (data.instances || []);
          console.log('API instances:', apiInstances);
        }

        const instancesWithStatus = dbInstances.map(dbInst => {
          // Procurar correspondência na API
          const apiInst = apiInstances.find(api => 
            api.id === dbInst.instance_id || 
            api.name === dbInst.instance_name
          );
          
          const isConnected = apiInst && apiInst.connectionStatus === 'open';
          
          return {
            instanceName: dbInst.instance_name,
            displayName: dbInst.display_name,
            status: isConnected ? 'connected' : 'disconnected',
            profileName: apiInst?.profileName,
            number: apiInst?.ownerJid?.replace('@s.whatsapp.net', '')
          };
        });

        return new Response(
          JSON.stringify({ instances: instancesWithStatus }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('List instances error:', error);
        return new Response(
          JSON.stringify({ 
            instances: [],
            error: error.message 
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Para outras ações, precisa de instanceName
    if (!instanceName) {
      return new Response(
        JSON.stringify({ error: 'instanceName é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Buscar configuração da instância
    const { data: instanceConfig, error: configError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .single();

    if (configError || !instanceConfig) {
      console.error('Instance not found:', instanceName, configError);
      return new Response(
        JSON.stringify({ error: `Instância ${instanceName} não encontrada no banco` }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('=== Instance Config ===');
    console.log('Instance ID:', instanceConfig.instance_id);
    console.log('API URL:', instanceConfig.api_url);
    console.log('Token (first 10 chars):', instanceConfig.instance_token?.substring(0, 10));

    // Headers para Evolution API
    const apiHeaders = {
      'Content-Type': 'application/json',
      'apikey': instanceConfig.instance_token,
    };

    let result;

    switch (action) {
      case 'connect_instance':
        try {
          // Passo 1: Verificar status atual
          const statusUrl = `${instanceConfig.api_url}/instance/connectionState/${instanceConfig.instance_id}`;
          console.log('Checking status at:', statusUrl);
          
          try {
            const statusResponse = await fetch(statusUrl, {
              method: 'GET',
              headers: apiHeaders,
            });

            console.log('Status response:', statusResponse.status);
            
            if (statusResponse.ok) {
              const statusText = await statusResponse.text();
              console.log('Status response body:', statusText);
              
              try {
                const statusData = JSON.parse(statusText);
                
                // Verificar diferentes formatos de resposta
                const isConnected = 
                  statusData?.state === 'open' || 
                  statusData?.instance?.state === 'open' ||
                  statusData?.connection?.state === 'open';
                
                if (isConnected) {
                  result = {
                    success: true,
                    status: 'connected',
                    message: 'WhatsApp já está conectado'
                  };
                  break;
                }
              } catch (parseError) {
                console.log('Could not parse status response as JSON');
              }
            }
          } catch (statusError) {
            console.log('Status check failed, continuing to QR generation');
          }

          // Passo 2: Gerar QR Code
          const connectUrl = `${instanceConfig.api_url}/instance/connect/${instanceConfig.instance_id}`;
          console.log('Generating QR at:', connectUrl);
          
          const connectResponse = await fetch(connectUrl, {
            method: 'GET',
            headers: apiHeaders,
          });

          console.log('Connect response status:', connectResponse.status);
          
          if (!connectResponse.ok) {
            const errorText = await connectResponse.text();
            console.error('Connect error response:', errorText);
            
            // Tentar endpoint alternativo
            const altUrl = `${instanceConfig.api_url}/instance/qrcode/base64/${instanceConfig.instance_id}`;
            console.log('Trying alternative endpoint:', altUrl);
            
            const altResponse = await fetch(altUrl, {
              method: 'GET',
              headers: apiHeaders,
            });
            
            if (altResponse.ok) {
              const altText = await altResponse.text();
              try {
                const altData = JSON.parse(altText);
                const qrcode = altData.qrcode || altData.base64 || altData.qr;
                
                if (qrcode) {
                  result = {
                    success: true,
                    status: 'connecting',
                    qrcode: qrcode.startsWith('data:image') ? qrcode : `data:image/png;base64,${qrcode}`,
                    message: 'QR Code gerado (endpoint alternativo)'
                  };
                  break;
                }
              } catch (e) {
                console.error('Failed to parse alternative response');
              }
            }
            
            throw new Error(`Evolution API retornou erro: ${connectResponse.status}`);
          }

          const responseText = await connectResponse.text();
          console.log('Connect response body:', responseText);
          
          // Tentar parsear a resposta
          try {
            const connectData = JSON.parse(responseText);
            console.log('Parsed connect data:', connectData);
            
            // Procurar QR code em diferentes campos
            const qrcode = 
              connectData?.qrcode?.base64 || 
              connectData?.qrcode || 
              connectData?.base64 || 
              connectData?.qr || 
              connectData?.code ||
              connectData?.data?.qrcode ||
              connectData?.data?.base64;
            
            if (qrcode) {
              // Garantir formato correto
              const formattedQr = qrcode.startsWith('data:image') 
                ? qrcode 
                : `data:image/png;base64,${qrcode}`;
              
              result = {
                success: true,
                status: 'connecting',
                qrcode: formattedQr,
                message: 'QR Code gerado com sucesso'
              };
            } else if (connectData?.pairingCode || connectData?.code) {
              result = {
                success: true,
                status: 'connecting',
                pairingCode: connectData.pairingCode || connectData.code,
                message: 'Use o código de pareamento'
              };
            } else {
              console.error('No QR code found in response');
              result = {
                success: false,
                error: 'QR Code não encontrado na resposta',
                debugData: connectData
              };
            }
          } catch (parseError) {
            console.error('Failed to parse connect response:', parseError);
            result = {
              success: false,
              error: 'Resposta inválida da API',
              rawResponse: responseText.substring(0, 200)
            };
          }
        } catch (error) {
          console.error('Connect error:', error);
          result = {
            success: false,
            error: error.message || 'Erro ao conectar'
          };
        }
        break;

        case 'instance_status':
          try {
            // Evolution API Cloud usa fetchInstances para obter status
            const fetchUrl = `${instanceConfig.api_url}/instance/fetchInstances`;
            console.log('Fetching instances from:', fetchUrl);
            
            const response = await fetch(fetchUrl, {
              method: 'GET',
              headers: apiHeaders,
            });

            if (response.ok) {
              const data = await response.json();
              const instances = Array.isArray(data) ? data : (data.instances || []);
              
              // Procurar nossa instância específica
              const ourInstance = instances.find(inst => 
                inst.id === instanceConfig.instance_id || 
                inst.name === instanceName
              );
              
              console.log('Found instance:', ourInstance);
              
              if (ourInstance) {
                // IMPORTANTE: Evolution API Cloud usa "connectionStatus" com valores "open" ou "close"
                const isConnected = ourInstance.connectionStatus === 'open';
                
                result = {
                  status: isConnected ? 'connected' : 'disconnected',
                  profileName: ourInstance.profileName,
                  phoneNumber: ourInstance.ownerJid?.replace('@s.whatsapp.net', ''),
                  profilePicUrl: ourInstance.profilePicUrl,
                  details: {
                    connectionStatus: ourInstance.connectionStatus,
                    ownerJid: ourInstance.ownerJid
                  }
                };
              } else {
                result = {
                  status: 'disconnected',
                  error: 'Instance not found in list'
                };
              }
            } else {
              console.error('Failed to fetch instances:', response.status);
              result = {
                status: 'disconnected',
                error: `Failed to fetch instances: ${response.status}`
              };
            }
          } catch (error) {
            console.error('Status check error:', error);
            result = {
              status: 'disconnected',
              error: error.message
            };
          }
          break;

      case 'disconnect_instance':
        try {
          const logoutUrl = `${instanceConfig.api_url}/instance/logout/${instanceConfig.instance_id}`;
          const logoutResponse = await fetch(logoutUrl, {
            method: 'DELETE',
            headers: apiHeaders,
          });

          result = {
            success: logoutResponse.ok,
            message: logoutResponse.ok ? 'Desconectado' : 'Erro ao desconectar'
          };
        } catch (error) {
          result = {
            success: false,
            error: error.message
          };
        }
        break;

      case 'send_message':
        try {
          const { phone, message } = requestBody;
          
          const sendUrl = `${instanceConfig.api_url}/message/sendText/${instanceConfig.instance_id}`;
          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              number: phone,
              text: message,
              delay: 1000
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
        } catch (error) {
          result = {
            success: false,
            error: error.message
          };
        }
        break;

      default:
        result = {
          error: `Ação desconhecida: ${action}`
        };
    }

    console.log('=== Final Result ===');
    console.log(JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('=== Edge Function Error ===');
    console.error(error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno',
        details: 'Verifique os logs da Edge Function no Supabase'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});