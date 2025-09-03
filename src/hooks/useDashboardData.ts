import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardData() {
  const { data: demandas = [], isLoading: isLoadingDemandas } = useQuery({
    queryKey: ['demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          profiles!demandas_responsavel_id_fkey(nome),
          municipes(nome)
        `);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: municipes = [], isLoading: isLoadingMunicipes } = useQuery({
    queryKey: ['municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  // Calcular métricas
  const totalDemandas = demandas.length;
  const demandasAtivas = demandas.filter(d => 
    d.status === 'aberta' || d.status === 'em_andamento'
  ).length;
  const totalMunicipes = municipes.length;
  const taxaConclusao = totalDemandas > 0 
    ? Math.round((demandas.filter(d => d.status === 'concluida').length / totalDemandas) * 100)
    : 0;

  // Dados para gráfico de status
  const statusData = [
    { name: "Aberta", value: demandas.filter(d => d.status === 'aberta').length, color: "#3b82f6" },
    { name: "Em Andamento", value: demandas.filter(d => d.status === 'em_andamento').length, color: "#f59e0b" },
    { name: "Concluída", value: demandas.filter(d => d.status === 'concluida').length, color: "#10b981" },
    { name: "Não Atendida", value: demandas.filter(d => d.status === 'nao_atendida').length, color: "#ef4444" },
    { name: "Arquivada", value: demandas.filter(d => d.status === 'arquivada').length, color: "#6b7280" },
  ];

  // Dados para gráfico de áreas
  const areaData = demandas.reduce((acc, demanda) => {
    const areaName = demanda.areas?.nome || 'Sem área';
    acc[areaName] = (acc[areaName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const areaChartData = Object.entries(areaData).map(([name, value]) => ({
    name,
    value: value as number
  }));

  // Calcular dias desde criação e separar por faixas
  const now = new Date();
  const demandasComIdade = demandas.map(demanda => {
    const createdAt = new Date(demanda.created_at || '');
    const diasVencido = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      area: demanda.areas?.nome || 'Sem área',
      responsavel: demanda.profiles?.nome || 'Sem responsável',
      diasVencido
    };
  });

  const demandas30Dias = demandasComIdade.filter(d => d.diasVencido >= 30 && d.diasVencido < 60);
  const demandas60Dias = demandasComIdade.filter(d => d.diasVencido >= 60 && d.diasVencido < 90);
  const demandas90Dias = demandasComIdade.filter(d => d.diasVencido >= 90);

  return {
    metrics: {
      totalDemandas,
      demandasAtivas,
      totalMunicipes,
      taxaConclusao: `${taxaConclusao}%`
    },
    charts: {
      statusData,
      areaChartData
    },
    aging: {
      demandas30Dias,
      demandas60Dias,
      demandas90Dias
    },
    isLoading: isLoadingDemandas || isLoadingMunicipes
  };
}