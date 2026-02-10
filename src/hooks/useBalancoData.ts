import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

// ========== Types ==========
export interface BalancoFilters {
  dateFrom: string;
  dateTo: string;
  areaId: string;
  responsavelId: string;
  cidadeFilter: string;
}

export type TemporalGranularity = "mensal" | "trimestral" | "semestral" | "anual";

// ========== Constants ==========
export const ORIGEM_LABELS: Record<string, string> = {
  whatsapp_mandato: "WhatsApp Mandato",
  whatsapp_assessoria: "WhatsApp Assessoria",
  whatsapp_parlamentar: "WhatsApp Parlamentar",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "Tiktok",
  gabinete: "Gabinete",
  em_agenda: "Em Agenda",
  outro: "Outro",
};

export const HUMOR_LABELS: Record<string, string> = {
  muito_insatisfeito: "Muito Insatisfeito",
  insatisfeito: "Insatisfeito",
  neutro: "Neutro",
  satisfeito: "Satisfeito",
  muito_satisfeito: "Muito Satisfeito",
};

export const HUMOR_VALUES: Record<string, number> = {
  muito_insatisfeito: 1,
  insatisfeito: 2,
  neutro: 3,
  satisfeito: 4,
  muito_satisfeito: 5,
};

export const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "#22c55e",
  media: "#eab308",
  alta: "#f97316",
  urgente: "#ef4444",
};

// ========== Temporal Helpers ==========
function getTemporalKey(date: Date, granularity: TemporalGranularity): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  switch (granularity) {
    case "mensal":
      return `${year}-${String(month + 1).padStart(2, "0")}`;
    case "trimestral":
      return `${year}-T${Math.floor(month / 3) + 1}`;
    case "semestral":
      return `${year}-S${Math.floor(month / 6) + 1}`;
    case "anual":
      return `${year}`;
  }
}

function formatTemporalKey(key: string, granularity: TemporalGranularity): string {
  switch (granularity) {
    case "mensal": {
      const [year, month] = key.split("-");
      return `${month}/${year}`;
    }
    case "trimestral": {
      const [year, q] = key.split("-");
      return `${q}/${year}`;
    }
    case "semestral": {
      const [year, s] = key.split("-");
      return `${s}/${year}`;
    }
    case "anual":
      return key;
  }
}

export function suggestGranularity(demandas: any[]): TemporalGranularity {
  if (demandas.length === 0) return "mensal";
  const dates = demandas.filter((d: any) => d.created_at).map((d: any) => new Date(d.created_at).getTime());
  if (dates.length === 0) return "mensal";
  const months = Math.round((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.44));
  if (months <= 12) return "mensal";
  if (months <= 36) return "trimestral";
  if (months <= 72) return "semestral";
  return "anual";
}

// ========== Main Hook ==========
export function useBalancoData(filters: BalancoFilters, granularity: TemporalGranularity) {
  const { statusList, getStatusLabel, getStatusColor } = useDemandaStatus();

  const { data: rawDemandas = [], isLoading } = useQuery({
    queryKey: ["balanco-demandas"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const size = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("demandas")
          .select(`*, areas(nome), municipes(nome)`)
          .order("created_at", { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          all = [...all, ...data];
          hasMore = data.length === size;
          from += size;
        } else {
          hasMore = false;
        }
      }
      return all;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["balanco-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["balanco-responsaveis"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").order("nome");
      return data || [];
    },
  });

  const cidades = useMemo(() => {
    const set = new Set<string>();
    rawDemandas.forEach((d: any) => { if (d.cidade) set.add(d.cidade); });
    return Array.from(set).sort();
  }, [rawDemandas]);

  // Apply global filters
  const demandas = useMemo(() => {
    return rawDemandas.filter((d: any) => {
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(d.created_at) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(d.created_at) > to) return false;
      }
      if (filters.areaId !== "all" && d.area_id !== filters.areaId) return false;
      if (filters.responsavelId !== "all" && d.responsavel_id !== filters.responsavelId) return false;
      if (filters.cidadeFilter !== "all" && d.cidade !== filters.cidadeFilter) return false;
      return true;
    });
  }, [rawDemandas, filters]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const total = demandas.length;
    const atendidas = demandas.filter((d: any) => d.status === "atendido").length;
    const taxaConclusao = total > 0 ? Math.round((atendidas / total) * 100) : 0;

    const atendidasComDatas = demandas.filter((d: any) => d.status === "atendido" && d.created_at && d.updated_at);
    let tempoMedio = 0;
    if (atendidasComDatas.length > 0) {
      const totalDias = atendidasComDatas.reduce((acc: number, d: any) => {
        return acc + Math.max(Math.floor((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)), 0);
      }, 0);
      tempoMedio = Math.round(totalDias / atendidasComDatas.length);
    }

    const hoje = new Date();
    const emAtraso = demandas.filter((d: any) => {
      if (!d.data_prazo || d.status === "atendido" || d.status === "devolvido") return false;
      return hoje > new Date(d.data_prazo);
    }).length;
    const percAtraso = total > 0 ? Math.round((emAtraso / total) * 100) : 0;

    const comHumor = demandas.filter((d: any) => d.humor && HUMOR_VALUES[d.humor]);
    let humorMedio = 0;
    let humorEmoji = "😶";
    if (comHumor.length > 0) {
      const somaHumor = comHumor.reduce((acc: number, d: any) => acc + (HUMOR_VALUES[d.humor] || 0), 0);
      humorMedio = somaHumor / comHumor.length;
      if (humorMedio <= 1.5) humorEmoji = "😡";
      else if (humorMedio <= 2.5) humorEmoji = "😞";
      else if (humorMedio <= 3.5) humorEmoji = "😐";
      else if (humorMedio <= 4.5) humorEmoji = "😊";
      else humorEmoji = "😍";
    }

    const origemCount: Record<string, number> = {};
    demandas.forEach((d: any) => { if (d.origem) origemCount[d.origem] = (origemCount[d.origem] || 0) + 1; });
    const origemMaisFreq = Object.entries(origemCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      total, atendidas, taxaConclusao, tempoMedio, emAtraso, percAtraso,
      humorMedio: Math.round(humorMedio * 10) / 10, humorEmoji,
      totalComHumor: comHumor.length,
      origemMaisFreq: origemMaisFreq ? ORIGEM_LABELS[origemMaisFreq] || origemMaisFreq : "—",
    };
  }, [demandas]);

  // ===== Evolução Temporal =====
  const evolucaoData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      if (!d.created_at) return;
      const key = getTemporalKey(new Date(d.created_at), granularity);
      if (!map[key]) map[key] = { total: 0 };
      map[key].total++;
      const st = d.status || "solicitada";
      map[key][st] = (map[key][st] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({ periodo: formatTemporalKey(key, granularity), ...counts }));
  }, [demandas, granularity]);

  // ===== Humor Evolução =====
  const humorEvolucaoData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor] || !d.created_at) return;
      const key = getTemporalKey(new Date(d.created_at), granularity);
      if (!map[key]) map[key] = { soma: 0, count: 0 };
      map[key].soma += HUMOR_VALUES[d.humor];
      map[key].count++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        periodo: formatTemporalKey(key, granularity),
        media: Math.round((data.soma / data.count) * 10) / 10,
        avaliacoes: data.count,
      }));
  }, [demandas, granularity]);

  // ===== Origem =====
  const origemData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => { map[d.origem || "nao_informado"] = (map[d.origem || "nao_informado"] || 0) + 1; });
    const sorted = Object.entries(map)
      .map(([key, value]) => ({ name: ORIGEM_LABELS[key] || "Não informado", value, slug: key }))
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((acc, i) => acc + i.value, 0);
    const threshold = total * 0.03;
    const main: typeof sorted = [];
    let outrosValue = 0;
    sorted.forEach((item) => {
      if (item.value < threshold && item.slug !== "nao_informado") outrosValue += item.value;
      else main.push(item);
    });
    if (outrosValue > 0) main.push({ name: "Outros (<3%)", value: outrosValue, slug: "_outros" });
    return main;
  }, [demandas]);

  // ===== Bairros =====
  const bairroDataFull = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => { if (d.bairro) map[d.bairro] = (map[d.bairro] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [demandas]);

  // ===== Área × Status =====
  const areaStatusDataFull = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      const areaName = d.areas?.nome || "Sem área";
      if (!map[areaName]) map[areaName] = {};
      const st = d.status || "solicitada";
      map[areaName][st] = (map[areaName][st] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, counts]) => ({ name, total: Object.values(counts).reduce((a, b) => a + b, 0), ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [demandas]);

  // ===== Responsáveis =====
  const responsavelDataFull = useMemo(() => {
    const map: Record<string, { total: number; atendidas: number; tempoTotal: number; tempoCount: number; statusMap: Record<string, number> }> = {};
    demandas.forEach((d: any) => {
      const respNome = responsaveis.find((r: any) => r.id === d.responsavel_id)?.nome || "Não atribuído";
      if (!map[respNome]) map[respNome] = { total: 0, atendidas: 0, tempoTotal: 0, tempoCount: 0, statusMap: {} };
      map[respNome].total++;
      const st = d.status || "solicitada";
      map[respNome].statusMap[st] = (map[respNome].statusMap[st] || 0) + 1;
      if (d.status === "atendido") {
        map[respNome].atendidas++;
        if (d.created_at && d.updated_at) {
          const dias = Math.max(Math.floor((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)), 0);
          map[respNome].tempoTotal += dias;
          map[respNome].tempoCount++;
        }
      }
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name, total: data.total, atendidas: data.atendidas,
        pendentes: data.total - data.atendidas,
        taxa: data.total > 0 ? Math.round((data.atendidas / data.total) * 100) : 0,
        tempoMedio: data.tempoCount > 0 ? Math.round(data.tempoTotal / data.tempoCount) : 0,
        ...data.statusMap,
      }))
      .sort((a, b) => b.total - a.total);
  }, [demandas, responsaveis]);

  // ===== Prioridade =====
  const prioridadeData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => { map[d.prioridade || "media"] = (map[d.prioridade || "media"] || 0) + 1; });
    return Object.entries(map).map(([key, value]) => ({
      name: PRIORIDADE_LABELS[key] || key, value, slug: key, color: PRIORIDADE_COLORS[key] || "#6b7280",
    }));
  }, [demandas]);

  const prioridadeStatusData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      const prio = PRIORIDADE_LABELS[d.prioridade] || d.prioridade || "Média";
      if (!map[prio]) map[prio] = {};
      map[prio][d.status || "solicitada"] = (map[prio][d.status || "solicitada"] || 0) + 1;
    });
    return Object.entries(map).map(([name, counts]) => ({ name, ...counts }));
  }, [demandas]);

  // ===== Atrasos =====
  const atrasoDistribuicao = useMemo(() => {
    const faixas = [
      { label: "Sem atraso", min: -Infinity, max: 0, count: 0, color: "#22c55e" },
      { label: "1-15 dias", min: 1, max: 15, count: 0, color: "#eab308" },
      { label: "16-30 dias", min: 16, max: 30, count: 0, color: "#f97316" },
      { label: "31-60 dias", min: 31, max: 60, count: 0, color: "#ef4444" },
      { label: "61-90 dias", min: 61, max: 90, count: 0, color: "#dc2626" },
      { label: "90+ dias", min: 91, max: Infinity, count: 0, color: "#991b1b" },
    ];
    const hoje = new Date();
    demandas.forEach((d: any) => {
      if (!d.data_prazo || d.status === "atendido" || d.status === "devolvido") return;
      const dias = Math.floor((hoje.getTime() - new Date(d.data_prazo).getTime()) / (1000 * 60 * 60 * 24));
      for (const f of faixas) { if (dias >= f.min && dias <= f.max) { f.count++; break; } }
    });
    return faixas.map((f) => ({ name: f.label, value: f.count, color: f.color }));
  }, [demandas]);

  const atrasoPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    const hoje = new Date();
    demandas.forEach((d: any) => {
      if (!d.data_prazo || d.status === "atendido" || d.status === "devolvido") return;
      if (hoje <= new Date(d.data_prazo)) return;
      map[d.areas?.nome || "Sem área"] = (map[d.areas?.nome || "Sem área"] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [demandas]);

  // ===== Funil =====
  const funilData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => { map[d.status || "solicitada"] = (map[d.status || "solicitada"] || 0) + 1; });
    return statusList.map((s) => ({ name: s.nome, slug: s.slug, value: map[s.slug] || 0, color: s.cor })).filter((s) => s.value > 0);
  }, [demandas, statusList]);

  // ===== Top Munícipes =====
  const topMunicipes = useMemo(() => {
    const map: Record<string, { nome: string; total: number; humores: number[] }> = {};
    demandas.forEach((d: any) => {
      const id = d.municipe_id || "unknown";
      if (!map[id]) map[id] = { nome: d.municipes?.nome || "Desconhecido", total: 0, humores: [] };
      map[id].total++;
      if (d.humor && HUMOR_VALUES[d.humor]) map[id].humores.push(HUMOR_VALUES[d.humor]);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 15)
      .map((m) => ({
        name: m.nome, total: m.total,
        humorMedio: m.humores.length > 0 ? Math.round((m.humores.reduce((a, b) => a + b, 0) / m.humores.length) * 10) / 10 : null,
      }));
  }, [demandas]);

  // ===== Humor × Área =====
  const humorAreaData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor]) return;
      const a = d.areas?.nome || "Sem área";
      if (!map[a]) map[a] = { soma: 0, count: 0 };
      map[a].soma += HUMOR_VALUES[d.humor]; map[a].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, media: Math.round((data.soma / data.count) * 10) / 10, avaliacoes: data.count }))
      .sort((a, b) => a.media - b.media);
  }, [demandas]);

  // ===== Humor × Origem =====
  const humorOrigemData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor] || !d.origem) return;
      const label = ORIGEM_LABELS[d.origem] || d.origem;
      if (!map[label]) map[label] = { soma: 0, count: 0 };
      map[label].soma += HUMOR_VALUES[d.humor]; map[label].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, media: Math.round((data.soma / data.count) * 10) / 10, avaliacoes: data.count }))
      .sort((a, b) => b.media - a.media);
  }, [demandas]);

  // ===== CSV =====
  const csvData = useMemo(() => {
    return demandas.map((d: any) => ({
      protocolo: d.protocolo || "", titulo: d.titulo || "",
      status: getStatusLabel(d.status), prioridade: PRIORIDADE_LABELS[d.prioridade] || d.prioridade || "",
      area: d.areas?.nome || "", municipe: d.municipes?.nome || "",
      responsavel: responsaveis.find((r: any) => r.id === d.responsavel_id)?.nome || "",
      origem: d.origem ? (ORIGEM_LABELS[d.origem] || d.origem) : "",
      humor: d.humor ? (HUMOR_LABELS[d.humor] || d.humor) : "",
      bairro: d.bairro || "", cidade: d.cidade || "",
      data_criacao: d.created_at ? new Date(d.created_at).toLocaleDateString("pt-BR") : "",
      data_prazo: d.data_prazo || "",
    }));
  }, [demandas, responsaveis, getStatusLabel]);

  return {
    isLoading, demandas, areas, responsaveis, cidades,
    statusList, getStatusLabel, getStatusColor,
    kpis, evolucaoData, humorEvolucaoData,
    origemData, bairroDataFull, areaStatusDataFull,
    responsavelDataFull, prioridadeData, prioridadeStatusData,
    atrasoDistribuicao, atrasoPorArea,
    funilData, topMunicipes, humorAreaData, humorOrigemData, csvData,
  };
}
