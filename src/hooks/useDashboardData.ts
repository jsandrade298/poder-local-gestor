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
          municipes(nome)
        `);
      
      if (error) {
        console.error('Erro ao buscar demandas:', error);
        throw error;
      }
      return data || [];
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
    ? Math.round((demandas.filter(d => d.status === 'resolvida').length / totalDemandas) * 100)
    : 0;

  // Dados para gráfico de status
  const statusData = [
    { name: "Aberta", value: demandas.filter(d => d.status === 'aberta').length, color: "#3b82f6" },
    { name: "Em Andamento", value: demandas.filter(d => d.status === 'em_andamento').length, color: "#f59e0b" },
    { name: "Aguardando", value: demandas.filter(d => d.status === 'aguardando').length, color: "#8b5cf6" },
    { name: "Resolvida", value: demandas.filter(d => d.status === 'resolvida').length, color: "#10b981" },
    { name: "Cancelada", value: demandas.filter(d => d.status === 'cancelada').length, color: "#ef4444" },
  ];

  // Dados para gráfico de áreas com divisão por status
  const areaStatusData = demandas.reduce((acc, demanda) => {
    const areaName = demanda.areas?.nome || 'Sem área';
    const status = demanda.status || 'aberta';
    
    if (!acc[areaName]) {
      acc[areaName] = {
        name: areaName,
        aberta: 0,
        em_andamento: 0,
        aguardando: 0,
        resolvida: 0,
        cancelada: 0,
        total: 0
      };
    }
    
    acc[areaName][status] = (acc[areaName][status] || 0) + 1;
    acc[areaName].total += 1;
    
    return acc;
  }, {} as Record<string, any>);

  const areaChartData = Object.values(areaStatusData) as Array<{
    name: string;
    aberta: number;
    em_andamento: number;
    aguardando: number;
    resolvida: number;
    cancelada: number;
    total: number;
  }>;

  // Calcular dias desde criação e separar por faixas
  const now = new Date();
  const demandasComIdade = demandas.map(demanda => {
    const createdAt = new Date(demanda.created_at || '');
    const diasVencido = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      area: demanda.areas?.nome || 'Sem área',
      responsavel: 'Sem responsável', // Temporariamente removido até resolver foreign key
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