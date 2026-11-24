// Lembretes e avisos de atraso de tarefas do Kanban.
//
// Chamada pelo cron `lembretes-tarefas-09h/15h/21h` (via public.processar_lembretes_tarefas).
// Cria notificações internas e, se houver instância Z-API, manda WhatsApp para a equipe.
//
// Revisão 24/11/2026 — fim da repetição de avisos de atraso:
//   Antes: cada tarefa atrasada gerava um aviso em CADA turno, TODO dia
//   (3 por dia, por pessoa, indefinidamente). 97% das notificações eram isso
//   e só ~5% eram lidas.
//   Agora: aviso de atraso só no turno da manhã, no 1º dia de atraso e
//   depois a cada 7 dias (dias 1, 8, 15, 22...). Lembretes antes do prazo
//   continuam como estavam.
//
// Revisão 24/11/2026 (2) — cartões de projeto (Quadros) também avisam:
//   véspera do prazo e atraso (1º dia, depois semanal), só de manhã,
//   para o responsável e os colaboradores do cartão. Só aviso interno.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Intervalo, em dias, entre avisos repetidos de uma mesma tarefa atrasada. */
const INTERVALO_AVISO_ATRASO_DIAS = 7;

function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[987]/.test(numero)) digits = ddd + "9" + numero;
  }
  return "55" + digits;
}

function calcularDelayTyping(mensagem: string): number {
  return Math.min(Math.max(Math.ceil(mensagem.length / 50), 2), 50);
}

async function callZApi(
  instanceId: string, token: string, clientToken: string,
  endpoint: string, payload: any
): Promise<{ ok: boolean; body: any; error?: string }> {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    if (!response.ok) return { ok: false, body, error: body?.error || body?.message || `HTTP ${response.status}` };
    return { ok: true, body };
  } catch (error: any) {
    return { ok: false, body: null, error: error.message };
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function diasEntre(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z");
  const b = new Date(dateB + "T00:00:00Z");
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** Aviso de atraso só de manhã, no 1º dia e depois a cada INTERVALO_AVISO_ATRASO_DIAS. */
function deveAvisarAtraso(turno: Turno, diasAtraso: number): boolean {
  if (turno !== "manha") return false;
  return diasAtraso >= 1 && (diasAtraso - 1) % INTERVALO_AVISO_ATRASO_DIAS === 0;
}

// ============================================================
// Mensagens variadas por turno
// ============================================================

type Turno = "manha" | "tarde" | "noite";

function getMensagemLembrete(turno: Turno, titulo: string, dias: number, dataPrazo: string): { msg: string; titulo_notif: string } {
  const dataFormatada = formatDate(dataPrazo);

  if (dias === 0) {
    const opcoes: Record<Turno, string> = {
      manha: `🚨 Bom dia! A tarefa "${titulo}" vence HOJE (${dataFormatada}). Priorize essa entrega!`,
      tarde: `⚠️ Atenção! A tarefa "${titulo}" vence HOJE (${dataFormatada}). Ainda dá tempo de concluir!`,
      noite: `🔴 Última chamada! A tarefa "${titulo}" vence HOJE (${dataFormatada}). Não deixe para amanhã!`,
    };
    return { msg: opcoes[turno], titulo_notif: "Tarefa vence hoje!" };
  }

  const diasTexto = dias === 1 ? "1 dia" : `${dias} dias`;
  const opcoes: Record<Turno, string> = {
    manha: `⏰ Bom dia! A tarefa "${titulo}" vence em ${diasTexto} (${dataFormatada}). Planeje sua entrega!`,
    tarde: `📋 Lembrete: a tarefa "${titulo}" vence em ${diasTexto} (${dataFormatada}). Como está o andamento?`,
    noite: `🔔 Boa noite! A tarefa "${titulo}" vence em ${diasTexto} (${dataFormatada}). Organize-se para amanhã!`,
  };
  return { msg: opcoes[turno], titulo_notif: `Lembrete: tarefa vence em ${diasTexto}` };
}

function getMensagemAtraso(titulo: string, diasAtraso: number, dataPrazo: string): { msg: string; titulo_notif: string } {
  const dataFormatada = formatDate(dataPrazo);
  const diasTexto = diasAtraso === 1 ? "1 dia" : `${diasAtraso} dias`;

  if (diasAtraso === 1) {
    return {
      msg: `🔴 A tarefa "${titulo}" passou do prazo (${dataFormatada}). Atualize o andamento no Kanban ou ajuste o prazo.`,
      titulo_notif: "Tarefa passou do prazo",
    };
  }
  return {
    msg: `📌 Resumo semanal: "${titulo}" segue pendente há ${diasTexto} (prazo era ${dataFormatada}). Se não for mais necessária, conclua ou remova do Kanban.`,
    titulo_notif: `Tarefa atrasada há ${diasTexto}`,
  };
}

// ============================================================
// Processar lembretes de um tenant
// ============================================================
/**
 * Desde 24/11/2026 as tarefas do Kanban antigo foram trazidas para os
 * Quadros (cartões) e a tabela `tarefas` não é mais editada. Ler as duas
 * avisaria em dobro — e a antiga lembraria de tarefas já concluídas nos
 * Quadros. Por isso só os cartões geram aviso. (Código antigo mantido.)
 */
const LEMBRAR_TAREFAS_ANTIGAS = false;

async function processarTenant(supabase: any, tenantId: string, tenantNome: string, hoje: string, turno: Turno) {
  console.log(`\n🏢 ${tenantNome} (turno: ${turno})`);
  const cartoes = await processarCartoes(supabase, tenantId, hoje, turno);
  if (!LEMBRAR_TAREFAS_ANTIGAS) return { ...cartoes, erros: 0 };
  const r = await processarTarefas(supabase, tenantId, tenantNome, hoje, turno);
  return { ...r, lembretes: r.lembretes + cartoes.lembretes, atrasos: r.atrasos + cartoes.atrasos };
}

async function processarTarefas(supabase: any, tenantId: string, tenantNome: string, hoje: string, turno: Turno) {
  console.log(`\n🏢 Processando tenant: ${tenantNome} (turno: ${turno})`);

  const { data: tarefas, error: tarefasErr } = await supabase
    .from("tarefas")
    .select("id, titulo, data_prazo, lembretes_prazo, responsavel_id, created_by, kanban_type, kanban_position, completed")
    .eq("tenant_id", tenantId)
    .eq("completed", false)
    .in("kanban_position", ["a_fazer", "em_progresso"])
    .not("data_prazo", "is", null);

  if (tarefasErr) {
    console.error("❌ Erro ao buscar tarefas:", tarefasErr.message);
    return { lembretes: 0, atrasos: 0, erros: 1 };
  }

  if (!tarefas || tarefas.length === 0) {
    console.log("  Nenhuma tarefa com prazo pendente");
    return { lembretes: 0, atrasos: 0, erros: 0 };
  }

  console.log(`  📋 ${tarefas.length} tarefas com prazo encontradas`);

  // Buscar notificações já enviadas HOJE NESTE TURNO
  const { data: notifEnviadas } = await supabase
    .from("tarefa_prazo_notificacoes")
    .select("tarefa_id, tipo, dias_referencia")
    .eq("tenant_id", tenantId)
    .eq("data_referencia", hoje)
    .like("tipo", `%_${turno}`);

  const enviadasSet = new Set(
    (notifEnviadas || []).map((n: any) => `${n.tarefa_id}|${n.tipo}|${n.dias_referencia}`)
  );

  // Buscar instância Z-API
  let zapiInstance: any = null;

  const { data: whatsConfig } = await supabase
    .from("notification_whatsapp_config")
    .select("*")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (whatsConfig?.zapi_instance_id && whatsConfig?.zapi_token && whatsConfig?.zapi_client_token) {
    zapiInstance = {
      instance_id: whatsConfig.zapi_instance_id,
      instance_token: whatsConfig.zapi_token,
      client_token: whatsConfig.zapi_client_token,
    };
  } else {
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_id, instance_token, client_token")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .not("instance_id", "is", null)
      .not("instance_token", "is", null)
      .not("client_token", "is", null)
      .limit(1)
      .maybeSingle();

    if (inst) zapiInstance = inst;
  }

  if (zapiInstance) console.log("  📱 WhatsApp disponível");
  else console.log("  ⚠️ Sem WhatsApp — apenas notificações internas");

  let totalLembretes = 0;
  let totalAtrasos = 0;

  for (const tarefa of tarefas) {
    const diasParaPrazo = diasEntre(tarefa.data_prazo, hoje);
    const estaAtrasada = diasParaPrazo < 0;
    const diasAtraso = Math.abs(diasParaPrazo);
    const lembretes: number[] = tarefa.lembretes_prazo || [];

    // Decide antes de consultar colaboradores, para não fazer consultas à toa
    const querLembrete = !estaAtrasada && (diasParaPrazo === 0 || lembretes.includes(diasParaPrazo));
    const querAtraso = estaAtrasada && deveAvisarAtraso(turno, diasAtraso);
    if (!querLembrete && !querAtraso) continue;

    const destinatarioIds = new Set<string>();
    if (tarefa.responsavel_id) destinatarioIds.add(tarefa.responsavel_id);
    if (tarefa.created_by) destinatarioIds.add(tarefa.created_by);

    const { data: colaboradores } = await supabase
      .from("tarefa_colaboradores")
      .select("colaborador_id")
      .eq("tarefa_id", tarefa.id);

    (colaboradores || []).forEach((c: any) => destinatarioIds.add(c.colaborador_id));
    if (destinatarioIds.size === 0) continue;

    // ── Lembrete antes do prazo (inalterado) ──
    if (querLembrete) {
      const tipoComTurno = `lembrete_antes_${turno}`;
      const chave = `${tarefa.id}|${tipoComTurno}|${diasParaPrazo}`;
      if (!enviadasSet.has(chave)) {
        const { msg, titulo_notif } = getMensagemLembrete(turno, tarefa.titulo, diasParaPrazo, tarefa.data_prazo);
        console.log(`  🔔 [${turno}] Lembrete: "${tarefa.titulo}" — ${diasParaPrazo === 0 ? "HOJE" : `${diasParaPrazo}d`}`);
        for (const destId of destinatarioIds) {
          await criarNotificacao(supabase, { tarefa, destinatarioId: destId, tipo: tipoComTurno, diasRef: diasParaPrazo, hoje, tenantId, mensagem: msg, titulo: titulo_notif, zapiInstance });
        }
        totalLembretes++;
        enviadasSet.add(chave);
      }
    }

    // ── Tarefa atrasada: 1º dia e depois semanal, só de manhã ──
    if (querAtraso) {
      const tipoComTurno = `atraso_diario_${turno}`;
      const chave = `${tarefa.id}|${tipoComTurno}|${diasAtraso}`;
      if (!enviadasSet.has(chave)) {
        const { msg, titulo_notif } = getMensagemAtraso(tarefa.titulo, diasAtraso, tarefa.data_prazo);
        console.log(`  🔴 [${turno}] Atraso: "${tarefa.titulo}" — ${diasAtraso}d`);
        for (const destId of destinatarioIds) {
          await criarNotificacao(supabase, { tarefa, destinatarioId: destId, tipo: tipoComTurno, diasRef: diasAtraso, hoje, tenantId, mensagem: msg, titulo: titulo_notif, zapiInstance });
        }
        totalAtrasos++;
        enviadasSet.add(chave);
      }
    }
  }

  console.log(`  ✅ Concluído: ${totalLembretes} lembretes, ${totalAtrasos} atrasos`);
  return { lembretes: totalLembretes, atrasos: totalAtrasos, erros: 0 };
}

// ============================================================
// Cartões de projeto (Quadros) — só aviso interno, só de manhã
//   • véspera do prazo
//   • 1º dia de atraso e depois a cada 7 dias
// Destinatários: responsável + colaboradores do cartão.
// Sem tabela de controle: antes de criar, confere se o aviso de hoje
// para aquele cartão/pessoa já existe em `notificacoes`.
// ============================================================
const COLUNA_FINAL = /conclu|feito|finaliz|entregue|done/i;

async function processarCartoes(supabase: any, tenantId: string, hoje: string, turno: Turno) {
  if (turno !== "manha") return { lembretes: 0, atrasos: 0 };

  const { data: cartoes, error } = await supabase
    .from("kanban_board_cards")
    .select("id, titulo, data_prazo, responsavel_id, board_id, kanban_boards!inner(nome, arquivado_em), kanban_board_colunas(nome, slug)")
    .eq("tenant_id", tenantId)
    .is("arquivado_em", null)
    .is("kanban_boards.arquivado_em", null)
    .not("data_prazo", "is", null);

  if (error) {
    console.error("❌ Erro ao buscar cartões:", error.message);
    return { lembretes: 0, atrasos: 0 };
  }

  const pendentes = (cartoes || []).filter((c: any) => {
    const col = c.kanban_board_colunas || {};
    return !COLUNA_FINAL.test(`${col.slug ?? ""} ${col.nome ?? ""}`);
  });

  const aAvisar = pendentes
    .map((c: any) => {
      const dias = diasEntre(c.data_prazo, hoje); // >0 faltam, <0 atrasado
      if (dias === 1) return { c, tipo: "cartao_lembrete", dias };
      if (dias < 0 && deveAvisarAtraso(turno, -dias)) return { c, tipo: "cartao_atrasado", dias };
      return null;
    })
    .filter(Boolean) as { c: any; tipo: string; dias: number }[];

  if (aAvisar.length === 0) return { lembretes: 0, atrasos: 0 };

  // Avisos de cartão já criados hoje (evita duplicar se a função rodar 2x)
  const inicioHoje = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const { data: jaHoje } = await supabase
    .from("notificacoes")
    .select("destinatario_id, url_destino")
    .eq("tenant_id", tenantId)
    .in("tipo", ["cartao_lembrete", "cartao_atrasado"])
    .gte("created_at", inicioHoje);
  const feitos = new Set((jaHoje || []).map((n: any) => `${n.destinatario_id}|${n.url_destino}`));

  const ids = aAvisar.map((a) => a.c.id);
  const { data: colabs } = await supabase
    .from("kanban_board_card_colaboradores")
    .select("card_id, usuario_id")
    .in("card_id", ids);

  let lembretes = 0;
  let atrasos = 0;
  const linhas: any[] = [];

  for (const { c, tipo, dias } of aAvisar) {
    const dest = new Set<string>();
    if (c.responsavel_id) dest.add(c.responsavel_id);
    (colabs || []).filter((x: any) => x.card_id === c.id).forEach((x: any) => dest.add(x.usuario_id));
    if (dest.size === 0) continue;

    const url = `/quadros/${c.board_id}?cartao=${c.id}`;
    const projeto = c.kanban_boards?.nome || "projeto";
    const data = formatDate(c.data_prazo);
    const atraso = -dias;
    const titulo = tipo === "cartao_lembrete"
      ? "Cartão vence amanhã"
      : atraso === 1 ? "Cartão passou do prazo" : `Cartão atrasado há ${atraso} dias`;
    const mensagem = tipo === "cartao_lembrete"
      ? `"${c.titulo}" (${projeto}) vence amanhã, ${data}.`
      : atraso === 1
        ? `"${c.titulo}" (${projeto}) passou do prazo (${data}). Atualize a etapa ou ajuste o prazo.`
        : `Resumo semanal: "${c.titulo}" (${projeto}) segue aberto há ${atraso} dias do prazo (${data}). Se não for mais necessário, mova para a etapa final ou arquive.`;

    let algum = false;
    for (const d of dest) {
      if (feitos.has(`${d}|${url}`)) continue;
      feitos.add(`${d}|${url}`);
      algum = true;
      linhas.push({
        destinatario_id: d, remetente_id: d, tipo, titulo, mensagem,
        url_destino: url, lida: false, tenant_id: tenantId,
      });
    }
    if (algum) tipo === "cartao_lembrete" ? lembretes++ : atrasos++;
  }

  if (linhas.length > 0) {
    const { error: insErr } = await supabase.from("notificacoes").insert(linhas);
    if (insErr) {
      console.error("❌ Erro ao criar avisos de cartões:", insErr.message);
      return { lembretes: 0, atrasos: 0 };
    }
  }
  console.log(`  🗂️ Cartões: ${lembretes} lembretes, ${atrasos} atrasos (${linhas.length} avisos)`);
  return { lembretes, atrasos };
}

// ============================================================
// Criar notificação + enviar WhatsApp
// ============================================================
async function criarNotificacao(supabase: any, params: {
  tarefa: any; destinatarioId: string; tipo: string; diasRef: number;
  hoje: string; tenantId: string; mensagem: string; titulo: string; zapiInstance: any;
}) {
  const { tarefa, destinatarioId, tipo, diasRef, hoje, tenantId, mensagem, titulo, zapiInstance } = params;

  try {
    const tipoNotif = tipo.startsWith("atraso") ? "tarefa_atrasada" : "tarefa_lembrete";
    const { data: notif, error: notifErr } = await supabase
      .from("notificacoes")
      .insert({
        destinatario_id: destinatarioId,
        remetente_id: destinatarioId,
        tipo: tipoNotif,
        titulo, mensagem,
        url_destino: `/kanban?tarefa=${tarefa.id}`,
        lida: false,
        tenant_id: tenantId,
      })
      .select("id")
      .single();

    if (notifErr) {
      console.error(`    ❌ Erro notificação:`, notifErr.message);
      return;
    }

    await supabase.from("tarefa_prazo_notificacoes").insert({
      tarefa_id: tarefa.id, tipo,
      dias_referencia: diasRef,
      data_referencia: hoje,
      destinatario_id: destinatarioId,
      notificacao_id: notif?.id || null,
      tenant_id: tenantId,
    });

    if (zapiInstance) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("id", destinatarioId)
        .single();

      if (profile?.telefone) {
        const phone = normalizePhone(profile.telefone);
        const primeiroNome = (profile.nome || "").split(" ")[0];
        const msgWhatsApp = `🔔 Olá ${primeiroNome}!\n\n${mensagem}\n\nAcesse o sistema para mais detalhes.`;

        try {
          const result = await callZApi(
            zapiInstance.instance_id, zapiInstance.instance_token, zapiInstance.client_token,
            "send-text",
            { phone, message: msgWhatsApp, delayTyping: calcularDelayTyping(msgWhatsApp) }
          );
          if (result.ok) {
            if (notif?.id) {
              await supabase.from("notificacoes").update({
                whatsapp_enviado: true,
                whatsapp_enviado_em: new Date().toISOString(),
                whatsapp_mensagem_enviada: msgWhatsApp,
              }).eq("id", notif.id);
            }
            console.log(`    📱 WhatsApp → ${primeiroNome}`);
          } else {
            console.warn(`    ⚠️ WhatsApp falhou → ${primeiroNome}: ${result.error}`);
          }
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
        } catch (whatsErr: any) {
          console.warn(`    ⚠️ Erro WhatsApp: ${whatsErr.message}`);
        }
      }
    }
  } catch (err: any) {
    console.error(`    ❌ Erro geral:`, err.message);
  }
}

// ============================================================
// Handler principal
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== PROCESSAR LEMBRETES DE TAREFAS ===");
    console.log("⏰ Executando em:", new Date().toISOString());

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const agora = new Date();
    const hoje = agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    let requestData: any = {};
    try { requestData = await req.json(); } catch {}

    // Determinar turno: body > hora atual
    let turno: Turno = requestData.turno || "manha";
    if (!requestData.turno) {
      const horaBrasilia = parseInt(agora.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }));
      if (horaBrasilia >= 18) turno = "noite";
      else if (horaBrasilia >= 13) turno = "tarde";
      else turno = "manha";
    }

    console.log(`📅 Data: ${hoje} | 🕐 Turno: ${turno}`);

    const tenantIdParam = requestData.tenant_id || null;

    if (tenantIdParam) {
      const { data: tenant } = await supabase
        .from("tenants").select("id, nome")
        .eq("id", tenantIdParam).eq("ativo", true).single();
      if (!tenant) {
        return new Response(JSON.stringify({ success: false, error: "Tenant não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      }
      const resultado = await processarTenant(supabase, tenant.id, tenant.nome, hoje, turno);
      return new Response(JSON.stringify({ success: true, tenant: tenant.nome, turno, ...resultado }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("🏢 Processando todos os tenants...");
    const { data: tenants } = await supabase.from("tenants").select("id, nome").eq("ativo", true);

    if (!tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum tenant ativo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resultados: any[] = [];
    const totalGeral = { lembretes: 0, atrasos: 0, erros: 0 };

    for (const tenant of tenants) {
      const r = await processarTenant(supabase, tenant.id, tenant.nome, hoje, turno);
      resultados.push({ tenant: tenant.nome, ...r });
      totalGeral.lembretes += r.lembretes;
      totalGeral.atrasos += r.atrasos;
      totalGeral.erros += r.erros;
    }

    console.log(`\n=== RESUMO (${turno}) ===`);
    console.log(`✅ ${tenants.length} tenants | 🔔 ${totalGeral.lembretes} lembretes | 🔴 ${totalGeral.atrasos} atrasos`);

    return new Response(JSON.stringify({
      success: true, data: hoje, turno,
      tenants_processados: tenants.length,
      total: totalGeral, detalhes: resultados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("💥 Erro fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
