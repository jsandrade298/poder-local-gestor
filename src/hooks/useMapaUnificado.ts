import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Tipos
export interface DemandaMapa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  protocolo: string;
  latitude: number;
  longitude: number;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  area_id: string | null;
  area_nome: string | null;
  area_cor: string | null;
  municipe_id: string | null;
  municipe_nome: string | null;
  municipe_telefone: string | null;
  responsavel_id: string | null;
  data_prazo: string | null;
  created_at: string | null;
  tipo: 'demanda';
}

export interface MunicipeMapa {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  latitude: number;
  longitude: number;
  bairro: string | null;
  logradouro: string | null;
  endereco: string | null;
  cidade: string | null;
  tags: string[];
  tag_cores: string[];
  tag_ids: string[];
  demandas_count: number;
  tipo: 'municipe';
}

export interface AreaMapa {
  id: string;
  nome: string;
  cor: string | null;
}

export interface TagMapa {
  id: string;
  nome: string;
  cor: string | null;
}

// Hook principal
export function useMapaUnificado() {
  // 1. Buscar TODAS as áreas primeiro
  const { data: areas = [] } = useQuery({
    queryKey: ['mapa-areas-todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar áreas:', error);
        return [];
      }
      console.log('Áreas encontradas:', data?.length || 0);
      return (data || []) as AreaMapa[];
    }
  });

  // 2. Buscar TODAS as tags
  const { data: tags = [] } = useQuery({
    queryKey: ['mapa-tags-todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar tags:', error);
        return [];
      }
      console.log('Tags encontradas:', data?.length || 0);
      return (data || []) as TagMapa[];
    }
  });

  // 3. Buscar TODAS as demandas e filtrar as geocodificadas
  const { 
    data: demandas = [], 
    isLoading: loadingDemandas,
    refetch: refetchDemandas 
  } = useQuery({
    queryKey: ['mapa-demandas-todas', areas],
    queryFn: async () => {
      // Buscar todas as demandas
      const { data: todasDemandas, error } = await supabase
        .from('demandas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar demandas:', error);
        throw error;
      }
      
      console.log('Total de demandas no sistema:', todasDemandas?.length || 0);
      
      // Filtrar apenas as que têm coordenadas válidas
      const demandasGeocodificadas = (todasDemandas || []).filter(d => {
        const lat = d.latitude;
        const lng = d.longitude;
        return (
          lat !== null && 
          lat !== undefined &&
          lng !== null && 
          lng !== undefined &&
          !isNaN(Number(lat)) &&
          !isNaN(Number(lng))
        );
      });
      
      console.log('Demandas com coordenadas:', demandasGeocodificadas.length);

      // Criar mapa de áreas para lookup rápido
      const areasMap: Record<string, { nome: string; cor: string | null }> = {};
      areas.forEach(a => {
        areasMap[a.id] = { nome: a.nome, cor: a.cor };
      });

      // Buscar nomes dos munícipes
      const municipeIds = [...new Set(demandasGeocodificadas.map(d => d.municipe_id).filter(Boolean))];
      let municipesMap: Record<string, { nome: string; telefone: string | null }> = {};
      
      if (municipeIds.length > 0) {
        const { data: municipesData } = await supabase
          .from('municipes')
          .select('id, nome, telefone')
          .in('id', municipeIds);
        
        (municipesData || []).forEach(m => {
          municipesMap[m.id] = { nome: m.nome, telefone: m.telefone };
        });
      }
      
      return demandasGeocodificadas.map(d => ({
        id: d.id,
        titulo: d.titulo,
        descricao: d.descricao,
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
        area_nome: d.area_id ? areasMap[d.area_id]?.nome || null : null,
        area_cor: d.area_id ? areasMap[d.area_id]?.cor || null : null,
        municipe_id: d.municipe_id,
        municipe_nome: d.municipe_id ? municipesMap[d.municipe_id]?.nome || null : null,
        municipe_telefone: d.municipe_id ? municipesMap[d.municipe_id]?.telefone || null : null,
        responsavel_id: d.responsavel_id,
        data_prazo: d.data_prazo,
        created_at: d.created_at,
        tipo: 'demanda' as const
      })) as DemandaMapa[];
    },
    enabled: areas.length >= 0 // Sempre executar
  });

  // 4. Buscar TODOS os munícipes e filtrar os geocodificados
  const { 
    data: municipes = [], 
    isLoading: loadingMunicipes,
    refetch: refetchMunicipes 
  } = useQuery({
    queryKey: ['mapa-municipes-todos'],
    queryFn: async () => {
      // Buscar todos os munícipes
      const { data: todosMunicipes, error: municipesError } = await supabase
        .from('municipes')
        .select('*');
      
      if (municipesError) {
        console.error('Erro ao buscar munícipes:', municipesError);
        throw municipesError;
      }
      
      console.log('Total de munícipes no sistema:', todosMunicipes?.length || 0);

      // Filtrar apenas os que têm coordenadas válidas
      const municipesGeocodificados = (todosMunicipes || []).filter(m => {
        const lat = m.latitude;
        const lng = m.longitude;
        return (
          lat !== null && 
          lat !== undefined &&
          lng !== null && 
          lng !== undefined &&
          !isNaN(Number(lat)) &&
          !isNaN(Number(lng))
        );
      });
      
      console.log('Munícipes com coordenadas:', municipesGeocodificados.length);
      
      if (municipesGeocodificados.length === 0) return [];

      // Buscar tags de cada munícipe
      const { data: tagsData, error: tagsError } = await supabase
        .from('municipe_tags')
        .select(`
          municipe_id,
          tags:tag_id(id, nome, cor)
        `)
        .in('municipe_id', municipesGeocodificados.map(m => m.id));
      
      if (tagsError) console.warn('Erro ao buscar tags de munícipes:', tagsError);

      // Buscar contagem de demandas por munícipe
      const { data: demandasCount, error: demandasError } = await supabase
        .from('demandas')
        .select('municipe_id')
        .in('municipe_id', municipesGeocodificados.map(m => m.id))
        .neq('status', 'atendido');
      
      if (demandasError) console.warn('Erro ao buscar demandas de munícipes:', demandasError);

      // Montar mapa de tags por munícipe
      const tagsMap: Record<string, { ids: string[], nomes: string[], cores: string[] }> = {};
      (tagsData || []).forEach(item => {
        const tag = item.tags as any;
        if (!tag) return;
        
        if (!tagsMap[item.municipe_id]) {
          tagsMap[item.municipe_id] = { ids: [], nomes: [], cores: [] };
        }
        tagsMap[item.municipe_id].ids.push(tag.id);
        tagsMap[item.municipe_id].nomes.push(tag.nome);
        tagsMap[item.municipe_id].cores.push(tag.cor || '#6b7280');
      });

      // Montar contagem de demandas por munícipe
      const demandasMap: Record<string, number> = {};
      (demandasCount || []).forEach(item => {
        if (item.municipe_id) {
          demandasMap[item.municipe_id] = (demandasMap[item.municipe_id] || 0) + 1;
        }
      });

      return municipesGeocodificados.map(m => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        email: m.email,
        latitude: Number(m.latitude),
        longitude: Number(m.longitude),
        bairro: m.bairro,
        logradouro: null,
        endereco: m.endereco,
        cidade: m.cidade,
        tags: tagsMap[m.id]?.nomes || [],
        tag_cores: tagsMap[m.id]?.cores || [],
        tag_ids: tagsMap[m.id]?.ids || [],
        demandas_count: demandasMap[m.id] || 0,
        tipo: 'municipe' as const
      })) as MunicipeMapa[];
    }
  });

  // Buscar bairros únicos
  const bairrosUnicos = [...new Set([
    ...demandas.map(d => d.bairro).filter(Boolean),
    ...municipes.map(m => m.bairro).filter(Boolean)
  ])].sort() as string[];

  const refetch = () => {
    refetchDemandas();
    refetchMunicipes();
  };

  return {
    demandas,
    municipes,
    areas,
    tags,
    bairrosUnicos,
    isLoading: loadingDemandas || loadingMunicipes,
    refetch
  };
}
