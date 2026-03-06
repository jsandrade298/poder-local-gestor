import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logError } from "@/lib/errorUtils";
import { formatDateOnly } from "@/lib/dateUtils";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

export type RecentesDias = 7 | 15 | 30;

export function useRepresentanteDashboardData() {
  const { user } = useAuth();
  const uid = user?.id;

  const { statusList, finalSlugs, getStatusLabel, getStatusColor } = useDemandaStatus();
  const [recentesDias, setRecentesDias] = useState<RecentesDias>(7);

  const todayStr = new Date().toISOString().split("T")[0];

  // ── KPIs ────────────────────────────────────────────────────
  const { data: kpiData, isLoading: isLoadingKpis } = useQuery({
    queryKey: ["rep-dashboard-kpis", uid, todayStr, finalSlugs],
    enabled: !!uid && statusList.length > 0,
    queryFn: async () => {
      const closedFilter = finalSlugs.length > 0
        ? `(${finalSlugs.join(",")})` : "(__never__)";

      const [totalRes, abertasRes, atrasoRes, concluidasRes, municRes] = await Promise.all([
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .eq("representante_id", uid!),
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .eq("representante_id", uid!)
          .not("status", "in", closedFilter),
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .eq("representante_id", uid!)
          .lt("data_prazo", todayStr)
          .not("status", "in", closedFilter),
        finalSlugs.length > 0
          ? supabase.from("demandas").select("id", { count: "exact", head: true })
              .eq("representante_id", uid!).in("status", finalSlugs)
          : Promise.resolve({ count: 0, error: null }),
        supabase.from("municipes").select("id", { count: "exact", head: true })
          .eq("representante_id", uid!),
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
    staleTime: 30000,
  });

  // ── Chart data (status, áreas, humor, prioridade) ───────────
  const { data: chartDemandas = [], isLoading: isLoadingCharts } = useQuery({
    queryKey: ["rep-dashboard-chart-data", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("status, humor, area_id, prioridade, areas(nome)")
        .eq("representante_id", uid!);
      if (error) { logError("Rep dashboard chart data:", error); throw error; }
      return data || [];
    },
    staleTime: 30000,
  });

  // ── Demandas recentes ────────────────────────────────────────
  const { data: recentesData = [], isLoading: isLoadingRecentes } = useQuery({
    queryKey: ["rep-dashboard-recentes", uid, recentesDias],
    enabled: !!uid,
    queryFn: async () => {
      const since = new Date(Date.now() - recentesDias * 86400000).toISOString();
      const { data, error } = await supabase
        .from("demandas")
        .select("id, titulo, protocolo, status, created_at, areas(nome), municipes(nome)")
        .eq("representante_id", uid!)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) { logError("Rep dashboard recentes:", error); throw error; }
      return data || [];
    },
    staleTime: 30000,
  });

  // ── Aniversariantes dos munícipes do representante ───────────
  const { data: aniversariantesRaw = [], isLoading: isLoadingAniversarios } = useQuery({
    queryKey: ["rep-dashboard-aniversarios", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipes")
        .select("id, nome, telefone, bairro, cidade, data_nascimento")
        .eq("representante_id", uid!)
        .not("data_nascimento", "is", null);
      if (error) { logError("Rep dashboard aniversarios:", error); throw error; }
      return data || [];
    },
    staleTime: 60000,
  });

  // Filtrar aniversariantes por hoje
  const hoje = new Date();
  const mesHoje = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();
  const aniversariantesData = aniversariantesRaw.filter((m: any) => {
    if (!m.data_nascimento) return false;
    const [, mesNasc, diaNasc] = m.data_nascimento.split("-").map(Number);
    return mesNasc === mesHoje && diaNasc === diaHoje;
  });

  // ═══════════════════════════════════════════════════════════
  //  COMPUTED METRICS (mesma lógica do useDashboardData)
  // ═══════════════════════════════════════════════════════════

  const kpis = kpiData || {
    totalDemandas: 0, demandasAbertas: 0, demandasEmAtraso: 0,
    totalMunicipes: 0, taxaConclusao: 0,
  };

  // Humorômetro
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

  // Funil
  const statusCountMap: Record<string, number> = {};
  chartDemandas.forEach((d: any) => {
    const s = d.status || "solicitada";
    statusCountMap[s] = (statusCountMap[s] || 0) + 1;
  });
  const funilData = statusList.map(s => ({
    name: s.nome, slug: s.slug,
    value: statusCountMap[s.slug] || 0,
    color: s.cor, is_final: s.is_final,
  }));

  // Prioridades
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
      value: prioridadeMap[slug] || 0, order: cfg.order,
    }))
    .sort((a, b) => a.order - b.order);

  // Top 5 Áreas × Status
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

  // Demandas recentes formatadas
  const demandasRecentes = recentesData.map((d: any) => ({
    id: d.id, titulo: d.titulo, protocolo: d.protocolo, status: d.status,
    area: d.areas?.nome || "Sem área", municipe: d.municipes?.nome || "Sem munícipe",
    created_at: d.created_at,
  }));

  return {
    isLoading: isLoadingKpis || isLoadingCharts || isLoadingRecentes || isLoadingAniversarios,
    kpis,
    recentesDias, setRecentesDias,
    humor: {
      media: humorMedia, mediaSlug: humorMediaSlug,
      emoji: humorEmojis[humorMediaSlug] || "😐",
      total: demandasComHumor.length, distribuicao: humorDistribuicao,
    },
    charts: { funilData, prioridadeData, top5Areas, uniqueStatuses },
    recentes: demandasRecentes,
    aniversariantes: aniversariantesData,
    getStatusLabel, getStatusColor, statusList,
  };
}
