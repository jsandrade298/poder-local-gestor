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
    const { action, instanceName } = await req.json();
    
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API não configurado. Verifique as variáveis de ambiente.');
    }

    console.log(`Evolution API URL: ${evolutionApiUrl}`);
    console.log(`Evolution API Key configured: ${evolutionApiKey ? 'Yes' : 'No'}`);
    console.log(`Action: ${action}`);
    console.log(`Instance: ${instanceName}`);

    const headers = {
      'Content-Type': 'application/json',
      'apikey': evolutionApiKey,
    };

    let result;

    switch (action) {
      case 'create_instance':
        if (!instanceName) {
          throw new Error('Nome da instância é obrigatório');
        }

        const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: instanceName,
            token: evolutionApiKey,
            qrcode: true,
            number: "",
            typebot: "",
            webhook: "",
            webhook_by_events: false,
            events: [],
            reject_call: false,
            msg_call: "",
            groups_ignore: true,
            always_online: false,
            read_messages: false,
            read_status: false,
            websocket_enabled: false,
            websocket_events: []
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Erro ao criar instância:', errorText);
          throw new Error(`Erro ao criar instância: ${createResponse.status} - ${errorText}`);
        }

        result = await createResponse.json();
        console.log('Instância criada:', result);
        break;

      case 'connect_instance':
        if (!instanceName) {
          throw new Error('Nome da instância é obrigatório');
        }

        const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers,
        });

        if (!connectResponse.ok) {
          const errorText = await connectResponse.text();
          console.error('Erro ao conectar instância:', errorText);
          throw new Error(`Erro ao conectar instância: ${connectResponse.status} - ${errorText}`);
        }

        result = await connectResponse.json();
        console.log('Resposta da conexão:', result);
        break;

      case 'list_instances':
        const listResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers,
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error('Erro ao listar instâncias:', errorText);
          throw new Error(`Erro ao listar instâncias: ${listResponse.status} - ${errorText}`);
        }

        const instances = await listResponse.json();
        console.log('Instâncias encontradas:', instances);
        
        result = {
          instances: Array.isArray(instances) ? instances.map((inst: any) => ({
            instanceName: inst.instance?.instanceName || inst.instanceName,
            status: inst.instance?.connectionStatus || inst.connectionStatus || 'disconnected',
            profileName: inst.instance?.profileName || inst.profileName,
            number: inst.instance?.number || inst.number
          })) : []
        };
        break;

      case 'instance_status':
        if (!instanceName) {
          throw new Error('Nome da instância é obrigatório');
        }

        const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers,
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error('Erro ao verificar status:', errorText);
          throw new Error(`Erro ao verificar status: ${statusResponse.status} - ${errorText}`);
        }

        const statusData = await statusResponse.json();
        console.log('Status da instância:', statusData);
        
        result = {
          status: {
            status: statusData.instance?.connectionStatus || 'disconnected',
            profileName: statusData.instance?.profileName,
            number: statusData.instance?.number
          }
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