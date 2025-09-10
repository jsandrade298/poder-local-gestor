import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorUtils";
import { formatDateOnly } from '@/lib/dateUtils';

export function useDashboardData() {
  const { data: demandas = [], isLoading: isLoadingDemandas } = useQuery({
    queryKey: ['demandas-dashboard'], // Chave específica para dashboard
    queryFn: async () => {
      console.log('🔄 Dashboard: Carregando demandas em lotes...');
      
      // Carregar demandas em lotes para garantir que pega todas
      const BATCH_SIZE = 1000;
      let allDemandas: any[] = [];
      let hasMore = true;
      let offset = 0;
      let totalExpected = 0;
      
      while (hasMore) {
        const { data, error, count } = await supabase
          .from('demandas')
          .select(`
            *,
            areas(nome),
            municipes(nome)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
          logError('❌ Dashboard: Erro ao buscar demandas:', error);
          throw error;
        }
        
        // Armazenar total esperado na primeira iteração
        if (offset === 0 && count !== null) {
          totalExpected = count;
          console.log(`📈 Dashboard: Total de demandas esperado: ${totalExpected}`);
        }
        
        if (data && data.length > 0) {
          allDemandas = [...allDemandas, ...data];
          offset += BATCH_SIZE;
          
          // Se retornou menos que o tamanho do lote, não há mais dados
          hasMore = data.length === BATCH_SIZE;
          
          console.log(`📦 Dashboard: Lote de demandas carregado - ${data.length} demandas (total: ${allDemandas.length})`);
        } else {
          hasMore = false;
        }
        
        // Verificação de segurança
        if (totalExpected > 0 && allDemandas.length >= totalExpected) {
          hasMore = false;
        }
      }
      
      console.log(`✅ Dashboard: ${allDemandas.length} demandas carregadas em lotes`);
      return allDemandas;
    }
  });

  const { data: municipes = [], isLoading: isLoadingMunicipes } = useQuery({
    queryKey: ['municipes-dashboard'], // Chave específica para dashboard
    queryFn: async () => {
      console.log('🔄 Dashboard: Carregando munícipes...');
      
      // Para dashboard, buscar em lotes para ter o total real sem sobrecarregar
      let allMunicipes: any[] = [];
      let from = 0;
      const size = 1000;
      let hasMore = true;
      let totalExpected = 0;
      
      while (hasMore) {
        const { data, error, count } = await supabase
          .from('municipes')
          .select('*', { count: 'exact' })
          .range(from, from + size - 1);
        
        if (error) {
          logError('❌ Dashboard: Erro ao buscar munícipes:', error);
          throw error;
        }
        
        // Armazenar total esperado na primeira iteração
        if (from === 0 && count !== null) {
          totalExpected = count;
          console.log(`📈 Dashboard: Total esperado no banco: ${totalExpected}`);
        }
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          console.log(`📊 Dashboard: Lote ${Math.floor(from/size) + 1}: ${data.length} munícipes`);
          
          if (data.length < size) {
            hasMore = false;
          } else {
            from += size;
          }
        } else {
          hasMore = false;
        }
        
        // Verificação de segurança
        if (totalExpected > 0 && allMunicipes.length >= totalExpected) {
          hasMore = false;
        }
      }
      
      console.log(`✅ Dashboard: Total carregado: ${allMunicipes.length} munícipes`);
      return allMunicipes;
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

  // Dados para gráfico de status (convertidos para percentuais)
  const statusCounts = [
    { name: "Aberta", count: demandas.filter(d => d.status === 'aberta').length, color: "#3b82f6" },
    { name: "Em Andamento", count: demandas.filter(d => d.status === 'em_andamento').length, color: "#f59e0b" },
    { name: "Aguardando", count: demandas.filter(d => d.status === 'aguardando').length, color: "#8b5cf6" },
    { name: "Resolvida", count: demandas.filter(d => d.status === 'resolvida').length, color: "#10b981" },
    { name: "Cancelada", count: demandas.filter(d => d.status === 'cancelada').length, color: "#ef4444" },
  ];
  
  const statusData = statusCounts.map(item => ({
    name: item.name,
    value: totalDemandas > 0 ? Math.round((item.count / totalDemandas) * 100) : 0,
    color: item.color
  }));

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
      data_prazo: formatDateOnly(demanda.data_prazo),
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