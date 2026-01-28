import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FiltrosCruzados {
  demandas?: {
    status?: string;
    areaIds?: string[];
    prioridade?: string;
    bairro?: string;
    cidade?: string;
    dataInicio?: string;
    dataFim?: string;
  };
  municipes?: {
    tagIds?: string[];
    bairro?: string;
    cidade?: string;
  };
}

export interface DadosCruzados {
  area_id: string;
  area_nome: string;
  area_cor: string | null;
  tag_id: string;
  tag_nome: string;
  tag_cor: string | null;
  quantidade: number;
  percentual: number;
  municipes_ids: string[];
  demandas_ids: string[];
}

export function useMapaCruzado(filtros?: FiltrosCruzados) {
  console.log('🎯 useMapaCruzado chamado com filtros:', filtros);

  // Buscar dados para o mapa (SIMPLIFICADO - só o essencial)
  const { data: dadosMapa, isLoading: isLoadingMapa, refetch } = useQuery({
    queryKey: ['mapa-cruzado-dados-mapa', JSON.stringify(filtros)],
    queryFn: async () => {
      console.log('🗺️ Buscando dados para mapa...');

      try {
        // 1. Buscar demandas (QUERY SIMPLIFICADA)
        // CORREÇÃO: Removido 'cor' do select de areas para evitar erro 400
        let demandaQuery = supabase
          .from('demandas')
          .select(`
            id,
            titulo,
            latitude,
            longitude,
            bairro,
            cidade,
            status,
            prioridade,
            protocolo,
            area_id,
            areas (
              id,
              nome
            )
          `)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        // Aplicar filtros de demandas
        if (filtros?.demandas?.status && filtros.demandas.status !== 'todos') {
          demandaQuery = demandaQuery.eq('status', filtros.demandas.status);
        }
        
        if (filtros?.demandas?.areaIds && filtros.demandas.areaIds.length > 0) {
          demandaQuery = demandaQuery.in('area_id', filtros.demandas.areaIds);
        }
        
        if (filtros?.demandas?.prioridade && filtros.demandas.prioridade !== 'todos') {
          demandaQuery = demandaQuery.eq('prioridade', filtros.demandas.prioridade);
        }
        
        if (filtros?.demandas?.bairro && filtros.demandas.bairro !== 'todos') {
          demandaQuery = demandaQuery.eq('bairro', filtros.demandas.bairro);
        }
        
        if (filtros?.demandas?.cidade && filtros.demandas.cidade !== 'todos') {
          demandaQuery = demandaQuery.eq('cidade', filtros.demandas.cidade);
        }

        const { data: demandasData, error: errorDem } = await demandaQuery;
        
        if (errorDem) {
          console.error('❌ Erro ao buscar demandas:', errorDem);
          throw errorDem;
        }

        // 2. Buscar munícipes (QUERY SIMPLIFICADA)
        let municipeQuery = supabase
          .from('municipes')
          .select(`
            id,
            nome,
            latitude,
            longitude,
            bairro,
            cidade,
            telefone
          `)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        // Aplicar filtros de munícipes
        if (filtros?.municipes?.bairro && filtros.municipes.bairro !== 'todos') {
          municipeQuery = municipeQuery.eq('bairro', filtros.municipes.bairro);
        }
        
        if (filtros?.municipes?.cidade && filtros.municipes.cidade !== 'todos') {
          municipeQuery = municipeQuery.eq('cidade', filtros.municipes.cidade);
        }

        const { data: municipesData, error: errorMun } = await municipeQuery;
        
        if (errorMun) {
          console.error('❌ Erro ao buscar munícipes:', errorMun);
          throw errorMun;
        }

        // 3. Processar dados para o mapa
        const demandasProcessadas = (demandasData || [])
          .filter(d => {
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          })
          .map(d => ({
            id: `demanda-${d.id}`,
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            title: d.titulo || 'Demanda sem título',
            description: d.protocolo || '',
            type: 'demanda' as const,
            status: d.status,
            prioridade: d.prioridade,
            area: d.areas ? {
              id: d.areas.id,
              nome: d.areas.nome,
              // CORREÇÃO: Definindo cor padrão já que a coluna não existe
              cor: '#3b82f6' 
            } : undefined,
            originalData: d
          }));

        const municipesProcessados = (municipesData || [])
          .filter(m => {
            const lat = Number(m.latitude);
            const lng = Number(m.longitude);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          })
          .map(m => ({
            id: `municipe-${m.id}`,
            latitude: Number(m.latitude),
            longitude: Number(m.longitude),
            title: m.nome || 'Munícipe sem nome',
            description: m.bairro || '',
            type: 'municipe' as const,
            tags: [],
            tagCores: [],
            originalData: m
          }));

        console.log(`✅ Dados processados: ${demandasProcessadas.length} demandas, ${municipesProcessados.length} munícipes`);
        
        return {
          municipes: municipesProcessados,
          demandas: demandasProcessadas
        };
        
      } catch (error) {
        console.error('💥 Erro crítico no useMapaCruzado:', error);
        return {
          municipes: [],
          demandas: []
        };
      }
    },
    enabled: true
  });

  // Buscar dados cruzados para análise (SIMPLIFICADA)
  const { data: dadosCruzados = [] } = useQuery({
    queryKey: ['mapa-cruzado-analise'],
    queryFn: async () => {
      console.log('📊 Buscando dados cruzados (simplificado)...');
      return []; // Retornar vazio por enquanto
    }
  });

  return {
    dadosCruzados,
    dadosMapa,
    isLoading: isLoadingMapa,
    refetch
  };
}
