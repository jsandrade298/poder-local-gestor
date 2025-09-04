import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName } = await req.json();
    
    console.log(`Action: ${action}, Instance: ${instanceName}`);

    // Buscar configurações da instância no banco de dados
    const { data: instanceConfig, error: configError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .single();

    if (configError || !instanceConfig) {
      throw new Error(`Configuração da instância ${instanceName} não encontrada`);
    }

    if (!instanceConfig.api_url || !instanceConfig.instance_token) {
      throw new Error(`Configuração incompleta para a instância ${instanceName}`);
    }

    console.log(`Using API URL: ${instanceConfig.api_url}`);
    console.log(`Instance ID: ${instanceConfig.instance_id}`);
    console.log(`Token (first 10 chars): ${instanceConfig.instance_token.substring(0, 10)}...`);

    // Headers para Evolution API - testando diferentes formatos
    const headers = {
      'Content-Type': 'application/json',
      'apikey': instanceConfig.instance_token,
      'Authorization': `ApiKey ${instanceConfig.instance_token}`,
      'X-API-Key': instanceConfig.instance_token,
    };

    let result;

    switch (action) {
      case 'create_instance':
        // Para instâncias já configuradas, não precisamos criar novamente
        result = {
          success: true,
          message: `Instância ${instanceName} já está configurada`,
          instanceName: instanceName
        };
        break;

      case 'connect_instance':
        if (!instanceName) {
          throw new Error('Nome da instância é obrigatório');
        }

        console.log(`Attempting connection to: ${instanceConfig.api_url}/instance/connect/${instanceName}`);
        console.log(`Using headers:`, JSON.stringify(headers, null, 2));
        
        const connectResponse = await fetch(`${instanceConfig.api_url}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers,
        });

        console.log(`Response status: ${connectResponse.status}`);
        console.log(`Response headers:`, JSON.stringify(Object.fromEntries(connectResponse.headers.entries()), null, 2));

        if (!connectResponse.ok) {
          const errorText = await connectResponse.text();
          console.error('Erro ao conectar instância:', errorText);
          
          // Tentar com apikey em vez de Authorization
          const alternativeHeaders = {
            'Content-Type': 'application/json',
            'apikey': instanceConfig.instance_token,
          };
          
          console.log('Tentando com headers alternativos:', JSON.stringify(alternativeHeaders, null, 2));
          
          const retryResponse = await fetch(`${instanceConfig.api_url}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: alternativeHeaders,
          });
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error('Erro na segunda tentativa:', retryErrorText);
            throw new Error(`Erro ao conectar instância: ${retryResponse.status} - ${retryErrorText}`);
          }
          
          result = await retryResponse.json();
        } else {
          result = await connectResponse.json();
        }
        
        console.log('Resposta da conexão:', result);
        break;

      case 'list_instances':
        // Buscar todas as instâncias do banco
        const { data: allInstances, error: listError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('active', true);

        if (listError) {
          throw new Error('Erro ao buscar instâncias do banco de dados');
        }

        // Para cada instância, verificar status na API
        const instancesWithStatus = [];
        for (const instance of allInstances || []) {
          try {
            const statusHeaders = {
              'Content-Type': 'application/json',
              'apikey': instance.instance_token,
            };
            
            const statusResponse = await fetch(`${instance.api_url}/instance/connectionState/${instance.instance_name}`, {
              method: 'GET',
              headers: statusHeaders,
            });

            let connectionStatus = 'disconnected';
            let profileName = null;
            let phoneNumber = null;

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              connectionStatus = statusData.instance?.connectionStatus || 'disconnected';
              profileName = statusData.instance?.profileName;
              phoneNumber = statusData.instance?.number;
            }

            instancesWithStatus.push({
              instanceName: instance.instance_name,
              displayName: instance.display_name,
              status: connectionStatus,
              profileName: profileName,
              number: phoneNumber
            });
          } catch (error) {
            console.error(`Erro ao verificar status da instância ${instance.instance_name}:`, error);
            instancesWithStatus.push({
              instanceName: instance.instance_name,
              displayName: instance.display_name,
              status: 'disconnected',
              profileName: null,
              number: null
            });
          }
        }
        
        result = {
          instances: instancesWithStatus
        };
        break;

      case 'instance_status':
        if (!instanceName) {
          throw new Error('Nome da instância é obrigatório');
        }

        const statusHeaders = {
          'Content-Type': 'application/json',
          'apikey': instanceConfig.instance_token,
        };

        const statusResponse = await fetch(`${instanceConfig.api_url}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: statusHeaders,
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error('Erro ao verificar status:', errorText);
          throw new Error(`Erro ao verificar status: ${statusResponse.status} - ${errorText}`);
        }

        const statusData = await statusResponse.json();
        console.log('Status da instância:', statusData);
        
        result = {
          status: statusData.instance?.connectionStatus || 'disconnected',
          profileName: statusData.instance?.profileName,
          phoneNumber: statusData.instance?.number
        };
        break;

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função configurar-evolution:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Verifique se o Evolution API está rodando e as credenciais estão corretas'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});