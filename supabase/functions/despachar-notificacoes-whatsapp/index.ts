// ============================================================
// Despachante de resumos de notificações (W-API)
//
// Chamado pelo pg_cron a cada 5 minutos. Para cada gabinete:
//   1. verifica, no fuso do próprio gabinete, se algum horário
//      configurado venceu desde a última execução;
//   2. junta todas as pendências de cada usuário em UM resumo;
//   3. envia pela W-API com botão de confirmação de recebimento.
//
// Substitui o antigo cron fixo de 3 envios por dia.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import {
  normalizeBrPhone,
  sendTextWithButtons,
  type WApiCredentials,
} from "../_shared/wapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Janela de tolerância: um horário só dispara se venceu há no máximo isso. */
const TOLERANCIA_MIN = 30;

/** Teto de resumos por execução, para não estourar o tempo da edge function. */
const MAX_RESUMOS_POR_EXECUCAO = 150;

/** Pausa entre um usuário e outro, para não parecer disparo em massa. */
const PAUSA_ENTRE_ENVIOS_MS = 2500;

const ROTULO_TIPO: Record<string, string> = {
  atribuicao: "📋 Atribuição de demanda",
  mencao: "💬 Menção em atividade",
  tarefa_atribuida: "✅ Tarefa atribuída",
  tarefa_lembrete_prazo: "⏰ Prazo se aproximando",
  tarefa_atraso: "🔴 Tarefa em atraso",
  agenda_solicitada: "📅 Solicitação de agenda",
  agenda_acompanhante: "👥 Acompanhante de agenda",
  agenda_status: "🔄 Atualização de agenda",
  agenda_mensagem: "✉️ Mensagem na agenda",
};

// ------------------------------------------------------------
// Utilitários de fuso horário
// ------------------------------------------------------------

/** Deslocamento (ms) entre UTC e o fuso informado, no instante dado. */
function offsetDoFuso(instante: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instante)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second),
  );

  return comoUtc - instante.getTime();
}

interface HoraLocal {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

function agoraNoFuso(instante: Date, timeZone: string): HoraLocal {
  const local = new Date(instante.getTime() + offsetDoFuso(instante, timeZone));
  return {
    ano: local.getUTCFullYear(),
    mes: local.getUTCMonth() + 1,
    dia: local.getUTCDate(),
    hora: local.getUTCHours(),
    minuto: local.getUTCMinutes(),
    diaSemana: local.getUTCDay(),
  };
}

/** Converte um horário de parede local em instante absoluto (UTC). */
function instanteDoHorarioLocal(l: HoraLocal, hora: number, minuto: number, timeZone: string): Date {
  const base = Date.UTC(l.ano, l.mes - 1, l.dia, hora, minuto, 0);
  let palpite = base;
  // Duas passadas resolvem viradas de horário de verão.
  for (let i = 0; i < 2; i++) {
    palpite = base - offsetDoFuso(new Date(palpite), timeZone);
  }
  return new Date(palpite);
}

// ------------------------------------------------------------
// Montagem da mensagem
// ------------------------------------------------------------

interface ItemFila {
  id: string;
  notificacao_id: string | null;
  tipo: string;
  titulo: string | null;
  mensagem: string | null;
  tentativas: number;
  destinatario_id: string;
  destinatario_nome: string | null;
  destinatario_telefone: string;
}

function primeiroNome(nome: string | null): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

function montarResumoTemplate(itens: ItemFila[]): string {
  const nome = primeiroNome(itens[0].destinatario_nome);
  const saudacao = nome ? `🔔 Olá, ${nome}!` : "🔔 Olá!";
  const plural = itens.length === 1 ? "novidade" : "novidades";

  const linhas = itens
    .map((item, i) => {
      const rotulo = ROTULO_TIPO[item.tipo] || "🔔 Notificação";
      const detalhe = (item.titulo || item.mensagem || "").trim();
      return detalhe ? `${i + 1}. ${rotulo} — ${detalhe}` : `${i + 1}. ${rotulo}`;
    })
    .join("\n");

  return [
    saudacao,
    "",
    `Você tem *${itens.length} ${plural}* no Poder Local Gestor:`,
    "",
    linhas,
    "",
    "💡 Acesse o sistema para ver os detalhes e as próximas ações.",
  ].join("\n");
}

async function montarResumoComIA(
  itens: ItemFila[],
  apiKey: string,
  tom: string,
): Promise<string | null> {
  const instrucaoTom: Record<string, string> = {
    profissional: "Tom formal e objetivo, sem emojis.",
    profissional_leve: "Tom amigável e profissional, com poucos emojis.",
    humoristico: "Tom leve e criativo, com humor sutil e emojis.",
  };

  const lista = itens
    .map((i) => `- ${ROTULO_TIPO[i.tipo] || i.tipo}: ${i.titulo || ""} ${i.mensagem || ""}`.trim())
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "Você escreve resumos curtos de notificações para assessores de um gabinete político, " +
              "enviados por WhatsApp. " +
              (instrucaoTom[tom] || instrucaoTom.profissional_leve) +
              " Use no máximo 900 caracteres, formatação do WhatsApp (*negrito*) e liste cada item em " +
              "uma linha. Não invente informações e não peça confirmação no final.",
          },
          {
            role: "user",
            content:
              `Destinatário: ${primeiroNome(itens[0].destinatario_nome) || "assessor"}\n` +
              `Pendências acumuladas:\n${lista}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`⚠️ OpenAI respondeu ${res.status} — usando template`);
      return null;
    }

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content?.trim();
    return texto || null;
  } catch (err) {
    console.warn("⚠️ Falha na IA, usando template:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ---------- Configuração global ----------
    const { data: config } = await supabase
      .from("notification_whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config?.ativo) {
      console.log("⏸️ Notificações WhatsApp desativadas");
      return json({ success: true, skipped: "canal inativo" });
    }

    if (config.provedor !== "wapi") {
      console.log(`⏸️ Provedor atual é "${config.provedor}", despachante é exclusivo da W-API`);
      return json({ success: true, skipped: "provedor não é wapi" });
    }

    const creds: WApiCredentials = {
      instanceId: config.wapi_instance_id,
      token: config.wapi_token,
    };

    if (!creds.instanceId || !creds.token) {
      console.error("❌ Credenciais W-API não configuradas");
      return json({ success: false, error: "Credenciais W-API ausentes" }, 500);
    }

    // ---------- Agendas ativas ----------
    const { data: agendas, error: agendaErr } = await supabase
      .from("notificacao_whatsapp_agenda")
      .select("*")
      .eq("ativo", true);

    if (agendaErr) throw agendaErr;
    if (!agendas?.length) {
      return json({ success: true, skipped: "nenhuma agenda ativa" });
    }

    const agora = new Date();
    let resumosEnviados = 0;
    const relatorio: any[] = [];

    // Se a instância não tiver plano PRO, o primeiro send-button-list falha.
    // Anotamos aqui para não repetir a chamada perdida no resto da execução.
    let botoesIndisponiveis = false;

    for (const agenda of agendas) {
      if (resumosEnviados >= MAX_RESUMOS_POR_EXECUCAO) {
        console.warn("⚠️ Teto de resumos atingido — restante fica para a próxima execução");
        break;
      }

      const tz = agenda.timezone || "America/Sao_Paulo";
      const local = agoraNoFuso(agora, tz);

      // Hoje é dia de envio?
      const dias: number[] = agenda.dias_semana || [];
      if (!dias.includes(local.diaSemana)) continue;

      // Qual horário venceu dentro da janela de tolerância?
      const minutosAgora = local.hora * 60 + local.minuto;
      let slotVencido: { hora: number; minuto: number } | null = null;

      for (const h of (agenda.horarios || []) as string[]) {
        const [hh, mm] = String(h).split(":").map(Number);
        const minutosSlot = hh * 60 + mm;
        const atraso = minutosAgora - minutosSlot;
        if (atraso >= 0 && atraso <= TOLERANCIA_MIN) {
          // Se mais de um horário couber na janela, usa o mais recente
          if (!slotVencido || minutosSlot > slotVencido.hora * 60 + slotVencido.minuto) {
            slotVencido = { hora: hh, minuto: mm };
          }
        }
      }

      if (!slotVencido) continue;

      const slotEm = instanteDoHorarioLocal(local, slotVencido.hora, slotVencido.minuto, tz);

      // Guarda de idempotência: se já disparamos este horário, sai.
      const { error: disparoErr } = await supabase
        .from("notificacao_whatsapp_disparos")
        .insert({ tenant_id: agenda.tenant_id, slot_em: slotEm.toISOString() });

      if (disparoErr) {
        // 23505 = unique_violation → já processado por uma execução anterior
        if (disparoErr.code !== "23505") console.error("❌ Erro na guarda de disparo:", disparoErr);
        continue;
      }

      // ---------- Pendências do gabinete ----------
      const { data: pendentes, error: filaErr } = await supabase
        .from("notificacao_whatsapp_fila")
        .select(
          "id, notificacao_id, tipo, titulo, mensagem, tentativas, " +
            "destinatario_id, destinatario_nome, destinatario_telefone",
        )
        .eq("tenant_id", agenda.tenant_id)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });

      if (filaErr) {
        console.error("❌ Erro ao ler a fila:", filaErr);
        continue;
      }

      if (!pendentes?.length) {
        console.log(`📭 Tenant ${agenda.tenant_id}: nada pendente às ${slotVencido.hora}h`);
        continue;
      }

      // Agrupa por destinatário.
      //
      // Os jobs lembretes-tarefas-09h/15h/21h rodam três vezes por dia e
      // criam uma notificação nova a cada passagem, então a mesma tarefa
      // atrasada apareceria repetida no resumo. Aqui só o primeiro item de
      // cada (tipo + título) entra na mensagem — os demais continuam sendo
      // marcados como enviados, para não ficarem presos na fila.
      const porUsuario = new Map<string, ItemFila[]>();
      const vistos = new Map<string, Set<string>>();
      const duplicadas: string[] = [];

      for (const item of pendentes as ItemFila[]) {
        const lista = porUsuario.get(item.destinatario_id) || [];
        const chaves = vistos.get(item.destinatario_id) || new Set<string>();
        const chave = `${item.tipo}|${(item.titulo || item.mensagem || "").trim()}`;

        if (!chaves.has(chave)) {
          chaves.add(chave);
          lista.push(item);
        } else {
          duplicadas.push(item.id);
        }

        vistos.set(item.destinatario_id, chaves);
        porUsuario.set(item.destinatario_id, lista);
      }

      console.log(
        `📬 Tenant ${agenda.tenant_id}: ${pendentes.length} pendências para ${porUsuario.size} usuário(s)`,
      );

      // Itens colapsados como repetidos: saem da fila junto com o resumo
      if (duplicadas.length) {
        await supabase
          .from("notificacao_whatsapp_fila")
          .update({ status: "enviada", enviada_em: new Date().toISOString() })
          .in("id", duplicadas);
        console.log(`🔁 ${duplicadas.length} pendência(s) repetida(s) colapsada(s)`);
      }

      let resumosDoTenant = 0;

      for (const [destinatarioId, itens] of porUsuario) {
        if (resumosEnviados >= MAX_RESUMOS_POR_EXECUCAO) break;

        const telefone = normalizeBrPhone(itens[0].destinatario_telefone);

        if (!telefone) {
          await supabase
            .from("notificacao_whatsapp_fila")
            .update({ status: "erro", erro: "Telefone inválido" })
            .in("id", itens.map((i) => i.id));
          continue;
        }

        // Monta o texto (IA opcional)
        let ia = false;
        let texto: string | null = null;

        if (config.usar_ia && config.openai_api_key) {
          texto = await montarResumoComIA(itens, config.openai_api_key, config.tom_mensagem);
          ia = texto !== null;
        }
        if (!texto) texto = montarResumoTemplate(itens);

        // Cria o resumo antes do envio para ter um id no botão
        const { data: resumo, error: resumoErr } = await supabase
          .from("notificacao_whatsapp_resumos")
          .insert({
            tenant_id: agenda.tenant_id,
            destinatario_id: destinatarioId,
            destinatario_telefone: telefone,
            total_itens: itens.length,
            mensagem_enviada: texto,
            ia_usada: ia,
          })
          .select("id")
          .single();

        if (resumoErr || !resumo) {
          console.error("❌ Erro ao criar resumo:", resumoErr);
          continue;
        }

        const envio = await sendTextWithButtons(creds, {
          phone: telefone,
          message: texto,
          buttons: [{ buttonId: `confirmar:${resumo.id}`, label: "✅ Recebi" }],
          fallbackSuffix: "\n\n✅ Responda *OK* para confirmar o recebimento do seu resumo.",
          delayMessage: 3,
          pularBotoes: botoesIndisponiveis,
        });

        if (envio.ok && !envio.usouBotoes) botoesIndisponiveis = true;

        if (envio.ok) {
          await supabase
            .from("notificacao_whatsapp_resumos")
            .update({
              usou_botoes: envio.usouBotoes,
              wapi_message_id: envio.body?.messageId ?? null,
              wapi_inserted_id: envio.body?.insertedId ?? null,
            })
            .eq("id", resumo.id);

          await supabase
            .from("notificacao_whatsapp_fila")
            .update({
              status: "enviada",
              resumo_id: resumo.id,
              enviada_em: new Date().toISOString(),
            })
            .in("id", itens.map((i) => i.id));

          // Espelha nas notificações internas, para as estatísticas do painel
          const notificacaoIds = itens.map((i) => i.notificacao_id).filter(Boolean) as string[];

          if (notificacaoIds.length) {
            await supabase
              .from("notificacoes")
              .update({ whatsapp_enviado: true, whatsapp_enviado_em: new Date().toISOString() })
              .in("id", notificacaoIds);
          }

          resumosEnviados++;
          resumosDoTenant++;
          console.log(`✅ Resumo enviado: ${itens.length} itens → ${telefone}`);
        } else {
          await supabase
            .from("notificacao_whatsapp_resumos")
            .update({ erro: envio.error })
            .eq("id", resumo.id);

          await supabase
            .from("notificacao_whatsapp_fila")
            .update({ erro: envio.error, tentativas: (itens[0].tentativas ?? 0) + 1 })
            .in("id", itens.map((i) => i.id));

          console.error(`❌ Falha ao enviar para ${telefone}: ${envio.error}`);
        }

        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ENVIOS_MS));
      }

      await supabase
        .from("notificacao_whatsapp_disparos")
        .update({ total_resumos: resumosDoTenant })
        .eq("tenant_id", agenda.tenant_id)
        .eq("slot_em", slotEm.toISOString());

      relatorio.push({
        tenant_id: agenda.tenant_id,
        horario: `${String(slotVencido.hora).padStart(2, "0")}:${String(slotVencido.minuto).padStart(2, "0")}`,
        resumos: resumosDoTenant,
      });
    }

    console.log(`🏁 Execução concluída — ${resumosEnviados} resumo(s)`);
    return json({ success: true, resumos_enviados: resumosEnviados, tenants: relatorio });
  } catch (error: any) {
    console.error("💥 Erro no despachante:", error);
    return json({ success: false, error: error.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
