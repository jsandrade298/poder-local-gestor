import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Tipos para o cruzamento
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

export interface FiltrosCruzados {
  tagIds: string[];
  areaIds: string[];
  bairro?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function useMapaCruzado(filtros?: FiltrosCruzados) {
  // Buscar dados cruzados
  const { data: dadosCruzados = [], isLoading: isLoadingCruzados } = useQuery({
    queryKey: ['mapa-cruzado-dados', filtros],
    queryFn: async () => {
      console.log('🔄 Mapa Cruzado: Buscando dados cruzados...');

      // 1. Buscar todos os munícipes com tags
      const { data: municipesComTags, error: errorMunicipeTags } = await supabase
        .from('municipe_tags')
        .select(`
          municipe_id,
          tag_id,
          tags!inner(nome, cor)
        `);

      if (errorMunicipeTags) {
        console.error('Erro ao buscar munícipes com tags:', errorMunicipeTags);
        throw errorMunicipeTags;
      }

      // 2. Buscar todas as demandas com áreas
      const { data: demandasComAreas, error: errorDemandaAreas } = await supabase
        .from('demandas')
        .select(`
          id,
          municipe_id,
          area_id,
          areas!inner(nome, cor),
          status,
          bairro,
          created_at
        `);

      if (errorDemandaAreas) {
        console.error('Erro ao buscar demandas com áreas:', errorDemandaAreas);
        throw errorDemandaAreas;
      }

      // 3. Aplicar filtros iniciais
      let demandasFiltradas = demandasComAreas || [];
      let municipesFiltrados = municipesComTags || [];

      // Filtro por status
      if (filtros?.status) {
        demandasFiltradas = demandasFiltradas.filter(d => d.status === filtros.status);
      }

      // Filtro por bairro
      if (filtros?.bairro) {
        demandasFiltradas = demandasFiltradas.filter(d => d.bairro === filtros.bairro);
      }

      // Filtro por data
      if (filtros?.dataInicio && filtros?.dataFim) {
        demandasFiltradas = demandasFiltradas.filter(d => {
          const dataCriacao = new Date(d.created_at);
          const inicio = new Date(filtros.dataInicio!);
          const fim = new Date(filtros.dataFim!);
          return dataCriacao >= inicio && dataCriacao <= fim;
        });
      }

      // 4. Cruzar dados: Agrupar por tag_id e area_id
      const cruzamento: Record<string, DadosCruzados> = {};

      municipesFiltrados.forEach(municipeTag => {
        // Encontrar demandas deste munícipe
        const demandasDoMunicipe = demandasFiltradas.filter(
          d => d.municipe_id === municipeTag.municipe_id
        );

        demandasDoMunicipe.forEach(demanda => {
          const chave = `${municipeTag.tag_id}-${demanda.area_id}`;
          
          if (!cruzamento[chave]) {
            cruzamento[chave] = {
              area_id: demanda.area_id,
              area_nome: demanda.areas.nome,
              area_cor: demanda.areas.cor,
              tag_id: municipeTag.tag_id,
              tag_nome: municipeTag.tags.nome,
              tag_cor: municipeTag.tags.cor,
              quantidade: 0,
              percentual: 0,
              municipes_ids: [],
              demandas_ids: []
            };
          }

          cruzamento[chave].quantidade += 1;
          if (!cruzamento[chave].municipes_ids.includes(municipeTag.municipe_id)) {
            cruzamento[chave].municipes_ids.push(municipeTag.municipe_id);
          }
          cruzamento[chave].demandas_ids.push(demanda.id);
        });
      });

      // 5. Calcular percentuais
      const totalDemandas = demandasFiltradas.length;
      const resultado = Object.values(cruzamento).map(item => ({
        ...item,
        percentual: totalDemandas > 0 ? (item.quantidade / totalDemandas) * 100 : 0
      }));

      // 6. Aplicar filtros de tags e áreas (se especificados)
      let resultadoFiltrado = resultado;

      if (filtros?.tagIds && filtros.tagIds.length > 0) {
        resultadoFiltrado = resultadoFiltrado.filter(item => 
          filtros.tagIds!.includes(item.tag_id)
        );
      }

      if (filtros?.areaIds && filtros.areaIds.length > 0) {
        resultadoFiltrado = resultadoFiltrado.filter(item => 
          filtros.areaIds!.includes(item.area_id)
        );
      }

      console.log(`✅ Mapa Cruzado: ${resultadoFiltrado.length} combinações encontradas`);
      return resultadoFiltrado;
    }
  });

  // Buscar dados para mapa (com coordenadas)
  const { data: dadosMapa, isLoading: isLoadingMapa } = useQuery({
    queryKey: ['mapa-cruzado-coordenadas', filtros],
    queryFn: async () => {
      // Buscar coordenadas dos munícipes com tags filtradas
      let query = supabase
        .from('municipes')
        .select(`
          id,
          nome,
          latitude,
          longitude,
          bairro,
          municipe_tags!inner(
            tag_id,
            tags!inner(nome, cor)
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Aplicar filtro de tags se existir
      if (filtros?.tagIds && filtros.tagIds.length > 0) {
        query = query.in('municipe_tags.tag_id', filtros.tagIds);
      }

      const { data: municipes, error } = await query;

      if (error) {
        console.error('Erro ao buscar coordenadas:', error);
        return { municipes: [], demandas: [] };
      }

      // Buscar coordenadas das demandas com áreas filtradas
      let demandaQuery = supabase
        .from('demandas')
        .select(`
          id,
          titulo,
          latitude,
          longitude,
          bairro,
          area_id,
          areas!inner(nome, cor),
          municipe_id
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Aplicar filtros
      if (filtros?.areaIds && filtros.areaIds.length > 0) {
        demandaQuery = demandaQuery.in('area_id', filtros.areaIds);
      }

      if (filtros?.status) {
        demandaQuery = demandaQuery.eq('status', filtros.status);
      }

      const { data: demandas } = await demandaQuery;

      return {
        municipes: municipes || [],
        demandas: demandas || []
      };
    }
  });

  // Buscar estatísticas resumidas
  const { data: estatisticas } = useQuery({
    queryKey: ['mapa-cruzado-estatisticas', dadosCruzados],
    queryFn: () => {
      if (!dadosCruzados || dadosCruzados.length === 0) {
        return {
          topTags: [],
          topAreas: [],
          totalCombinacoes: 0,
          totalDemandas: 0,
          totalMunicipes: 0
        };
      }

      // Calcular top tags
      const tagsMap = new Map();
      dadosCruzados.forEach(item => {
        const current = tagsMap.get(item.tag_id) || { nome: item.tag_nome, quantidade: 0, cor: item.tag_cor };
        current.quantidade += item.quantidade;
        tagsMap.set(item.tag_id, current);
      });

      const topTags = Array.from(tagsMap.values())
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      // Calcular top áreas
      const areasMap = new Map();
      dadosCruzados.forEach(item => {
        const current = areasMap.get(item.area_id) || { nome: item.area_nome, quantidade: 0, cor: item.area_cor };
        current.quantidade += item.quantidade;
        areasMap.set(item.area_id, current);
      });

      const topAreas = Array.from(areasMap.values())
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      // Totais
      const totalDemandas = dadosCruzados.reduce((sum, item) => sum + item.quantidade, 0);
      const totalMunicipes = new Set(
        dadosCruzados.flatMap(item => item.municipes_ids)
      ).size;

      return {
        topTags,
        topAreas,
        totalCombinacoes: dadosCruzados.length,
        totalDemandas,
        totalMunicipes
      };
    }
  });

  return {
    dadosCruzados,
    dadosMapa,
    estatisticas,
    isLoading: isLoadingCruzados || isLoadingMapa
  };
}
