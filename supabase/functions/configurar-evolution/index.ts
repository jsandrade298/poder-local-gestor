import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Configuração Z-API - Suas credenciais
const ZAPI_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_TOKEN = "8FBCD627DCF04CA3F24CD5EC";
const ZAPI_CLIENT_TOKEN = "F1c345cff72034ecbbcbe4e942ade925bS";

/**
 * Constrói URL da Z-API
 */
function buildZApiUrl(instanceId: string, token: string, endpoint: string): string {
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
}

/**
 * Normaliza número de telefone para formato Z-API
 * Formato esperado: 5511999999999 (DDI + DDD + número)
 */
function normalizePhone(phone: string): string {
  // Remove tudo que não é número
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não começar com 55 (Brasil), adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // Validação básica: deve ter entre 12 e 13 dígitos (55 + DDD + 8 ou 9 dígitos)
  // 5511999999999 = 13 dígitos (celular com 9)
  // 551199999999 = 12 dígitos (fixo ou celular antigo)
  
  console.log(`📱 Telefone normalizado: ${phone} -> ${cleaned}`);
  
  return cleaned;
}

/**
 * Faz requisição para Z-API
 */
async function callZApi(
  instanceId: string, 
  token: string, 
  endpoint: string, 
  method: "GET" | "POST" | "DELETE" = "GET",
  payload?: any,
  clientToken?: string
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = buildZApiUrl(instanceId, token, endpoint);
  
  try {
    console.log(`🔄 Z-API ${method}: ${url}`);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Client-Token": clientToken || ZAPI_CLIENT_TOKEN
    };
    
    const options: RequestInit = {
      method,
      headers
    };
    
    if (payload && method !== "GET") {
      options.body = JSON.stringify(payload);
      console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
    }
    
    const response = await fetch(url, options);
    const text = await response.text();
    
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Mantém como texto se não for JSON
    }
    
    console.log(`📡 Response Status: ${response.status}`);
    console.log(`📋 Response Data:`, JSON.stringify(data, null, 2).substring(0, 1000));
    
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: data?.error || data?.message || data?.detailedError || `HTTP ${response.status}`
      };
    }
    
    return { ok: true, status: response.status, data };
    
  } catch (error: any) {
    console.error("❌ Erro na chamada Z-API:", error);
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
    console.log('Phone:', phone);
    console.log('Message:', message);

    // Usar credenciais padrão
    let instanceId = ZAPI_INSTANCE_ID;
    let token = ZAPI_TOKEN;
    let clientToken = ZAPI_CLIENT_TOKEN;
    let instanceConfig: any = null;

    // Buscar configuração da instância no banco (se existir)
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
        clientToken = config.client_token || clientToken;
      }
    }

    console.log('Using Instance ID:', instanceId);

    // ========== LISTAR INSTÂNCIAS ==========
    if (action === 'list_instances') {
      try {
        const { data: dbInstances } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('active', true);

        // Verificar status da instância padrão
        const resp = await callZApi(instanceId, token, 'status', 'GET', null, clientToken);
        
        if (resp.ok && resp.data) {
          const instanceStatus = {
            instanceName: dbInstances?.[0]?.instance_name || 'gabinete-whats-01',
            displayName: dbInstances?.[0]?.display_name || 'WhatsApp Principal (Z-API)',
            status: resp.data.connected ? 'connected' : 'disconnected',
            profileName: resp.data.name,
            number: resp.data.phone
          };

          // Atualizar no banco se existir
          if (dbInstances && dbInstances.length > 0) {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                status: resp.data.connected ? 'connected' : 'disconnected',
                profile_name: resp.data.name || null,
                phone_number: resp.data.phone || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbInstances[0].id);
          }

          return new Response(
            JSON.stringify({ instances: [instanceStatus] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            instances: [{
              instanceName: 'gabinete-whats-01',
              displayName: 'WhatsApp Principal (Z-API)',
              status: 'disconnected'
            }],
            error: resp.error
          }),
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

    let result: any;

    switch (action) {
      // ========== STATUS DA INSTÂNCIA ==========
      case 'instance_status': {
        const resp = await callZApi(instanceId, token, 'status', 'GET', null, clientToken);
        
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
        const statusResp = await callZApi(instanceId, token, 'status', 'GET', null, clientToken);
        
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
        console.log('🔄 Obtendo QR Code via qr-code/image...');
        const qrResp = await callZApi(instanceId, token, 'qr-code/image', 'GET', null, clientToken);
        
        console.log('QR Response:', JSON.stringify(qrResp, null, 2));
        
        if (qrResp.ok && qrResp.data) {
          let qrBase64 = '';
          
          // A Z-API retorna o QR em diferentes formatos possíveis
          if (qrResp.data.value) {
            qrBase64 = qrResp.data.value;
          } else if (qrResp.data.qrcode) {
            qrBase64 = qrResp.data.qrcode;
          } else if (typeof qrResp.data === 'string' && qrResp.data.length > 100) {
            qrBase64 = qrResp.data;
          }
          
          if (qrBase64) {
            // Garantir formato data:image
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
            break;
          }
        }
        
        // Se não conseguiu, tentar restart e depois QR novamente
        console.log('🔄 Tentando restart da instância...');
        await callZApi(instanceId, token, 'restart', 'POST', null, clientToken);
        
        // Aguardar um pouco
        await new Promise(r => setTimeout(r, 3000));
        
        // Tentar QR novamente
        const retryQrResp = await callZApi(instanceId, token, 'qr-code/image', 'GET', null, clientToken);
        
        if (retryQrResp.ok && retryQrResp.data?.value) {
          const qrBase64 = retryQrResp.data.value;
          const formattedQr = qrBase64.startsWith('data:image') 
            ? qrBase64 
            : `data:image/png;base64,${qrBase64}`;
          
          result = {
            success: true,
            status: 'connecting',
            qrcode: formattedQr,
            message: 'QR Code gerado após restart'
          };
        } else {
          result = {
            success: false,
            error: qrResp.error || retryQrResp.error || 'Não foi possível gerar o QR Code. Verifique se a instância está ativa no painel da Z-API.'
          };
        }
        break;
      }

      // ========== DESCONECTAR ==========
      case 'disconnect_instance': {
        const resp = await callZApi(instanceId, token, 'disconnect', 'POST', null, clientToken);
        
        if (resp.ok || resp.status === 200) {
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

      // ========== ENVIAR MENSAGEM ==========
      case 'send_message': {
        if (!phone || !message) {
          result = { success: false, error: 'phone e message são obrigatórios' };
          break;
        }

        // Normalizar número para formato Z-API
        const normalizedPhone = normalizePhone(phone);
        
        console.log(`📤 Enviando mensagem para: ${normalizedPhone}`);
        console.log(`📝 Mensagem: ${message}`);

        // Payload com delayTyping para mostrar "digitando..."
        // delayTyping: tempo em segundos que mostra "digitando" (1-15)
        const payload = { 
          phone: normalizedPhone, 
          message: message,
          delayTyping: 3  // Mostra "digitando..." por 3 segundos antes de enviar
        };

        // Enviar mensagem via send-text
        const resp = await callZApi(instanceId, token, 'send-text', 'POST', payload, clientToken);

        console.log('📨 Resposta do envio:', JSON.stringify(resp, null, 2));

        if (resp.ok && resp.data) {
          // Verificar se tem ID da mensagem (indica sucesso real)
          const messageId = resp.data.zaapId || resp.data.messageId || resp.data.id;
          
          if (messageId) {
            result = { 
              success: true, 
              message: 'Mensagem enviada com sucesso',
              messageId: messageId,
              zapiResponse: resp.data
            };
          } else {
            // Resposta OK mas sem ID - pode indicar problema
            result = { 
              success: true, 
              message: 'Mensagem processada',
              warning: 'Sem ID de confirmação',
              zapiResponse: resp.data
            };
          }
        } else {
          // Erro no envio
          result = { 
            success: false, 
            error: resp.error || 'Erro ao enviar mensagem',
            details: resp.data,
            phoneUsed: normalizedPhone
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

        const normalizedPhone = normalizePhone(phone);
        const resp = await callZApi(instanceId, token, `phone-exists/${normalizedPhone}`, 'GET', null, clientToken);

        result = {
          success: resp.ok,
          phone: normalizedPhone,
          exists: resp.data?.exists === true,
          zapiResponse: resp.data
        };
        break;
      }

      // ========== REINICIAR INSTÂNCIA ==========
      case 'restart_instance': {
        const resp = await callZApi(instanceId, token, 'restart', 'POST', null, clientToken);
        
        result = {
          success: resp.ok,
          message: resp.ok ? 'Instância reiniciada' : 'Erro ao reiniciar',
          error: resp.error
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
