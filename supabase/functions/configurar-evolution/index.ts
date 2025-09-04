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
      const { data: allInstances } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('active', true);

      const instancesWithStatus = [];
      
      // Primeiro, tentar buscar todas as instâncias de uma vez
      let connectedInstances = [];
      try {
        const fetchAllUrl = `https://api.evoapicloud.com/instance/fetchInstances`;
        const fetchAllResponse = await fetch(fetchAllUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': allInstances[0]?.instance_token, // Usar o token de qualquer instância
          },
        });
        
        if (fetchAllResponse.ok) {
          const allData = await fetchAllResponse.json();
          connectedInstances = Array.isArray(allData) ? allData : (allData.instances || []);
          console.log('Connected instances from API:', connectedInstances);
        }
      } catch (e) {
        console.log('Could not fetch all instances at once');
      }
      
      for (const instance of allInstances || []) {
        // Verificar se está na lista de conectadas
        const connectedInstance = connectedInstances.find(ci => 
          ci.instanceId === instance.instance_id || 
          ci.instance_id === instance.instance_id ||
          ci.instanceName === instance.instance_name
        );
        
        const isConnected = connectedInstance && 
          (connectedInstance.state === 'open' || 
           connectedInstance.status === 'open' || 
           connectedInstance.connected === true);
        
        instancesWithStatus.push({
          instanceName: instance.instance_name,
          displayName: instance.display_name,
          status: isConnected ? 'connected' : 'disconnected',
          profileName: connectedInstance?.profileName || connectedInstance?.pushname,
          number: connectedInstance?.number || connectedInstance?.phone
        });
      }
      
      return new Response(
        JSON.stringify({ instances: instancesWithStatus }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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
            console.log('=== Checking instance status ===');
            console.log('Instance:', instanceName);
            console.log('Instance ID:', instanceConfig.instance_id);
            
            // Tentar múltiplos endpoints da Evolution API
            const endpoints = [
              `/instance/connectionState/${instanceConfig.instance_id}`,
              `/instance/status/${instanceConfig.instance_id}`,
              `/instance/state/${instanceConfig.instance_id}`,
              `/instance/info/${instanceConfig.instance_id}`,
              `/instance/fetchInstances`, // Buscar todas e filtrar
            ];
            
            let finalStatus = 'disconnected';
            let profileData = {};
            
            for (const endpoint of endpoints) {
              try {
                const url = `${instanceConfig.api_url}${endpoint}`;
                console.log(`Trying endpoint: ${url}`);
                
                const response = await fetch(url, {
                  method: 'GET',
                  headers: apiHeaders,
                });
                
                if (response.ok) {
                  const text = await response.text();
                  console.log(`Response from ${endpoint}:`, text.substring(0, 500));
                  
                  try {
                    const data = JSON.parse(text);
                    
                    // Se for o fetchInstances, procurar nossa instância
                    if (endpoint.includes('fetchInstances')) {
                      const instances = Array.isArray(data) ? data : (data.instances || []);
                      const ourInstance = instances.find(
                        inst => inst.instanceId === instanceConfig.instance_id || 
                               inst.instance_id === instanceConfig.instance_id ||
                               inst.instanceName === instanceName
                      );
                      
                      if (ourInstance) {
                        console.log('Found our instance in list:', ourInstance);
                        const isConnected = 
                          ourInstance.state === 'open' || 
                          ourInstance.status === 'open' ||
                          ourInstance.connectionStatus === 'open' ||
                          ourInstance.connected === true;
                        
                        if (isConnected) {
                          finalStatus = 'connected';
                          profileData = ourInstance;
                          break;
                        }
                      }
                    } else {
                      // Verificar status em vários campos possíveis
                      const isConnected = 
                        data?.state === 'open' ||
                        data?.status === 'open' ||
                        data?.instance?.state === 'open' ||
                        data?.instance?.status === 'open' ||
                        data?.instance?.connectionStatus === 'open' ||
                        data?.connectionStatus === 'open' ||
                        data?.connection === 'open' ||
                        data?.connected === true ||
                        data?.instance?.connected === true ||
                        data?.instance?.connection === 'open' ||
                        // Adicionar mais verificações para Evolution API Cloud
                        data?.instance?.ownerJid !== null ||
                        data?.instance?.phoneNumber !== null ||
                        data?.phoneConnected === true;
                      
                      console.log('Connection check result:', isConnected);
                      console.log('Data keys:', Object.keys(data));
                      if (data.instance) {
                        console.log('Instance keys:', Object.keys(data.instance));
                      }
                      
                      if (isConnected) {
                        finalStatus = 'connected';
                        profileData = data?.instance || data;
                        break; // Encontrou conectado, parar de tentar
                      }
                    }
                  } catch (parseError) {
                    console.error(`Failed to parse response from ${endpoint}`);
                  }
                } else {
                  console.log(`Endpoint ${endpoint} returned status:`, response.status);
                }
              } catch (endpointError) {
                console.log(`Endpoint ${endpoint} failed:`, endpointError.message);
              }
            }
            
            // Tentar uma última verificação via instâncias ativas
            if (finalStatus === 'disconnected') {
              try {
                const allInstancesUrl = `${instanceConfig.api_url}/instance/fetchInstances`;
                const allResponse = await fetch(allInstancesUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': instanceConfig.instance_token,
                  },
                });
                
                if (allResponse.ok) {
                  const allData = await allResponse.json();
                  console.log('All instances check:', allData);
                  
                  const instances = Array.isArray(allData) ? allData : (allData.instances || []);
                  const connected = instances.find(inst => 
                    (inst.instanceName === instanceName || 
                     inst.instanceId === instanceConfig.instance_id ||
                     inst.instance_id === instanceConfig.instance_id) &&
                    (inst.state === 'open' || inst.status === 'open' || inst.connected === true)
                  );
                  
                  if (connected) {
                    console.log('Found connected instance:', connected);
                    finalStatus = 'connected';
                    profileData = connected;
                  }
                }
              } catch (e) {
                console.error('Final instances check failed:', e);
              }
            }
            
            result = {
              status: finalStatus,
              profileName: profileData?.profileName || profileData?.pushname || profileData?.name,
              phoneNumber: profileData?.number || profileData?.phone || profileData?.ownerJid?.split('@')[0],
              details: profileData
            };
            
            console.log('=== Final status result ===');
            console.log(result);
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