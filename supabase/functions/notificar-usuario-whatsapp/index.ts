import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { normalizeBrPhone, sendText } from "../_shared/wapi.ts";
import { enfileirarNotificacao } from "../_shared/fila-notificacoes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// Tipos
// ============================================================

interface NotificacaoPayload {
  notificacao_id: string;
  destinatario_id: string;
  destinatario_nome: string;
  destinatario_telefone: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  url_destino: string;
  tenant_id: string;
  /** Usado pelo botão de teste do painel: ignora a agenda e envia na hora. */
  forcar_envio_imediato?: boolean;
}

interface WhatsAppConfig {
  provedor: string;
  // W-API — provedor atual das notificações do sistema
  wapi_instance_id: string | null;
  wapi_token: string | null;
  // Z-API — mantida apenas como rollback (config.provedor = 'zapi')
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token: string | null;
  openai_api_key: string | null;
  usar_ia: boolean;
  tom_mensagem: string;
  mensagem_fallback: string;
  tipos_ativos: string[];
}

// ============================================================
// Labels amigáveis para tipos de notificação
// ============================================================

const TIPO_LABELS: Record<string, string> = {
  atribuicao: "Atribuição de demanda",
  mencao: "Menção em atividade",
  tarefa_atribuida: "Tarefa atribuída",
  tarefa_lembrete_prazo: "Prazo se aproximando",
  tarefa_atraso: "Tarefa em atraso",
  agenda_solicitada: "Solicitação de agenda",
  agenda_acompanhante: "Acompanhante de agenda",
  agenda_status: "Atualização de agenda",
  agenda_mensagem: "Mensagem na agenda",
};

// ============================================================
// Geração de mensagem via OpenAI
// ============================================================

async function gerarMensagemIA(
  config: WhatsAppConfig,
  payload: NotificacaoPayload
): Promise<string | null> {
  if (!config.openai_api_key || !config.usar_ia) return null;

  const tomMap: Record<string, string> = {
    profissional: "estritamente profissional e formal",
    profissional_leve:
      "profissional mas com tom leve e amigável, podendo usar 1-2 emojis",
    humoristico:
      "profissional com toque de humor sutil e criativo, use emojis com moderação",
  };

  const tom = tomMap[config.tom_mensagem] || tomMap.profissional_leve;
  const primeiroNome = (payload.destinatario_nome || "").split(" ")[0];

  const prompt = `Você é o assistente de notificações do sistema Poder Local Gestor, uma plataforma de gestão para gabinetes parlamentares municipais.

Gere uma mensagem ${tom} de WhatsApp para notificar um assessor parlamentar.

Tipo de notificação: ${TIPO_LABELS[payload.tipo] || payload.tipo}
Título: ${payload.titulo}
Destinatário (primeiro nome): ${primeiroNome}
Contexto da notificação: ${payload.mensagem}

ESTRUTURA OBRIGATÓRIA da mensagem (siga esta ordem):

1. 🔔 Uma linha de abertura com cumprimento e o tipo de notificação
2. 📋 Repasse TODAS as informações relevantes do contexto (nome da demanda/tarefa/agenda, quem atribuiu, número da demanda se houver, data se houver). NÃO omita dados.
3. 💡 Uma frase orientando que os detalhes completos e próximas ações estão disponíveis no sistema Poder Local Gestor
4. ✅ Termine SEMPRE com a frase exata: "Confirme o recebimento respondendo OK."

Regras:
- Use no máximo 6 linhas de conteúdo
- Separe as seções com quebras de linha para boa legibilidade
- NÃO inclua links, URLs ou endereços web
- Nunca invente dados, use apenas o que foi fornecido
- Reformule a informação de forma natural, NÃO copie o texto literal da notificação
- Cada mensagem deve ser única — varie o estilo e as palavras
- Use emojis com moderação (2-3 no máximo) para destacar seções, não para decorar`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openai_api_key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 350,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI HTTP ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const mensagem = data.choices?.[0]?.message?.content?.trim();

    if (!mensagem) {
      console.warn("⚠️ OpenAI retornou resposta vazia");
      return null;
    }

    console.log("🤖 Mensagem gerada pela IA:", mensagem.substring(0, 80) + "...");
    return mensagem;
  } catch (error: any) {
    console.error("❌ Erro ao chamar OpenAI:", error.message);
    return null;
  }
}

// ============================================================
// Geração de mensagem via template fallback
// ============================================================

function gerarMensagemFallback(
  template: string,
  payload: NotificacaoPayload
): string {
  const primeiroNome = (payload.destinatario_nome || "").split(" ")[0];
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return template
    .replace(/\{nome\}/gi, payload.destinatario_nome || "")
    .replace(/\{primeiro_nome\}/gi, primeiroNome)
    .replace(/\{tipo\}/gi, TIPO_LABELS[payload.tipo] || payload.tipo)
    .replace(/\{titulo\}/gi, payload.titulo || "")
    .replace(/\{mensagem\}/gi, payload.mensagem || "")
    .replace(/\{url\}/gi, payload.url_destino || "")
    .replace(/\{data\}/gi, data)
    .replace(/\{hora\}/gi, hora);
}

// ============================================================
// Envio imediato
//
// Caminho normal: W-API. A Z-API fica disponível como rollback,
// bastando trocar `provedor` para 'zapi' na configuração.
// ============================================================

async function enviarMensagem(
  config: WhatsAppConfig,
  telefone: string,
  mensagem: string
): Promise<{ ok: boolean; messageId: string | null; method: string }> {
  if (config.provedor === "zapi") {
    return await enviarViaZApi(config, telefone, mensagem);
  }

  console.log("📤 Enviando texto pela W-API...");

  const resp = await sendText(
    { instanceId: config.wapi_instance_id!, token: config.wapi_token! },
    { phone: telefone, message: mensagem, delayMessage: 3 }
  );

  if (resp.ok && resp.body?.messageId) {
    console.log("✅ Mensagem enviada:", resp.body.messageId);
    return { ok: true, messageId: resp.body.messageId, method: "wapi_text" };
  }

  console.error("❌ Falha no envio W-API:", resp.error);
  return { ok: false, messageId: null, method: "wapi_text" };
}

async function enviarViaZApi(
  config: WhatsAppConfig,
  telefone: string,
  mensagem: string
): Promise<{ ok: boolean; messageId: string | null; method: string }> {
  const baseUrl = `https://api.z-api.io/instances/${config.zapi_instance_id}/token/${config.zapi_token}`;

  try {
    console.log("📤 Enviando texto pela Z-API (modo rollback)...");

    const response = await fetch(`${baseUrl}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": config.zapi_client_token!,
      },
      body: JSON.stringify({ phone: telefone, message: mensagem }),
    });

    const result = await response.json();

    if (response.ok && (result.zapiMessageId || result.messageId)) {
      const msgId = result.zapiMessageId || result.messageId;
      console.log("✅ Mensagem enviada:", msgId);
      return { ok: true, messageId: msgId, method: "zapi_text" };
    }

    console.error("❌ Falha no envio:", JSON.stringify(result).substring(0, 200));
    return { ok: false, messageId: null, method: "zapi_text" };
  } catch (err: any) {
    console.error("❌ Erro no envio:", err.message);
    return { ok: false, messageId: null, method: "error" };
  }
}

/** Confere se o provedor escolhido tem credenciais completas. */
function credenciaisOk(config: WhatsAppConfig): boolean {
  if (config.provedor === "zapi") {
    return !!(config.zapi_instance_id && config.zapi_token && config.zapi_client_token);
  }
  return !!(config.wapi_instance_id && config.wapi_token);
}

// ============================================================
// Handler principal
// ============================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificacaoPayload = await req.json();

    console.log(
      `📬 [notificar-usuario-whatsapp] tipo=${payload.tipo} dest=${payload.destinatario_nome} tel=${payload.destinatario_telefone?.substring(0, 6)}...`
    );

    // 1. Carregar configuração
    const { data: config, error: configError } = await supabase
      .from("notification_whatsapp_config")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.log("⚠️ Configuração não encontrada ou desativada");
      return json({ success: false, reason: "config_not_found" });
    }

    // 2. Verificar tipo habilitado
    const tiposAtivos: string[] = config.tipos_ativos || [];
    if (!tiposAtivos.includes(payload.tipo)) {
      console.log(`⏭️ Tipo "${payload.tipo}" não habilitado para WhatsApp`);
      return json({ success: false, reason: "type_disabled" });
    }

    // 3. Verificar credenciais do provedor ativo
    if (!credenciaisOk(config)) {
      console.error(`❌ Credenciais ${config.provedor} não configuradas`);
      return json({ success: false, reason: `${config.provedor}_not_configured` }, 500);
    }

    // 4. Normalizar telefone
    const telefone = normalizeBrPhone(payload.destinatario_telefone);

    if (!telefone) {
      console.error("❌ Telefone inválido:", payload.destinatario_telefone);
      return json({ success: false, reason: "invalid_phone" }, 400);
    }

    // 5. Agenda do gabinete: enfileira em vez de enviar na hora
    //
    // A notificação sai no próximo horário configurado, junto com as
    // outras, em um resumo só — ver despachar-notificacoes-whatsapp.
    if (!payload.forcar_envio_imediato && payload.tenant_id) {
      const fila = await enfileirarNotificacao(supabase, {
        tenant_id: payload.tenant_id,
        notificacao_id: payload.notificacao_id,
        destinatario_id: payload.destinatario_id,
        destinatario_nome: payload.destinatario_nome,
        destinatario_telefone: telefone,
        tipo: payload.tipo,
        titulo: payload.titulo,
        mensagem: payload.mensagem,
        url_destino: payload.url_destino,
      });

      if (fila.enfileirada) {
        console.log(`🗓️ Enfileirada para o próximo horário do gabinete (${fila.fila_id})`);
        return json({
          success: true,
          method: "fila",
          enfileirada: true,
          fila_id: fila.fila_id,
        });
      }

      console.log(`⚡ Envio imediato — motivo: ${fila.motivo}`);
    }

    // 6. Gerar mensagem (IA ou fallback)
    let mensagem = await gerarMensagemIA(config, payload);
    const iaUsada = mensagem !== null;

    if (!mensagem) {
      console.log("📝 Usando mensagem fallback (template)");
      mensagem = gerarMensagemFallback(
        config.mensagem_fallback ||
          "🔔 Olá {primeiro_nome}!\n\n📋 {tipo}: {mensagem}\n\n💡 Acesse o Poder Local Gestor para ver todos os detalhes e próximas ações.\n\n✅ Confirme o recebimento respondendo OK.",
        payload
      );
    }

    // 7. Enviar
    const resultado = await enviarMensagem(config, telefone, mensagem);

    // 8. Atualizar registro da notificação
    const updateData: Record<string, any> = {
      whatsapp_enviado: resultado.ok,
      whatsapp_enviado_em: new Date().toISOString(),
      whatsapp_mensagem_enviada: mensagem,
    };

    if (resultado.messageId) {
      updateData.whatsapp_message_id = resultado.messageId;
    }

    const { error: updateError } = await supabase
      .from("notificacoes")
      .update(updateData)
      .eq("id", payload.notificacao_id);

    if (updateError) {
      console.error("⚠️ Erro ao atualizar notificação:", updateError.message);
    }

    console.log(
      `${resultado.ok ? "✅" : "❌"} Resultado: method=${resultado.method} messageId=${resultado.messageId} ia=${iaUsada}`
    );

    return json({
      success: resultado.ok,
      message_id: resultado.messageId,
      method: resultado.method,
      ia_usada: iaUsada,
    });
  } catch (error: any) {
    console.error("💥 Erro fatal:", error.message, error.stack);
    return json({ success: false, error: error.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
