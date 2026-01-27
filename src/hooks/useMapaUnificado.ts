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
  area_nome?: string | null;
  area_cor?: string | null;
  municipe_id: string | null;
  municipe_nome?: string | null;
  municipe_telefone?: string | null;
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
  // Buscar demandas geocodificadas
  const { 
    data: demandas = [], 
    isLoading: loadingDemandas,
    refetch: refetchDemandas 
  } = useQuery({
    queryKey: ['mapa-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          id,
          titulo,
          descricao,
          status,
          prioridade,
          protocolo,
          latitude,
          longitude,
          bairro,
          logradouro,
          numero,
          cidade,
          area_id,
          municipe_id,
          responsavel_id,
          data_prazo,
          created_at,
          areas:area_id(nome, cor),
          municipes:municipe_id(nome, telefone)
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(d => ({
        ...d,
        latitude: Number(d.latitude),
        longitude: Number(d.longitude),
        area_nome: (d.areas as any)?.nome || null,
        area_cor: (d.areas as any)?.cor || null,
        municipe_nome: (d.municipes as any)?.nome || null,
        municipe_telefone: (d.municipes as any)?.telefone || null,
        tipo: 'demanda' as const
      })).filter(d => 
        !isNaN(d.latitude) && !isNaN(d.longitude) &&
        d.latitude >= -90 && d.latitude <= 90 &&
        d.longitude >= -180 && d.longitude <= 180
      ) as DemandaMapa[];
    }
  });

  // Buscar munícipes geocodificados com tags
  const { 
    data: municipes = [], 
    isLoading: loadingMunicipes,
    refetch: refetchMunicipes 
  } = useQuery({
    queryKey: ['mapa-municipes'],
    queryFn: async () => {
      // Primeiro buscar todos os munícipes geocodificados
      const { data: municipesData, error: municipesError } = await supabase
        .from('municipes')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      
      if (municipesError) throw municipesError;
      
      if (!municipesData || municipesData.length === 0) return [];

      // Buscar tags de cada munícipe
      const { data: tagsData, error: tagsError } = await supabase
        .from('municipe_tags')
        .select(`
          municipe_id,
          tags:tag_id(id, nome, cor)
        `)
        .in('municipe_id', municipesData.map(m => m.id));
      
      if (tagsError) console.warn('Erro ao buscar tags:', tagsError);

      // Buscar contagem de demandas por munícipe
      const { data: demandasCount, error: demandasError } = await supabase
        .from('demandas')
        .select('municipe_id')
        .in('municipe_id', municipesData.map(m => m.id))
        .not('status', 'eq', 'atendido');
      
      if (demandasError) console.warn('Erro ao buscar demandas:', demandasError);

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

      return municipesData.map(m => ({
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
      })).filter(m => 
        !isNaN(m.latitude) && !isNaN(m.longitude) &&
        m.latitude >= -90 && m.latitude <= 90 &&
        m.longitude >= -180 && m.longitude <= 180
      ) as MunicipeMapa[];
    }
  });

  // Buscar áreas
  const { data: areas = [] } = useQuery({
    queryKey: ['mapa-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data as AreaMapa[];
    }
  });

  // Buscar tags
  const { data: tags = [] } = useQuery({
    queryKey: ['mapa-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data as TagMapa[];
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
