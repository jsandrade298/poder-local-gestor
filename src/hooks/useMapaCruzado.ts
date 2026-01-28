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
  // Buscar dados para o mapa (munícipes e demandas com coordenadas)
  const { data: dadosMapa, isLoading: isLoadingMapa } = useQuery({
    queryKey: ['mapa-cruzado-dados-mapa', filtros],
    queryFn: async () => {
      console.log('🗺️ Buscando dados para mapa com filtros:', filtros);

      // Buscar munícipes com filtros
      let queryMunicipe = supabase
        .from('municipes')
        .select(`
          id,
          nome,
          latitude,
          longitude,
          bairro,
          cidade,
          endereco,
          telefone,
          municipe_tags (
            tag_id,
            tags (id, nome, cor)
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Aplicar filtros de munícipes
      if (filtros?.municipes?.bairro) {
        queryMunicipe = queryMunicipe.eq('bairro', filtros.municipes.bairro);
      }
      if (filtros?.municipes?.cidade) {
        queryMunicipe = queryMunicipe.eq('cidade', filtros.municipes.cidade);
      }

      const { data: municipesData, error: errorMun } = await queryMunicipe;
      if (errorMun) {
        console.error('❌ Erro ao buscar munícipes:', errorMun);
        return { municipes: [], demandas: [] };
      }

      // Filtrar por tags se especificado
      let municipesFiltrados = municipesData || [];
      if (filtros?.municipes?.tagIds && filtros.municipes.tagIds.length > 0) {
        municipesFiltrados = municipesFiltrados.filter(municipe => 
          municipe.municipe_tags?.some((mt: any) => 
            filtros!.municipes!.tagIds!.includes(mt.tag_id)
          )
        );
      }

      // Buscar demandas com filtros
      let queryDemanda = supabase
        .from('demandas')
        .select(`
          id,
          titulo,
          latitude,
          longitude,
          bairro,
          cidade,
          logradouro,
          numero,
          status,
          prioridade,
          protocolo,
          created_at,
          area_id,
          areas (id, nome, cor),
          municipe_id
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Aplicar filtros de demandas
      if (filtros?.demandas?.status) {
        queryDemanda = queryDemanda.eq('status', filtros.demandas.status);
      }
      if (filtros?.demandas?.areaIds && filtros.demandas.areaIds.length > 0) {
        queryDemanda = queryDemanda.in('area_id', filtros.demandas.areaIds);
      }
      if (filtros?.demandas?.prioridade) {
        queryDemanda = queryDemanda.eq('prioridade', filtros.demandas.prioridade);
      }
      if (filtros?.demandas?.bairro) {
        queryDemanda = queryDemanda.eq('bairro', filtros.demandas.bairro);
      }
      if (filtros?.demandas?.cidade) {
        queryDemanda = queryDemanda.eq('cidade', filtros.demandas.cidade);
      }
      if (filtros?.demandas?.dataInicio && filtros?.demandas?.dataFim) {
        queryDemanda = queryDemanda
          .gte('created_at', filtros.demandas.dataInicio)
          .lte('created_at', filtros.demandas.dataFim);
      }

      const { data: demandasData, error: errorDem } = await queryDemanda;
      if (errorDem) {
        console.error('❌ Erro ao buscar demandas:', errorDem);
        return { municipes: [], demandas: [] };
      }

      // Filtrar coordenadas válidas
      const municipesValidos = municipesFiltrados
        .filter((m: any) => {
          const lat = Number(m.latitude);
          const lng = Number(m.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        })
        .map((m: any) => ({
          id: m.id,
          nome: m.nome,
          telefone: m.telefone,
          email: null,
          latitude: Number(m.latitude),
          longitude: Number(m.longitude),
          bairro: m.bairro,
          logradouro: null,
          endereco: m.endereco,
          cidade: m.cidade,
          tags: m.municipe_tags?.map((mt: any) => mt.tags?.nome).filter(Boolean) || [],
          tag_cores: m.municipe_tags?.map((mt: any) => mt.tags?.cor || '#6b7280').filter(Boolean) || [],
          tag_ids: m.municipe_tags?.map((mt: any) => mt.tags?.id).filter(Boolean) || [],
          demandas_count: 0,
          tipo: 'municipe' as const
        }));

      const demandasValidas = (demandasData || [])
        .filter((d: any) => {
          const lat = Number(d.latitude);
          const lng = Number(d.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        })
        .map((d: any) => ({
          id: d.id,
          titulo: d.titulo,
          descricao: null,
          status: d.status,
          prioridade: d.prioridade,
          protocolo: d.protocolo,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          bairro: d.bairro,
          logradouro: d.logradouro,
          numero: d.numero,
          cidade: d.cidade,
          area_id: d.area_id,
          area_nome: d.areas?.nome || null,
          area_cor: d.areas?.cor || null,
          municipe_id: d.municipe_id,
          municipe_nome: null,
          municipe_telefone: null,
          responsavel_id: null,
          data_prazo: null,
          created_at: d.created_at,
          tipo: 'demanda' as const
        }));

      console.log(`✅ Dados para mapa: ${municipesValidos.length} munícipes, ${demandasValidas.length} demandas`);
      return {
        municipes: municipesValidos,
        demandas: demandasValidas
      };
    }
  });

  // Buscar dados cruzados para análise
  const { data: dadosCruzados = [], isLoading: isLoadingCruzados } = useQuery({
    queryKey: ['mapa-cruzado-analise', filtros],
    queryFn: async () => {
      console.log('📊 Buscando dados cruzados para análise...');

      // Buscar todos os munícipes com tags
      const { data: todosMunicipes, error: errorMun } = await supabase
        .from('municipes')
        .select(`
          id,
          municipe_tags (
            tag_id,
            tags (id, nome, cor)
          )
        `);

      if (errorMun) {
        console.error('❌ Erro ao buscar munícipes para cruzamento:', errorMun);
        return [];
      }

      // Buscar todas as demandas com áreas
      const { data: todasDemandas, error: errorDem } = await supabase
        .from('demandas')
        .select(`
          id,
          municipe_id,
          area_id,
          areas (id, nome, cor)
        `);

      if (errorDem) {
        console.error('❌ Erro ao buscar demandas para cruzamento:', errorDem);
        return [];
      }

      // Cruzar dados
      const cruzamento: Record<string, DadosCruzados> = {};

      (todosMunicipes || []).forEach((municipe: any) => {
        municipe.municipe_tags?.forEach((mt: any) => {
          const tag = mt.tags;
          if (!tag) return;
          
          // Encontrar demandas deste munícipe
          const demandasDoMunicipe = (todasDemandas || []).filter(
            (d: any) => d.municipe_id === municipe.id
          );

          demandasDoMunicipe.forEach((demanda: any) => {
            const chave = `${tag.id}-${demanda.area_id}`;
            
            if (!cruzamento[chave]) {
              cruzamento[chave] = {
                area_id: demanda.area_id,
                area_nome: demanda.areas?.nome || 'Sem área',
                area_cor: demanda.areas?.cor || null,
                tag_id: tag.id,
                tag_nome: tag.nome,
                tag_cor: tag.cor,
                quantidade: 0,
                percentual: 0,
                municipes_ids: [],
                demandas_ids: []
              };
            }

            cruzamento[chave].quantidade += 1;
            if (!cruzamento[chave].municipes_ids.includes(municipe.id)) {
              cruzamento[chave].municipes_ids.push(municipe.id);
            }
            cruzamento[chave].demandas_ids.push(demanda.id);
          });
        });
      });

      const resultado = Object.values(cruzamento);
      console.log(`✅ Combinações encontradas: ${resultado.length}`);
      return resultado;
    }
  });

  return {
    dadosCruzados,
    dadosMapa,
    isLoading: isLoadingMapa || isLoadingCruzados
  };
}
