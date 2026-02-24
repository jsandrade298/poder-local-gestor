import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorUtils";
import { formatDateOnly } from "@/lib/dateUtils";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

export type RecentesDias = 7 | 15 | 30;

export function useDashboardData() {
  const { statusList, finalSlugs, getStatusLabel, getStatusColor } = useDemandaStatus();
  const [recentesDias, setRecentesDias] = useState<RecentesDias>(7);

  const todayStr = new Date().toISOString().split("T")[0];

  // ── KPIs via count queries ──────────────────────────────────
  const { data: kpiData, isLoading: isLoadingKpis } = useQuery({
    queryKey: ["dashboard-kpis", todayStr, finalSlugs],
    queryFn: async () => {
      const closedFilter = finalSlugs.length > 0
        ? `(${finalSlugs.join(",")})`
        : "(__never__)";

      const [totalRes, abertasRes, atrasoRes, concluidasRes, municRes] =
        await Promise.all([
          supabase.from("demandas").select("id", { count: "exact", head: true }),
          supabase.from("demandas").select("id", { count: "exact", head: true })
            .not("status", "in", closedFilter),
          supabase.from("demandas").select("id", { count: "exact", head: true })
            .lt("data_prazo", todayStr)
            .not("status", "in", closedFilter),
          finalSlugs.length > 0
            ? supabase.from("demandas").select("id", { count: "exact", head: true })
                .in("status", finalSlugs)
            : Promise.resolve({ count: 0, error: null }),
          supabase.from("municipes").select("id", { count: "exact", head: true }),
        ]);

      const total = totalRes.count || 0;
      const concluidas = concluidasRes.count || 0;

      return {
        totalDemandas: total,
        demandasAbertas: abertasRes.count || 0,
        demandasEmAtraso: atrasoRes.count || 0,
        totalMunicipes: municRes.count || 0,
        taxaConclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0,
      };
    },
    enabled: statusList.length > 0,
    retry: 2,
    staleTime: 30000,
  });

  // ── Dados para gráficos (status, áreas, prioridade) ─────────
  const { data: chartDemandas = [], isLoading: isLoadingCharts } = useQuery({
    queryKey: ["dashboard-chart-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("status, humor, area_id, prioridade, areas(nome)");
      if (error) { logError("Dashboard chart data:", error); throw error; }
      return data || [];
    },
    retry: 2,
    staleTime: 30000,
  });

  // ── Demandas em atraso detalhadas ───────────────────────────
  const { data: overdueData = [], isLoading: isLoadingOverdue } = useQuery({
    queryKey: ["dashboard-overdue", todayStr, finalSlugs],
    queryFn: async () => {
      const closedFilter = finalSlugs.length > 0 ? `(${finalSlugs.join(",")})` : "(__never__)";
      const { data, error } = await supabase
        .from("demandas")
        .select("id, titulo, protocolo, status, data_prazo, bairro, cidade, areas(nome)")
        .lt("data_prazo", todayStr)
        .not("status", "in", closedFilter)
        .order("data_prazo", { ascending: true });
      if (error) { logError("Dashboard overdue:", error); throw error; }
      return data || [];
    },
    enabled: statusList.length > 0,
    retry: 2,
    staleTime: 30000,
  });

  // ── Demandas recentes (baseado no período selecionado) ──────
  const { data: recentesData = [], isLoading: isLoadingRecentes } = useQuery({
    queryKey: ["dashboard-recentes", recentesDias],
    queryFn: async () => {
      const since = new Date(Date.now() - recentesDias * 86400000).toISOString();
      const { data, error } = await supabase
        .from("demandas")
        .select("id, titulo, protocolo, status, created_at, areas(nome), municipes(nome)")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) { logError("Dashboard recentes:", error); throw error; }
      return data || [];
    },
    retry: 2,
    staleTime: 30000,
  });

  // ── Aniversariantes do dia ── busca tudo e filtra client-side
  // (igual à lógica do WhatsApp — .like() em data não funciona no Postgres)
  const { data: aniversariantesRaw = [], isLoading: isLoadingAniversarios } = useQuery({
    queryKey: ["dashboard-aniversarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipes")
        .select("id, nome, telefone, bairro, cidade, data_nascimento")
        .not("data_nascimento", "is", null);
      if (error) { logError("Dashboard aniversarios:", error); throw error; }
      return data || [];
    },
    retry: 2,
    staleTime: 60000,
  });

  // Filtrar client-side por mês e dia
  const hoje = new Date();
  const mesHoje = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();

  const aniversariantesData = aniversariantesRaw.filter((m: any) => {
    if (!m.data_nascimento) return false;
    const [, mesNasc, diaNasc] = m.data_nascimento.split("-").map(Number);
    return mesNasc === mesHoje && diaNasc === diaHoje;
  });

  // ── Projetos ────────────────────────────────────────────────
  const { data: projetos = [], isLoading: isLoadingProjetos } = useQuery({
    queryKey: ["projetos-plano-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos_plano")
        .select("id, titulo, tipo, status, data_inicio, data_fim");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  // ═══════════════════════════════════════════════════════
  //  COMPUTED METRICS
  // ═══════════════════════════════════════════════════════

  const kpis = kpiData || {
    totalDemandas: 0, demandasAbertas: 0, demandasEmAtraso: 0,
    totalMunicipes: 0, taxaConclusao: 0,
  };

  // ── Humorômetro ──
  const humorValues: Record<string, number> = {
    muito_insatisfeito: 1, insatisfeito: 2, neutro: 3, satisfeito: 4, muito_satisfeito: 5,
  };
  const humorEmojis: Record<string, string> = {
    muito_insatisfeito: "😡", insatisfeito: "😞", neutro: "😐", satisfeito: "😊", muito_satisfeito: "😍",
  };

  const demandasComHumor = chartDemandas.filter((d: any) => d.humor && humorValues[d.humor]);
  const humorTotal = demandasComHumor.reduce((sum: number, d: any) => sum + (humorValues[d.humor] || 0), 0);
  const humorMedia = demandasComHumor.length > 0 ? humorTotal / demandasComHumor.length : 0;

  let humorMediaSlug = "neutro";
  if (humorMedia > 0) {
    if (humorMedia <= 1.5) humorMediaSlug = "muito_insatisfeito";
    else if (humorMedia <= 2.5) humorMediaSlug = "insatisfeito";
    else if (humorMedia <= 3.5) humorMediaSlug = "neutro";
    else if (humorMedia <= 4.5) humorMediaSlug = "satisfeito";
    else humorMediaSlug = "muito_satisfeito";
  }

  const humorDistribuicao = Object.keys(humorValues).map(slug => ({
    slug, emoji: humorEmojis[slug],
    count: chartDemandas.filter((d: any) => d.humor === slug).length,
  }));

  // ── Status counts ──
  const statusCountMap: Record<string, number> = {};
  chartDemandas.forEach((d: any) => {
    const s = d.status || "solicitada";
    statusCountMap[s] = (statusCountMap[s] || 0) + 1;
  });

  // ── Funil (ordem configurada) ──
  const funilData = statusList.map(s => ({
    name: s.nome, slug: s.slug,
    value: statusCountMap[s.slug] || 0,
    color: s.cor,
    is_final: s.is_final,
  }));

  // ── Prioridades ──
  const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
    urgente: { label: "Urgente", color: "#ef4444", order: 0 },
    alta:    { label: "Alta",    color: "#f97316", order: 1 },
    media:   { label: "Média",   color: "#eab308", order: 2 },
    baixa:   { label: "Baixa",   color: "#22c55e", order: 3 },
  };

  const prioridadeMap: Record<string, number> = {};
  chartDemandas.forEach((d: any) => {
    const p = d.prioridade || "media";
    prioridadeMap[p] = (prioridadeMap[p] || 0) + 1;
  });

  const prioridadeData = Object.entries(PRIORIDADE_CONFIG)
    .map(([slug, cfg]) => ({
      slug, label: cfg.label, color: cfg.color,
      value: prioridadeMap[slug] || 0,
      order: cfg.order,
    }))
    .sort((a, b) => a.order - b.order);

  // ── Top 5 Áreas × Status ──
  const areaStatusAcc: Record<string, Record<string, number>> = {};
  chartDemandas.forEach((d: any) => {
    const area = d.areas?.nome || "Sem área";
    const s = d.status || "solicitada";
    if (!areaStatusAcc[area]) areaStatusAcc[area] = {};
    areaStatusAcc[area][s] = (areaStatusAcc[area][s] || 0) + 1;
  });

  const uniqueStatuses = Array.from(new Set(chartDemandas.map((d: any) => d.status || "solicitada")));
  const areaTotals = Object.entries(areaStatusAcc)
    .map(([area, statuses]) => ({ area, total: Object.values(statuses).reduce((a, b) => a + b, 0), statuses }))
    .sort((a, b) => b.total - a.total);

  const top5Areas = areaTotals.slice(0, 5).map(item => {
    const row: Record<string, any> = { name: item.area };
    uniqueStatuses.forEach(s => { row[s] = item.statuses[s] || 0; });
    row.total = item.total;
    return row;
  });

  // ── Projetos por Status ──
  const projetosPorStatus: Record<string, { projetos: number; planilhas: number }> = {};
  projetos.forEach((p: any) => {
    const s = p.status || "planejado";
    if (!projetosPorStatus[s]) projetosPorStatus[s] = { projetos: 0, planilhas: 0 };
    if (p.tipo === "projeto") projetosPorStatus[s].projetos += 1;
    else projetosPorStatus[s].planilhas += 1;
  });

  const statusLabels: Record<string, string> = {
    planejado: "Planejado", em_andamento: "Em Andamento", pausado: "Pausado", concluido: "Concluído",
  };

  const projetosPlanilhasStatus = Object.entries(projetosPorStatus).map(([status, counts]) => ({
    name: statusLabels[status] || status,
    projetos: counts.projetos, planilhas: counts.planilhas,
  }));

  // ── Demandas em atraso detalhadas ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const demandasAtrasoDetalhadas = overdueData.map((demanda: any) => {
    const prazo = new Date(demanda.data_prazo + "T00:00:00");
    const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: demanda.id, titulo: demanda.titulo, protocolo: demanda.protocolo,
      area: demanda.areas?.nome || "Sem área", cidade: demanda.cidade, bairro: demanda.bairro,
      data_prazo: formatDateOnly(demanda.data_prazo), diasAtraso, status: demanda.status,
    };
  }).sort((a, b) => b.diasAtraso - a.diasAtraso);

  // ── Demandas recentes formatadas ──
  const demandasRecentes = recentesData.map((d: any) => ({
    id: d.id, titulo: d.titulo, protocolo: d.protocolo, status: d.status,
    area: d.areas?.nome || "Sem área", municipe: d.municipes?.nome || "Sem munícipe",
    created_at: d.created_at,
  }));

  return {
    isLoading: isLoadingKpis || isLoadingCharts || isLoadingOverdue ||
               isLoadingProjetos || isLoadingRecentes || isLoadingAniversarios,

    kpis,
    recentesDias,
    setRecentesDias,

    humor: {
      media: humorMedia, mediaSlug: humorMediaSlug,
      emoji: humorEmojis[humorMediaSlug] || "😐",
      total: demandasComHumor.length, distribuicao: humorDistribuicao,
    },

    charts: { funilData, prioridadeData, top5Areas, uniqueStatuses, projetosPlanilhasStatus },

    overdue: {
      demandasEmAtraso: kpis.demandasEmAtraso,
      demandasAtraso30: demandasAtrasoDetalhadas.filter(d => d.diasAtraso >= 30).length,
      demandasAtraso60: demandasAtrasoDetalhadas.filter(d => d.diasAtraso >= 60).length,
      demandasAtraso90: demandasAtrasoDetalhadas.filter(d => d.diasAtraso >= 90).length,
      demandasAtrasoDetalhadas,
    },

    recentes: demandasRecentes,
    aniversariantes: aniversariantesData,

    getStatusLabel, getStatusColor, statusList,
  };
}
