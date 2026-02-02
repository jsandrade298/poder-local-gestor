import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Credenciais Z-API para enviar reação
const ZAPI_INSTANCE_ID = "3E6B64573148D1AB699D4A0A02232B3D";
const ZAPI_TOKEN = "8FBCD627DCF04CA3F24CD5EC";
const ZAPI_CLIENT_TOKEN = "F1c345cff72034ecbbcbe4e942ade925bS";

/**
 * Mapeia status da Z-API para status do banco
 */
function mapearStatus(zapiStatus: string): string {
  const mapa: Record<string, string> = {
    'SENT': 'enviado',
    'RECEIVED': 'entregue',
    'READ': 'lido',
    'READ_BY_ME': 'lido',
    'PLAYED': 'reproduzido',
    'DELIVERED': 'entregue'
  };
  return mapa[zapiStatus?.toUpperCase()] || 'enviado';
}

/**
 * Campo de timestamp baseado no status
 */
function campoTimestamp(status: string): string | null {
  const mapa: Record<string, string> = {
    'enviado': 'enviado_em',
    'entregue': 'entregue_em',
    'lido': 'lido_em',
    'reproduzido': 'lido_em'
  };
  return mapa[status] || null;
}

/**
 * Ordem de status para evitar retrocesso
 */
function ordemStatus(status: string): number {
  const ordem: Record<string, number> = {
    'pendente': 0,
    'enviando': 1,
    'enviado': 2,
    'entregue': 3,
    'lido': 4,
    'reproduzido': 5,
    'erro': 0,
    'cancelado': 0
  };
  return ordem[status] ?? 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração Supabase ausente");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload = await req.json();

    console.log("📥 Webhook recebido:", JSON.stringify(payload).substring(0, 500));

    // Identificar tipo de webhook
    const webhookType = payload.type || payload.event || 'unknown';
    
    // ==================== MESSAGE STATUS CALLBACK ====================
    if (webhookType === 'MessageStatusCallback' || payload.status) {
      const { status, ids, phone, momment, instanceId } = payload;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        console.log("⚠️ Callback sem IDs de mensagem");
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      const novoStatus = mapearStatus(status);
      const campoTs = campoTimestamp(novoStatus);
      
      console.log(`📊 Status: ${status} → ${novoStatus} | IDs: ${ids.length}`);

      for (const messageId of ids) {
        // Buscar destinatário
        const { data: dest, error } = await supabase
          .from('whatsapp_envios_destinatarios')
          .select('id, status, envio_id')
          .eq('zapi_message_id', messageId)
          .single();

        if (error || !dest) {
          console.log(`⚠️ Destinatário não encontrado: ${messageId}`);
          continue;
        }

        // Verificar se é um avanço de status
        if (ordemStatus(novoStatus) <= ordemStatus(dest.status)) {
          console.log(`⏭️ Status ${novoStatus} não é avanço de ${dest.status}`);
          continue;
        }

        // Atualizar
        const updateData: any = { status: novoStatus, updated_at: new Date().toISOString() };
        if (campoTs) updateData[campoTs] = momment || new Date().toISOString();

        await supabase
          .from('whatsapp_envios_destinatarios')
          .update(updateData)
          .eq('id', dest.id);

        console.log(`✅ Atualizado: ${dest.id} → ${novoStatus}`);
      }

      return new Response(JSON.stringify({ received: true, processed: ids.length }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== RECEIVED CALLBACK (Mensagem recebida) ====================
    if (webhookType === 'ReceivedCallback' || payload.isNewMsg !== undefined) {
      const { phone, body, messageId, fromMe, instanceId } = payload;
      
      if (fromMe) {
        console.log("⏭️ Mensagem própria, ignorando");
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      console.log(`📨 Mensagem recebida de ${phone}: ${body?.substring(0, 50)}`);

      // Buscar se há envio recente para esse telefone com reação automática
      const telefoneFormatado = phone?.replace(/\D/g, '');
      
      const { data: destRecente } = await supabase
        .from('whatsapp_envios_destinatarios')
        .select(`
          id, 
          zapi_message_id,
          envio:whatsapp_envios!inner(id, reacao_automatica, instancia_id)
        `)
        .or(`telefone.eq.${telefoneFormatado},telefone_formatado.eq.${telefoneFormatado}`)
        .not('envio.reacao_automatica', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (destRecente?.envio?.reacao_automatica && destRecente.zapi_message_id) {
        console.log(`👍 Enviando reação: ${destRecente.envio.reacao_automatica}`);
        
        // Buscar credenciais da instância
        let iId = ZAPI_INSTANCE_ID;
        let tok = ZAPI_TOKEN;
        let cTok = ZAPI_CLIENT_TOKEN;

        if (destRecente.envio.instancia_id) {
          const { data: inst } = await supabase
            .from('whatsapp_instances')
            .select('instance_id, instance_token, client_token')
            .eq('id', destRecente.envio.instancia_id)
            .single();
          
          if (inst) {
            iId = inst.instance_id || iId;
            tok = inst.instance_token || tok;
            cTok = inst.client_token || cTok;
          }
        }

        // Enviar reação à mensagem RECEBIDA
        try {
          const reacaoResp = await fetch(
            `https://api.z-api.io/instances/${iId}/token/${tok}/send-reaction`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Client-Token': cTok },
              body: JSON.stringify({
                phone: telefoneFormatado,
                messageId: messageId,
                emoji: destRecente.envio.reacao_automatica
              })
            }
          );
          
          if (reacaoResp.ok) {
            console.log("✅ Reação enviada!");
            
            // Registrar reação
            await supabase.from('whatsapp_reacoes').insert({
              telefone: telefoneFormatado,
              message_id: messageId,
              emoji: destRecente.envio.reacao_automatica,
              tipo: 'enviada',
              envio_destinatario_id: destRecente.id,
              instancia_id: destRecente.envio.instancia_id
            });
          }
        } catch (e) {
          console.error("❌ Erro ao enviar reação:", e);
        }
      }

      return new Response(JSON.stringify({ received: true }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== DELIVERY CALLBACK ====================
    if (webhookType === 'DeliveryCallback') {
      console.log("📬 DeliveryCallback recebido");
      return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
    }

    // Webhook desconhecido
    console.log(`⚠️ Webhook tipo desconhecido: ${webhookType}`);
    return new Response(JSON.stringify({ received: true, type: webhookType }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("💥 Erro no webhook:", error);
    // Retornar 200 mesmo com erro para evitar retries infinitos da Z-API
    return new Response(JSON.stringify({ error: error.message }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
