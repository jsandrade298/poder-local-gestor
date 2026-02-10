import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

export interface BalancoFilters {
  dateFrom: string;
  dateTo: string;
  areaId: string;
  responsavelId: string;
  cidadeFilter: string;
}

const ORIGEM_LABELS: Record<string, string> = {
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

const HUMOR_LABELS: Record<string, string> = {
  muito_insatisfeito: "Muito Insatisfeito",
  insatisfeito: "Insatisfeito",
  neutro: "Neutro",
  satisfeito: "Satisfeito",
  muito_satisfeito: "Muito Satisfeito",
};

const HUMOR_VALUES: Record<string, number> = {
  muito_insatisfeito: 1,
  insatisfeito: 2,
  neutro: 3,
  satisfeito: 4,
  muito_satisfeito: 5,
};

const HUMOR_COLORS: Record<string, string> = {
  muito_insatisfeito: "#ef4444",
  insatisfeito: "#f97316",
  neutro: "#eab308",
  satisfeito: "#84cc16",
  muito_satisfeito: "#22c55e",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "#22c55e",
  media: "#eab308",
  alta: "#f97316",
  urgente: "#ef4444",
};

export function useBalancoData(filters: BalancoFilters) {
  const { statusList, getStatusLabel, getStatusColor } = useDemandaStatus();

  // Fetch all demandas
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

  // Fetch areas
  const { data: areas = [] } = useQuery({
    queryKey: ["balanco-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("id, nome").order("nome");
      return data || [];
    },
  });

  // Fetch responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["balanco-responsaveis"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").order("nome");
      return data || [];
    },
  });

  // Fetch cidades
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

  // ========== KPIs ==========
  const kpis = useMemo(() => {
    const total = demandas.length;
    const atendidas = demandas.filter((d: any) => d.status === "atendido").length;
    const taxaConclusao = total > 0 ? Math.round((atendidas / total) * 100) : 0;

    // Tempo médio de resolução (created_at -> updated_at para atendidas)
    const atendidasComDatas = demandas.filter(
      (d: any) => d.status === "atendido" && d.created_at && d.updated_at
    );
    let tempoMedio = 0;
    if (atendidasComDatas.length > 0) {
      const totalDias = atendidasComDatas.reduce((acc: number, d: any) => {
        const dias = Math.floor(
          (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return acc + Math.max(dias, 0);
      }, 0);
      tempoMedio = Math.round(totalDias / atendidasComDatas.length);
    }

    // Atraso
    const hoje = new Date();
    const emAtraso = demandas.filter((d: any) => {
      if (!d.data_prazo || d.status === "atendido" || d.status === "devolvido") return false;
      return hoje > new Date(d.data_prazo);
    }).length;
    const percAtraso = total > 0 ? Math.round((emAtraso / total) * 100) : 0;

    // Humor médio
    const comHumor = demandas.filter((d: any) => d.humor && HUMOR_VALUES[d.humor]);
    let humorMedio = 0;
    let humorEmoji = "😶";
    if (comHumor.length > 0) {
      const somaHumor = comHumor.reduce(
        (acc: number, d: any) => acc + (HUMOR_VALUES[d.humor] || 0),
        0
      );
      humorMedio = somaHumor / comHumor.length;
      if (humorMedio <= 1.5) humorEmoji = "😡";
      else if (humorMedio <= 2.5) humorEmoji = "😞";
      else if (humorMedio <= 3.5) humorEmoji = "😐";
      else if (humorMedio <= 4.5) humorEmoji = "😊";
      else humorEmoji = "😍";
    }

    // Origem mais frequente
    const origemCount: Record<string, number> = {};
    demandas.forEach((d: any) => {
      if (d.origem) origemCount[d.origem] = (origemCount[d.origem] || 0) + 1;
    });
    const origemMaisFreq =
      Object.entries(origemCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      total,
      atendidas,
      taxaConclusao,
      tempoMedio,
      emAtraso,
      percAtraso,
      humorMedio: Math.round(humorMedio * 10) / 10,
      humorEmoji,
      totalComHumor: comHumor.length,
      origemMaisFreq: origemMaisFreq ? ORIGEM_LABELS[origemMaisFreq] || origemMaisFreq : "—",
    };
  }, [demandas]);

  // ========== Charts Data ==========

  // Origem (donut)
  const origemData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => {
      const key = d.origem || "nao_informado";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([key, value]) => ({
        name: ORIGEM_LABELS[key] || "Não informado",
        value,
        slug: key,
      }))
      .sort((a, b) => b.value - a.value);
  }, [demandas]);

  // Evolução temporal (mensal)
  const evolucaoData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      const date = new Date(d.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { total: 0 };
      map[key].total = (map[key].total || 0) + 1;
      const st = d.status || "solicitada";
      map[key][st] = (map[key][st] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => {
        const [year, month] = key.split("-");
        return {
          mes: `${month}/${year}`,
          ...counts,
        };
      });
  }, [demandas]);

  // Demandas por bairro (top 15)
  const bairroData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => {
      if (d.bairro) map[d.bairro] = (map[d.bairro] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ name, value }));
  }, [demandas]);

  // Demandas por área × status
  const areaStatusData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      const areaName = d.areas?.nome || "Sem área";
      if (!map[areaName]) map[areaName] = {};
      const st = d.status || "solicitada";
      map[areaName][st] = (map[areaName][st] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, counts]) => ({
        name,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        ...counts,
      }))
      .sort((a, b) => b.total - a.total);
  }, [demandas]);

  // Desempenho por responsável
  const responsavelData = useMemo(() => {
    const map: Record<string, { total: number; atendidas: number; tempoTotal: number; tempoCount: number }> = {};
    demandas.forEach((d: any) => {
      const respNome = responsaveis.find((r: any) => r.id === d.responsavel_id)?.nome || "Não atribuído";
      if (!map[respNome]) map[respNome] = { total: 0, atendidas: 0, tempoTotal: 0, tempoCount: 0 };
      map[respNome].total++;
      if (d.status === "atendido") {
        map[respNome].atendidas++;
        if (d.created_at && d.updated_at) {
          const dias = Math.floor(
            (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          map[respNome].tempoTotal += Math.max(dias, 0);
          map[respNome].tempoCount++;
        }
      }
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        total: data.total,
        atendidas: data.atendidas,
        pendentes: data.total - data.atendidas,
        taxa: data.total > 0 ? Math.round((data.atendidas / data.total) * 100) : 0,
        tempoMedio: data.tempoCount > 0 ? Math.round(data.tempoTotal / data.tempoCount) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [demandas, responsaveis]);

  // Prioridade (donut)
  const prioridadeData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => {
      const key = d.prioridade || "media";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: PRIORIDADE_LABELS[key] || key,
      value,
      slug: key,
      color: PRIORIDADE_COLORS[key] || "#6b7280",
    }));
  }, [demandas]);

  // Prioridade × Status (cruzamento)
  const prioridadeStatusData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    demandas.forEach((d: any) => {
      const prio = PRIORIDADE_LABELS[d.prioridade] || d.prioridade || "Média";
      if (!map[prio]) map[prio] = {};
      const st = d.status || "solicitada";
      map[prio][st] = (map[prio][st] || 0) + 1;
    });
    return Object.entries(map).map(([name, counts]) => ({
      name,
      ...counts,
    }));
  }, [demandas]);

  // Humor evolução temporal
  const humorEvolucaoData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor]) return;
      const date = new Date(d.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { soma: 0, count: 0 };
      map[key].soma += HUMOR_VALUES[d.humor];
      map[key].count++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        return {
          mes: `${month}/${year}`,
          media: Math.round((data.soma / data.count) * 10) / 10,
          avaliacoes: data.count,
        };
      });
  }, [demandas]);

  // Humor × Área
  const humorAreaData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor]) return;
      const areaName = d.areas?.nome || "Sem área";
      if (!map[areaName]) map[areaName] = { soma: 0, count: 0 };
      map[areaName].soma += HUMOR_VALUES[d.humor];
      map[areaName].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        media: Math.round((data.soma / data.count) * 10) / 10,
        avaliacoes: data.count,
      }))
      .sort((a, b) => a.media - b.media); // piores primeiro
  }, [demandas]);

  // Atraso: faixas de distribuição
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
      const prazo = new Date(d.data_prazo);
      const dias = Math.floor((hoje.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
      for (const faixa of faixas) {
        if (dias >= faixa.min && dias <= faixa.max) {
          faixa.count++;
          break;
        }
      }
    });
    return faixas.map((f) => ({ name: f.label, value: f.count, color: f.color }));
  }, [demandas]);

  // Atraso por área
  const atrasoPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    const hoje = new Date();
    demandas.forEach((d: any) => {
      if (!d.data_prazo || d.status === "atendido" || d.status === "devolvido") return;
      if (hoje <= new Date(d.data_prazo)) return;
      const areaName = d.areas?.nome || "Sem área";
      map[areaName] = (map[areaName] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [demandas]);

  // Funil de status
  const funilData = useMemo(() => {
    const map: Record<string, number> = {};
    demandas.forEach((d: any) => {
      const st = d.status || "solicitada";
      map[st] = (map[st] || 0) + 1;
    });
    return statusList
      .map((s) => ({
        name: s.nome,
        slug: s.slug,
        value: map[s.slug] || 0,
        color: s.cor,
      }))
      .filter((s) => s.value > 0 || statusList.some((sl) => sl.slug === s.slug));
  }, [demandas, statusList]);

  // Top munícipes
  const topMunicipes = useMemo(() => {
    const map: Record<string, { nome: string; total: number; humores: number[] }> = {};
    demandas.forEach((d: any) => {
      const nome = d.municipes?.nome || "Desconhecido";
      const id = d.municipe_id || "unknown";
      if (!map[id]) map[id] = { nome, total: 0, humores: [] };
      map[id].total++;
      if (d.humor && HUMOR_VALUES[d.humor]) map[id].humores.push(HUMOR_VALUES[d.humor]);
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((m) => ({
        name: m.nome,
        total: m.total,
        humorMedio:
          m.humores.length > 0
            ? Math.round((m.humores.reduce((a, b) => a + b, 0) / m.humores.length) * 10) / 10
            : null,
      }));
  }, [demandas]);

  // Humor × Origem
  const humorOrigemData = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    demandas.forEach((d: any) => {
      if (!d.humor || !HUMOR_VALUES[d.humor] || !d.origem) return;
      const label = ORIGEM_LABELS[d.origem] || d.origem;
      if (!map[label]) map[label] = { soma: 0, count: 0 };
      map[label].soma += HUMOR_VALUES[d.humor];
      map[label].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        media: Math.round((data.soma / data.count) * 10) / 10,
        avaliacoes: data.count,
      }))
      .sort((a, b) => b.media - a.media);
  }, [demandas]);

  // Dados para CSV export
  const csvData = useMemo(() => {
    return demandas.map((d: any) => ({
      protocolo: d.protocolo || "",
      titulo: d.titulo || "",
      status: getStatusLabel(d.status),
      prioridade: PRIORIDADE_LABELS[d.prioridade] || d.prioridade || "",
      area: d.areas?.nome || "",
      municipe: d.municipes?.nome || "",
      responsavel: responsaveis.find((r: any) => r.id === d.responsavel_id)?.nome || "",
      origem: d.origem ? (ORIGEM_LABELS[d.origem] || d.origem) : "",
      humor: d.humor ? (HUMOR_LABELS[d.humor] || d.humor) : "",
      bairro: d.bairro || "",
      cidade: d.cidade || "",
      data_criacao: d.created_at ? new Date(d.created_at).toLocaleDateString("pt-BR") : "",
      data_prazo: d.data_prazo || "",
    }));
  }, [demandas, responsaveis, getStatusLabel]);

  return {
    isLoading,
    demandas,
    areas,
    responsaveis,
    cidades,
    statusList,
    getStatusLabel,
    getStatusColor,
    kpis,
    origemData,
    evolucaoData,
    bairroData,
    areaStatusData,
    responsavelData,
    prioridadeData,
    prioridadeStatusData,
    humorEvolucaoData,
    humorAreaData,
    atrasoDistribuicao,
    atrasoPorArea,
    funilData,
    topMunicipes,
    humorOrigemData,
    csvData,
    ORIGEM_LABELS,
    HUMOR_LABELS,
    PRIORIDADE_LABELS,
    PRIORIDADE_COLORS,
    HUMOR_COLORS,
  };
}
