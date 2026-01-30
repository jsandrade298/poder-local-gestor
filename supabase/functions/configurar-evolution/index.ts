import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Configuração padrão Z-API
const ZAPI_DEFAULT_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_DEFAULT_TOKEN = "8FBCD627DCF04CA3F24CD5EC";

/**
 * Constrói URL da Z-API
 */
function buildZApiUrl(instanceId: string, token: string, endpoint: string): string {
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
}

/**
 * Faz requisição para Z-API
 */
async function callZApi(
  instanceId: string, 
  token: string, 
  endpoint: string, 
  method: "GET" | "POST" | "DELETE" = "GET",
  payload?: any
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = buildZApiUrl(instanceId, token, endpoint);
  
  try {
    console.log(`🔄 Z-API ${method}: ${endpoint}`);
    
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Client-Token": token
      }
    };
    
    if (payload && method !== "GET") {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(url, options);
    const text = await response.text();
    
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Mantém como texto
    }
    
    console.log(`📡 Response ${response.status}`);
    
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: data?.error || data?.message || `HTTP ${response.status}`
      };
    }
    
    return { ok: true, status: response.status, data };
    
  } catch (error: any) {
    console.error("❌ Erro:", error);
    return {
      ok: false,
      status: 500,
      data: null,
      error: error.message
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestBody = await req.json();
    const { action, instanceName, phone, message } = requestBody;
    
    console.log('=== Z-API Config Request ===');
    console.log('Action:', action);
    console.log('Instance:', instanceName);

    // ========== LISTAR INSTÂNCIAS ==========
    if (action === 'list_instances') {
      try {
        const { data: dbInstances } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('active', true);

        if (!dbInstances || dbInstances.length === 0) {
          // Se não há instâncias no banco, usar a padrão
          const resp = await callZApi(ZAPI_DEFAULT_INSTANCE_ID, ZAPI_DEFAULT_TOKEN, 'status');
          
          if (resp.ok && resp.data) {
            return new Response(
              JSON.stringify({ 
                instances: [{
                  instanceName: 'gabinete-whats-01',
                  displayName: 'WhatsApp Principal (Z-API)',
                  status: resp.data.connected ? 'connected' : 'disconnected',
                  profileName: resp.data.name,
                  number: resp.data.phone
                }]
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ instances: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar status de cada instância
        const instancesWithStatus = await Promise.all(
          dbInstances.map(async (dbInst) => {
            const instId = dbInst.instance_id || ZAPI_DEFAULT_INSTANCE_ID;
            const instToken = dbInst.instance_token || ZAPI_DEFAULT_TOKEN;
            
            try {
              const resp = await callZApi(instId, instToken, 'status');
              
              if (resp.ok && resp.data) {
                return {
                  instanceName: dbInst.instance_name,
                  displayName: dbInst.display_name,
                  status: resp.data.connected ? 'connected' : 'disconnected',
                  profileName: resp.data.name,
                  number: resp.data.phone,
                  smartphoneConnected: resp.data.smartphoneConnected
                };
              }
            } catch (e) {
              console.error(`Erro ao verificar ${dbInst.instance_name}:`, e);
            }
            
            return {
              instanceName: dbInst.instance_name,
              displayName: dbInst.display_name,
              status: 'disconnected'
            };
          })
        );

        return new Response(
          JSON.stringify({ instances: instancesWithStatus }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error: any) {
        console.error('List instances error:', error);
        return new Response(
          JSON.stringify({ instances: [], error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar configuração da instância ou usar padrão
    let instanceId = ZAPI_DEFAULT_INSTANCE_ID;
    let token = ZAPI_DEFAULT_TOKEN;
    let instanceConfig: any = null;

    if (instanceName) {
      const { data: config } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_name', instanceName)
        .single();

      if (config) {
        instanceConfig = config;
        instanceId = config.instance_id || instanceId;
        token = config.instance_token || token;
      }
    }

    console.log('Instance ID:', instanceId);

    let result: any;

    switch (action) {
      // ========== STATUS DA INSTÂNCIA ==========
      case 'instance_status': {
        const resp = await callZApi(instanceId, token, 'status');
        
        if (resp.ok && resp.data) {
          const isConnected = resp.data.connected === true;
          
          result = {
            status: isConnected ? 'connected' : 'disconnected',
            profileName: resp.data.name,
            phoneNumber: resp.data.phone,
            smartphoneConnected: resp.data.smartphoneConnected
          };
          
          // Atualizar status no banco se existe config
          if (instanceConfig) {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                status: isConnected ? 'connected' : 'disconnected',
                profile_name: resp.data.name,
                phone_number: resp.data.phone,
                updated_at: new Date().toISOString()
              })
              .eq('id', instanceConfig.id);
          }
        } else {
          result = {
            status: 'disconnected',
            error: resp.error || 'Falha ao obter status'
          };
        }
        break;
      }

      // ========== CONECTAR (OBTER QR CODE) ==========
      case 'connect_instance': {
        // Verificar se já está conectado
        const statusResp = await callZApi(instanceId, token, 'status');
        
        if (statusResp.ok && statusResp.data?.connected === true) {
          result = {
            success: true,
            status: 'connected',
            profileName: statusResp.data.name,
            phoneNumber: statusResp.data.phone,
            message: 'WhatsApp já está conectado'
          };
          break;
        }

        // Obter QR Code como imagem base64
        const qrResp = await callZApi(instanceId, token, 'qr-code/image');
        
        if (qrResp.ok && qrResp.data?.value) {
          const qrBase64 = qrResp.data.value;
          const formattedQr = qrBase64.startsWith('data:image') 
            ? qrBase64 
            : `data:image/png;base64,${qrBase64}`;
          
          result = {
            success: true,
            status: 'connecting',
            qrcode: formattedQr,
            message: 'QR Code gerado com sucesso'
          };
          
          // Atualizar no banco
          if (instanceConfig) {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                qr_code: formattedQr,
                status: 'connecting',
                updated_at: new Date().toISOString()
              })
              .eq('id', instanceConfig.id);
          }
        } else {
          result = {
            success: false,
            error: qrResp.error || 'Falha ao gerar QR Code'
          };
        }
        break;
      }

      // ========== DESCONECTAR ==========
      case 'disconnect_instance': {
        const resp = await callZApi(instanceId, token, 'disconnect', 'POST');
        
        if (resp.ok) {
          if (instanceConfig) {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                status: 'disconnected',
                qr_code: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', instanceConfig.id);
          }
          
          result = {
            success: true,
            message: 'WhatsApp desconectado'
          };
        } else {
          result = {
            success: false,
            error: resp.error || 'Erro ao desconectar'
          };
        }
        break;
      }

      // ========== ENVIAR MENSAGEM DE TESTE ==========
      case 'send_message': {
        if (!phone || !message) {
          result = { success: false, error: 'phone e message são obrigatórios' };
          break;
        }

        // Normalizar número
        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) {
          normalizedPhone = '55' + normalizedPhone;
        }

        // Simular digitação primeiro
        console.log('⌨️ Simulando digitação...');
        await callZApi(instanceId, token, 'send-typing', 'POST', { phone: normalizedPhone, value: true });
        
        // Calcular tempo de digitação baseado no tamanho da mensagem
        const typingTime = Math.min(Math.max(message.length * 50, 2000), 8000);
        await new Promise(r => setTimeout(r, typingTime));
        
        await callZApi(instanceId, token, 'send-typing', 'POST', { phone: normalizedPhone, value: false });
        await new Promise(r => setTimeout(r, 500));

        // Enviar mensagem
        const resp = await callZApi(instanceId, token, 'send-text', 'POST', { 
          phone: normalizedPhone, 
          message 
        });

        if (resp.ok) {
          result = { 
            success: true, 
            message: 'Mensagem enviada com sucesso',
            zapiId: resp.data?.zapiId
          };
        } else {
          result = { 
            success: false, 
            error: resp.error || 'Erro ao enviar mensagem'
          };
        }
        break;
      }

      // ========== VERIFICAR NÚMERO ==========
      case 'check_number': {
        if (!phone) {
          result = { success: false, error: 'phone é obrigatório' };
          break;
        }

        let normalizedPhone = String(phone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) {
          normalizedPhone = '55' + normalizedPhone;
        }

        const resp = await callZApi(instanceId, token, `phone-exists/${normalizedPhone}`);

        result = {
          success: resp.ok,
          phone: normalizedPhone,
          exists: resp.data?.exists === true
        };
        break;
      }

      default:
        result = { error: `Ação desconhecida: ${action}` };
    }

    console.log('=== Result ===');
    console.log(JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Z-API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
