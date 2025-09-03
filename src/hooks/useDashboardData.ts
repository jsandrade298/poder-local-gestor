import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from 'date-fns-tz';

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
  const demandasAbertas = demandas.filter(d => d.status === 'aberta').length;
  const demandasEmAndamento = demandas.filter(d => d.status === 'em_andamento').length;
  const demandasAguardando = demandas.filter(d => d.status === 'aguardando').length;
  const demandasResolvidas = demandas.filter(d => d.status === 'resolvida').length;
  const demandasCanceladas = demandas.filter(d => d.status === 'cancelada').length;
  const totalMunicipes = municipes.length;
  const taxaConclusao = totalDemandas > 0 
    ? Math.round((demandasResolvidas / totalDemandas) * 100)
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


  // Calcular demandas em atraso (com base no campo data_prazo)
  const today = new Date('2025-09-03'); // Data atual para teste
  const demandasComAtraso = demandas.filter(demanda => {
    if (!demanda.data_prazo || demanda.status === 'resolvida' || demanda.status === 'cancelada') {
      return false;
    }
    const prazo = new Date(demanda.data_prazo);
    return today > prazo;
  });

  const demandasAtraso30Dias = demandasComAtraso.filter(demanda => {
    const prazo = new Date(demanda.data_prazo);
    const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
    return diasAtraso > 30;
  });

  const demandasAtraso60Dias = demandasComAtraso.filter(demanda => {
    const prazo = new Date(demanda.data_prazo);
    const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
    return diasAtraso > 60;
  });

  const demandasAtraso90Dias = demandasComAtraso.filter(demanda => {
    const prazo = new Date(demanda.data_prazo);
    const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
    return diasAtraso > 90;
  });

  // Preparar dados das demandas em atraso para exibição
  const demandasAtrasoDetalhadas = demandasComAtraso.map(demanda => {
    const prazo = new Date(demanda.data_prazo);
    const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      protocolo: demanda.protocolo,
      area: demanda.areas?.nome || 'Sem área',
      cidade: demanda.cidade,
      bairro: demanda.bairro,
      data_prazo: formatInTimeZone(new Date(demanda.data_prazo), 'America/Sao_Paulo', 'dd/MM/yyyy'),
      diasAtraso,
      status: demanda.status
    };
  }).sort((a, b) => b.diasAtraso - a.diasAtraso); // Ordenar por dias de atraso (maior primeiro)

  return {
    metrics: {
      totalDemandas,
      demandasAbertas,
      demandasEmAndamento,
      demandasAguardando,
      demandasResolvidas,
      demandasCanceladas,
      totalMunicipes,
      taxaConclusao: `${taxaConclusao}%`,
      demandasEmAtraso: demandasComAtraso.length,
      demandasAtraso30: demandasAtraso30Dias.length,
      demandasAtraso60: demandasAtraso60Dias.length,
      demandasAtraso90: demandasAtraso90Dias.length
    },
    charts: {
      statusData,
      areaChartData
    },
    overdue: {
      demandasEmAtraso: demandasComAtraso.length,
      demandasAtraso30: demandasAtraso30Dias.length,
      demandasAtraso60: demandasAtraso60Dias.length,
      demandasAtraso90: demandasAtraso90Dias.length,
      demandasAtrasoDetalhadas
    },
    isLoading: isLoadingDemandas || isLoadingMunicipes
  };
}