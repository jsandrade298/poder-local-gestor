import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorUtils";
import { formatDateOnly } from "@/lib/dateUtils";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

export function useDashboardData() {
  const { statusList, getStatusLabel, getStatusColor } = useDemandaStatus();

  // ── Demandas (batch load) ──
  const { data: demandas = [], isLoading: isLoadingDemandas } = useQuery({
    queryKey: ["demandas-dashboard"],
    queryFn: async () => {
      const BATCH = 1000;
      let all: any[] = [];
      let offset = 0;
      let total = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error, count } = await supabase
          .from("demandas")
          .select("*, areas(nome), municipes(nome_completo)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH - 1);
        if (error) { logError("Dashboard demandas:", error); throw error; }
        if (offset === 0 && count !== null) total = count;
        if (data && data.length > 0) {
          all = [...all, ...data];
          offset += BATCH;
          hasMore = data.length === BATCH;
        } else hasMore = false;
        if (total > 0 && all.length >= total) hasMore = false;
      }
      return all;
    },
  });

  // ── Munícipes count ──
  const { data: municipes = [], isLoading: isLoadingMunicipes } = useQuery({
    queryKey: ["municipes-dashboard"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const size = 1000;
      let hasMore = true;
      let total = 0;
      while (hasMore) {
        const { data, error, count } = await supabase
          .from("municipes")
          .select("id, created_at", { count: "exact" })
          .range(from, from + size - 1);
        if (error) { logError("Dashboard municipes:", error); throw error; }
        if (from === 0 && count !== null) total = count;
        if (data && data.length > 0) {
          all = [...all, ...data];
          hasMore = data.length === size;
          from += size;
        } else hasMore = false;
        if (total > 0 && all.length >= total) hasMore = false;
      }
      return all;
    },
  });

  // ── Planos de Ação + status_acao ──
  const { data: planosAcao = [], isLoading: isLoadingPlanos } = useQuery({
    queryKey: ["planos-acao-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_acao")
        .select("*, status_acao(nome, cor), eixos(nome, cor)");
      if (error) throw error;
      return data || [];
    },
  });

  // ── Projetos & Planilhas ──
  const { data: projetos = [], isLoading: isLoadingProjetos } = useQuery({
    queryKey: ["projetos-plano-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos_plano")
        .select("id, titulo, tipo, status, data_inicio, data_fim, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // ── Tarefas de Projetos ──
  const { data: tarefas = [], isLoading: isLoadingTarefas } = useQuery({
    queryKey: ["projeto-tarefas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, data_fim, percentual, projeto_id");
      if (error) throw error;
      return data || [];
    },
  });

  // ═══════════════════════════════════════════
  //  COMPUTED METRICS
  // ═══════════════════════════════════════════
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── KPIs ──
  const totalDemandas = demandas.length;
  const totalMunicipes = municipes.length;
  const totalPlanosAcao = planosAcao.length;

  // Demandas abertas = não concluídas (slug != atendido && slug != devolvido)
  const closedSlugs = ["atendido", "devolvido", "concluido", "arquivado"];
  const demandasAbertas = demandas.filter(
    (d) => !closedSlugs.includes(d.status || "")
  ).length;

  const taxaConclusao =
    totalDemandas > 0
      ? Math.round(
          (demandas.filter((d) => d.status === "atendido").length /
            totalDemandas) *
            100
        )
      : 0;

  // Demandas em atraso (com data_prazo, não concluídas)
  const demandasComAtraso = demandas.filter((d) => {
    if (!d.data_prazo || closedSlugs.includes(d.status || "")) return false;
    return today > new Date(d.data_prazo);
  });
  const demandasEmAtraso = demandasComAtraso.length;

  // ── Demandas por Status (donut chart) ──
  const statusCountMap: Record<string, number> = {};
  demandas.forEach((d) => {
    const s = d.status || "solicitada";
    statusCountMap[s] = (statusCountMap[s] || 0) + 1;
  });

  const demandasPorStatus = Object.entries(statusCountMap)
    .map(([slug, count]) => ({
      name: getStatusLabel(slug),
      slug,
      value: count,
      percent:
        totalDemandas > 0 ? Math.round((count / totalDemandas) * 100) : 0,
      color: getStatusColor(slug),
    }))
    .sort((a, b) => b.value - a.value);

  // ── Top 5 Áreas × Status (stacked bar) ──
  const areaStatusAcc: Record<string, Record<string, number>> = {};
  demandas.forEach((d) => {
    const area = d.areas?.nome || "Sem área";
    const s = d.status || "solicitada";
    if (!areaStatusAcc[area]) areaStatusAcc[area] = {};
    areaStatusAcc[area][s] = (areaStatusAcc[area][s] || 0) + 1;
  });

  // Get unique statuses used
  const uniqueStatuses = Array.from(
    new Set(demandas.map((d) => d.status || "solicitada"))
  );

  const areaTotals = Object.entries(areaStatusAcc).map(([area, statuses]) => ({
    area,
    total: Object.values(statuses).reduce((a, b) => a + b, 0),
    statuses,
  }));
  areaTotals.sort((a, b) => b.total - a.total);

  const top5Areas = areaTotals.slice(0, 5).map((item) => {
    const row: Record<string, any> = { name: item.area };
    uniqueStatuses.forEach((s) => {
      row[s] = item.statuses[s] || 0;
    });
    row.total = item.total;
    return row;
  });

  // ── Planos de Ação por Status (bar chart) ──
  const planosStatusAcc: Record<string, { count: number; cor: string }> = {};
  planosAcao.forEach((p: any) => {
    const statusNome = p.status_acao?.nome || "Sem status";
    const statusCor = p.status_acao?.cor || "#6b7280";
    if (!planosStatusAcc[statusNome])
      planosStatusAcc[statusNome] = { count: 0, cor: statusCor };
    planosStatusAcc[statusNome].count += 1;
  });
  const planosPorStatus = Object.entries(planosStatusAcc).map(
    ([nome, { count, cor }]) => ({
      name: nome,
      value: count,
      color: cor,
    })
  );

  // Planos concluídos
  const planosConcluidos = planosAcao.filter((p: any) => p.concluida).length;
  const planosAtivos = totalPlanosAcao - planosConcluidos;

  // ── Projetos & Planilhas por Status ──
  const projetosCount = projetos.filter((p: any) => p.tipo === "projeto").length;
  const planilhasCount = projetos.filter(
    (p: any) => p.tipo === "planilha"
  ).length;

  const projetosPorStatus: Record<string, { projetos: number; planilhas: number }> = {};
  projetos.forEach((p: any) => {
    const s = p.status || "planejado";
    if (!projetosPorStatus[s])
      projetosPorStatus[s] = { projetos: 0, planilhas: 0 };
    if (p.tipo === "projeto") projetosPorStatus[s].projetos += 1;
    else projetosPorStatus[s].planilhas += 1;
  });

  const statusLabels: Record<string, string> = {
    planejado: "Planejado",
    em_andamento: "Em Andamento",
    pausado: "Pausado",
    concluido: "Concluído",
  };

  const projetosPlanilhasStatus = Object.entries(projetosPorStatus).map(
    ([status, counts]) => ({
      name: statusLabels[status] || status,
      projetos: counts.projetos,
      planilhas: counts.planilhas,
    })
  );

  // ── Tarefas em atraso (projetos) ──
  const tarefasEmAtraso = tarefas.filter((t: any) => {
    if (!t.data_fim || (t.percentual && t.percentual >= 100)) return false;
    return today > new Date(t.data_fim);
  }).length;

  // ── Demandas em atraso detalhadas ──
  const demandasAtrasoDetalhadas = demandasComAtraso
    .map((demanda) => {
      const prazo = new Date(demanda.data_prazo);
      const diasAtraso = Math.floor(
        (today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: demanda.id,
        titulo: demanda.titulo,
        protocolo: demanda.protocolo,
        area: demanda.areas?.nome || "Sem área",
        cidade: demanda.cidade,
        bairro: demanda.bairro,
        data_prazo: formatDateOnly(demanda.data_prazo),
        diasAtraso,
        status: demanda.status,
      };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  // Atraso por faixas
  const demandasAtraso30 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso > 30
  ).length;
  const demandasAtraso60 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso > 60
  ).length;
  const demandasAtraso90 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso > 90
  ).length;

  return {
    isLoading:
      isLoadingDemandas ||
      isLoadingMunicipes ||
      isLoadingPlanos ||
      isLoadingProjetos ||
      isLoadingTarefas,

    kpis: {
      totalDemandas,
      demandasAbertas,
      demandasEmAtraso,
      totalMunicipes,
      totalPlanosAcao,
      planosAtivos,
      planosConcluidos,
      projetosCount,
      planilhasCount,
      tarefasEmAtraso,
      taxaConclusao,
    },

    charts: {
      demandasPorStatus,
      top5Areas,
      uniqueStatuses,
      planosPorStatus,
      projetosPlanilhasStatus,
    },

    overdue: {
      demandasEmAtraso,
      demandasAtraso30,
      demandasAtraso60,
      demandasAtraso90,
      demandasAtrasoDetalhadas,
    },

    // Pass helpers for chart coloring
    getStatusLabel,
    getStatusColor,
    statusList,
  };
}
