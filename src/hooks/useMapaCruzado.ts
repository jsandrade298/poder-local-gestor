import { useState, useMemo } from 'react';
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

export interface Metricas {
  totalMun: number;
  totalDem: number;
  totalCombinacoes: number;
  topTags: { nome: string; quantidade: number; cor: string | null }[];
  topAreas: { nome: string; quantidade: number; cor: string | null }[];
}

export interface DadosFiltrados {
  municipes: any[];
  demandas: any[];
  cruzados: DadosCruzados[];
}

export interface Insight {
  tipo: 'correlacao' | 'concentracao' | 'oportunidade';
  titulo: string;
  descricao: string;
  valor?: number;
  cor?: string;
}

export function useMapaCruzado() {
  // Estado dos filtros
  const [filtros, setFiltros] = useState<FiltrosCruzados>({
    tagIds: [],
    areaIds: [],
  });

  // Buscar todas as áreas
  const { data: areas = [] } = useQuery({
    queryKey: ['mapa-cruzado-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar todas as tags
  const { data: tags = [] } = useQuery({
    queryKey: ['mapa-cruzado-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar bairros únicos
  const { data: bairros = [] } = useQuery({
    queryKey: ['mapa-cruzado-bairros'],
    queryFn: async () => {
      const { data: demandas } = await supabase
        .from('demandas')
        .select('bairro')
        .not('bairro', 'is', null);
      
      const { data: municipes } = await supabase
        .from('municipes')
        .select('bairro')
        .not('bairro', 'is', null);
      
      const todosBairros = [
        ...(demandas || []).map(d => d.bairro),
        ...(municipes || []).map(m => m.bairro)
      ].filter(Boolean);
      
      return [...new Set(todosBairros)].sort();
    }
  });

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
          tags(nome, cor)
        `);

      if (errorMunicipeTags) {
        console.error('Erro ao buscar munícipes com tags:', errorMunicipeTags);
        return [];
      }

      // 2. Buscar todas as demandas com áreas
      const { data: demandasComAreas, error: errorDemandaAreas } = await supabase
        .from('demandas')
        .select(`
          id,
          municipe_id,
          area_id,
          areas(nome, cor),
          status,
          bairro,
          created_at
        `);

      if (errorDemandaAreas) {
        console.error('Erro ao buscar demandas com áreas:', errorDemandaAreas);
        return [];
      }

      // 3. Aplicar filtros iniciais
      let demandasFiltradas = demandasComAreas || [];
      const municipesFiltrados = municipesComTags || [];

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
          if (!demanda.area_id) return;
          
          const chave = `${municipeTag.tag_id}-${demanda.area_id}`;
          
          if (!cruzamento[chave]) {
            cruzamento[chave] = {
              area_id: demanda.area_id,
              area_nome: (demanda.areas as any)?.nome || 'Sem área',
              area_cor: (demanda.areas as any)?.cor || '#6b7280',
              tag_id: municipeTag.tag_id,
              tag_nome: (municipeTag.tags as any)?.nome || 'Sem tag',
              tag_cor: (municipeTag.tags as any)?.cor || '#6b7280',
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
      // Buscar munícipes com coordenadas
      const { data: municipes, error: errorMun } = await supabase
        .from('municipes')
        .select(`
          id,
          nome,
          latitude,
          longitude,
          bairro,
          telefone,
          email
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (errorMun) {
        console.error('Erro ao buscar munícipes:', errorMun);
      }

      // Buscar tags dos munícipes
      const municipeIds = (municipes || []).map(m => m.id);
      let municipesComTags = municipes || [];

      if (municipeIds.length > 0) {
        const { data: tagsData } = await supabase
          .from('municipe_tags')
          .select(`
            municipe_id,
            tag_id,
            tags(id, nome, cor)
          `)
          .in('municipe_id', municipeIds);

        // Agrupar tags por munícipe
        const tagsMap: Record<string, any[]> = {};
        (tagsData || []).forEach(item => {
          if (!tagsMap[item.municipe_id]) {
            tagsMap[item.municipe_id] = [];
          }
          if (item.tags) {
            tagsMap[item.municipe_id].push(item.tags);
          }
        });

        municipesComTags = (municipes || []).map(m => ({
          ...m,
          tags: tagsMap[m.id] || []
        }));

        // Filtrar por tags se especificado
        if (filtros?.tagIds && filtros.tagIds.length > 0) {
          municipesComTags = municipesComTags.filter(m => 
            m.tags.some((t: any) => filtros.tagIds!.includes(t.id))
          );
        }
      }

      // Buscar demandas com coordenadas
      let demandaQuery = supabase
        .from('demandas')
        .select(`
          id,
          titulo,
          protocolo,
          latitude,
          longitude,
          bairro,
          status,
          area_id,
          areas(id, nome, cor),
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

      if (filtros?.bairro) {
        demandaQuery = demandaQuery.eq('bairro', filtros.bairro);
      }

      const { data: demandas } = await demandaQuery;

      return {
        municipes: municipesComTags || [],
        demandas: demandas || []
      };
    }
  });

  // Calcular métricas
  const metricas: Metricas = useMemo(() => {
    const totalMun = dadosMapa?.municipes?.length || 0;
    const totalDem = dadosMapa?.demandas?.length || 0;
    
    // Calcular top tags
    const tagsMap = new Map<string, { nome: string; quantidade: number; cor: string | null }>();
    dadosCruzados.forEach(item => {
      const current = tagsMap.get(item.tag_id) || { nome: item.tag_nome, quantidade: 0, cor: item.tag_cor };
      current.quantidade += item.quantidade;
      tagsMap.set(item.tag_id, current);
    });
    const topTags = Array.from(tagsMap.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    // Calcular top áreas
    const areasMap = new Map<string, { nome: string; quantidade: number; cor: string | null }>();
    dadosCruzados.forEach(item => {
      const current = areasMap.get(item.area_id) || { nome: item.area_nome, quantidade: 0, cor: item.area_cor };
      current.quantidade += item.quantidade;
      areasMap.set(item.area_id, current);
    });
    const topAreas = Array.from(areasMap.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    return {
      totalMun,
      totalDem,
      totalCombinacoes: dadosCruzados.length,
      topTags,
      topAreas
    };
  }, [dadosMapa, dadosCruzados]);

  // Gerar insights
  const insights: Insight[] = useMemo(() => {
    const result: Insight[] = [];

    if (dadosCruzados.length === 0) return result;

    // Insight de correlação mais forte
    const topCorrelacao = [...dadosCruzados].sort((a, b) => b.quantidade - a.quantidade)[0];
    if (topCorrelacao && topCorrelacao.quantidade > 1) {
      result.push({
        tipo: 'correlacao',
        titulo: 'Correlação Principal',
        descricao: `O grupo "${topCorrelacao.tag_nome}" tem forte correlação com demandas de "${topCorrelacao.area_nome}" (${topCorrelacao.quantidade} ocorrências).`,
        valor: topCorrelacao.percentual,
        cor: topCorrelacao.tag_cor || '#6b7280'
      });
    }

    // Insight de concentração
    if (metricas.topAreas.length > 0) {
      const areaTop = metricas.topAreas[0];
      const percentual = metricas.totalDem > 0 
        ? ((areaTop.quantidade / metricas.totalDem) * 100).toFixed(1)
        : '0';
      result.push({
        tipo: 'concentracao',
        titulo: 'Área Mais Demandada',
        descricao: `"${areaTop.nome}" concentra ${percentual}% das demandas no território.`,
        valor: parseFloat(percentual),
        cor: areaTop.cor || '#6b7280'
      });
    }

    // Insight de oportunidade
    if (metricas.topTags.length > 0) {
      const tagTop = metricas.topTags[0];
      result.push({
        tipo: 'oportunidade',
        titulo: 'Grupo Mais Ativo',
        descricao: `Munícipes com tag "${tagTop.nome}" são os mais ativos em registrar demandas.`,
        valor: tagTop.quantidade,
        cor: tagTop.cor || '#6b7280'
      });
    }

    return result;
  }, [dadosCruzados, metricas]);

  // Dados filtrados para o mapa
  const dadosFiltrados: DadosFiltrados = useMemo(() => ({
    municipes: dadosMapa?.municipes || [],
    demandas: dadosMapa?.demandas || [],
    cruzados: dadosCruzados
  }), [dadosMapa, dadosCruzados]);

  // Função para atualizar filtros
  const atualizarFiltros = (novosFiltros: Partial<FiltrosCruzados>) => {
    setFiltros(prev => ({ ...prev, ...novosFiltros }));
  };

  return {
    // Dados para os componentes
    dadosFiltrados,
    metricas,
    insights,
    
    // Filtros
    filtros: {
      ...filtros,
      areas,
      tags,
      bairros
    },
    atualizarFiltros,
    
    // Loading
    isLoading: isLoadingCruzados || isLoadingMapa,
    
    // Dados brutos (para compatibilidade)
    dadosCruzados,
    dadosMapa,
    estatisticas: {
      totalMunicipes: metricas.totalMun,
      totalDemandas: metricas.totalDem,
      topTags: metricas.topTags,
      topAreas: metricas.topAreas,
      totalCombinacoes: metricas.totalCombinacoes
    }
  };
}
