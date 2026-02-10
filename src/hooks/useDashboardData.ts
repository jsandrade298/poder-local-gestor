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
          .select("*, areas(nome), municipes(nome)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH - 1);
        if (error) {
          logError("Dashboard demandas:", error);
          throw error;
        }
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
    retry: 2,
    staleTime: 30000,
  });

  // ── Munícipes (count only - lightweight) ──
  const { data: totalMunicipes = 0, isLoading: isLoadingMunicipes } = useQuery({
    queryKey: ["municipes-dashboard-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("municipes")
        .select("id", { count: "exact", head: true });
      if (error) {
        logError("Dashboard municipes count:", error);
        throw error;
      }
      return count || 0;
    },
    staleTime: 60000,
  });

  // ── Projetos & Planilhas ──
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

  // ═══════════════════════════════════════════
  //  COMPUTED METRICS
  // ═══════════════════════════════════════════
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDemandas = demandas.length;

  // Demandas abertas = não concluídas
  const closedSlugs = ["atendido", "devolvido", "concluido", "arquivado"];
  const demandasAbertas = demandas.filter(
    (d) => !closedSlugs.includes(d.status || "")
  ).length;

  const demandasAtendidas = demandas.filter((d) => d.status === "atendido").length;
  const taxaConclusao =
    totalDemandas > 0 ? Math.round((demandasAtendidas / totalDemandas) * 100) : 0;

  // ── Demandas em atraso ──
  const demandasComAtraso = demandas.filter((d) => {
    if (!d.data_prazo || closedSlugs.includes(d.status || "")) return false;
    return today > new Date(d.data_prazo);
  });
  const demandasEmAtraso = demandasComAtraso.length;

  // ── Humorômetro ──
  const humorValues: Record<string, number> = {
    muito_insatisfeito: 1,
    insatisfeito: 2,
    neutro: 3,
    satisfeito: 4,
    muito_satisfeito: 5,
  };
  const humorEmojis: Record<string, string> = {
    muito_insatisfeito: "😡",
    insatisfeito: "😞",
    neutro: "😐",
    satisfeito: "😊",
    muito_satisfeito: "😍",
  };

  const demandasComHumor = demandas.filter((d) => d.humor && humorValues[d.humor]);
  const humorTotal = demandasComHumor.reduce(
    (sum, d) => sum + (humorValues[d.humor] || 0),
    0
  );
  const humorMedia =
    demandasComHumor.length > 0 ? humorTotal / demandasComHumor.length : 0;

  // Map average to closest emoji
  let humorMediaSlug = "neutro";
  if (humorMedia > 0) {
    if (humorMedia <= 1.5) humorMediaSlug = "muito_insatisfeito";
    else if (humorMedia <= 2.5) humorMediaSlug = "insatisfeito";
    else if (humorMedia <= 3.5) humorMediaSlug = "neutro";
    else if (humorMedia <= 4.5) humorMediaSlug = "satisfeito";
    else humorMediaSlug = "muito_satisfeito";
  }

  // Count per humor level
  const humorDistribuicao = Object.entries(humorValues).map(([slug, _]) => ({
    slug,
    emoji: humorEmojis[slug],
    count: demandas.filter((d) => d.humor === slug).length,
  }));

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
      percent: totalDemandas > 0 ? Math.round((count / totalDemandas) * 100) : 0,
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

  const uniqueStatuses = Array.from(
    new Set(demandas.map((d) => d.status || "solicitada"))
  );

  const areaTotals = Object.entries(areaStatusAcc)
    .map(([area, statuses]) => ({
      area,
      total: Object.values(statuses).reduce((a, b) => a + b, 0),
      statuses,
    }))
    .sort((a, b) => b.total - a.total);

  const top5Areas = areaTotals.slice(0, 5).map((item) => {
    const row: Record<string, any> = { name: item.area };
    uniqueStatuses.forEach((s) => {
      row[s] = item.statuses[s] || 0;
    });
    row.total = item.total;
    return row;
  });

  // ── Projetos & Planilhas por Status ──
  const projetosPorStatus: Record<
    string,
    { projetos: number; planilhas: number }
  > = {};
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

  const demandasAtraso30 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso >= 30
  ).length;
  const demandasAtraso60 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso >= 60
  ).length;
  const demandasAtraso90 = demandasAtrasoDetalhadas.filter(
    (d) => d.diasAtraso >= 90
  ).length;

  return {
    isLoading: isLoadingDemandas || isLoadingMunicipes || isLoadingProjetos,

    kpis: {
      totalDemandas,
      demandasAbertas,
      demandasEmAtraso,
      totalMunicipes,
      taxaConclusao,
    },

    humor: {
      media: humorMedia,
      mediaSlug: humorMediaSlug,
      emoji: humorEmojis[humorMediaSlug] || "😐",
      total: demandasComHumor.length,
      distribuicao: humorDistribuicao,
    },

    charts: {
      demandasPorStatus,
      top5Areas,
      uniqueStatuses,
      projetosPlanilhasStatus,
    },

    overdue: {
      demandasEmAtraso,
      demandasAtraso30,
      demandasAtraso60,
      demandasAtraso90,
      demandasAtrasoDetalhadas,
    },

    getStatusLabel,
    getStatusColor,
    statusList,
  };
}
