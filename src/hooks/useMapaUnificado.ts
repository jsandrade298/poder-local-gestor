import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// === INTERFACES ===
export interface DemandaMapa {
  id: string;
  titulo: string;
  descricao: string;
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
  municipe_id: string;
  municipe_nome?: string;
  created_at: string | null;
}

export interface MunicipeMapa {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  bairro: string | null;
  endereco: string | null;
  cidade: string | null;
  latitude: number;
  longitude: number;
  tag_ids: string[];
  created_at: string | null;
}

export interface AreaMapa {
  id: string;
  nome: string;
  descricao: string | null;
}

export interface TagMapa {
  id: string;
  nome: string;
  cor: string | null;
}

// === HOOK PRINCIPAL ===
export function useMapaUnificado() {
  // Buscar demandas com coordenadas e nome do munícipe
  const { 
    data: rawDemandas, 
    isLoading: loadingDemandas, 
    refetch: refetchDemandas,
    error: errorDemandas
  } = useQuery({
    queryKey: ['mapa-unificado-demandas'],
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
          created_at,
          municipes!demandas_municipe_id_fkey (
            nome
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar demandas para mapa:', error);
        throw error;
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  });

  // Buscar munícipes com coordenadas e suas tags
  const { 
    data: rawMunicipes, 
    isLoading: loadingMunicipes, 
    refetch: refetchMunicipes,
    error: errorMunicipes
  } = useQuery({
    queryKey: ['mapa-unificado-municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          id,
          nome,
          telefone,
          email,
          bairro,
          endereco,
          cidade,
          latitude,
          longitude,
          created_at,
          municipe_tags (
            tag_id
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('nome', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar munícipes para mapa:', error);
        throw error;
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Buscar áreas
  const { data: areas, isLoading: loadingAreas } = useQuery({
    queryKey: ['mapa-unificado-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome, descricao')
        .order('nome', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar áreas:', error);
        return [];
      }
      
      return (data || []) as AreaMapa[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar tags
  const { data: tags, isLoading: loadingTags } = useQuery({
    queryKey: ['mapa-unificado-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar tags:', error);
        return [];
      }
      
      return (data || []) as TagMapa[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Processar demandas para o formato do mapa
  const demandas = useMemo((): DemandaMapa[] => {
    if (!rawDemandas) return [];
    
    return rawDemandas
      .filter(d => {
        const lat = d.latitude;
        const lng = d.longitude;
        return (
          lat !== null && 
          lat !== undefined &&
          lng !== null && 
          lng !== undefined &&
          !isNaN(Number(lat)) &&
          !isNaN(Number(lng)) &&
          Number(lat) >= -90 && Number(lat) <= 90 &&
          Number(lng) >= -180 && Number(lng) <= 180
        );
      })
      .map(d => ({
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
        municipe_id: d.municipe_id,
        municipe_nome: (d.municipes as any)?.nome || 'Não identificado',
        created_at: d.created_at,
      }));
  }, [rawDemandas]);

  // Processar munícipes para o formato do mapa
  const municipes = useMemo((): MunicipeMapa[] => {
    if (!rawMunicipes) return [];
    
    return rawMunicipes
      .filter(m => {
        const lat = m.latitude;
        const lng = m.longitude;
        return (
          lat !== null && 
          lat !== undefined &&
          lng !== null && 
          lng !== undefined &&
          !isNaN(Number(lat)) &&
          !isNaN(Number(lng)) &&
          Number(lat) >= -90 && Number(lat) <= 90 &&
          Number(lng) >= -180 && Number(lng) <= 180
        );
      })
      .map(m => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        email: m.email,
        bairro: m.bairro,
        endereco: m.endereco,
        cidade: m.cidade,
        latitude: Number(m.latitude),
        longitude: Number(m.longitude),
        tag_ids: (m.municipe_tags as any[])?.map(t => t.tag_id) || [],
        created_at: m.created_at,
      }));
  }, [rawMunicipes]);

  // Extrair bairros únicos de demandas e munícipes
  const bairrosUnicos = useMemo((): string[] => {
    const bairros = new Set<string>();
    
    demandas.forEach(d => {
      if (d.bairro) bairros.add(d.bairro);
    });
    
    municipes.forEach(m => {
      if (m.bairro) bairros.add(m.bairro);
    });
    
    return Array.from(bairros).sort();
  }, [demandas, municipes]);

  // Função para recarregar todos os dados
  const refetch = async () => {
    await Promise.all([
      refetchDemandas(),
      refetchMunicipes(),
    ]);
  };

  const isLoading = loadingDemandas || loadingMunicipes || loadingAreas || loadingTags;
  const error = errorDemandas || errorMunicipes;

  return {
    demandas,
    municipes,
    areas: areas || [],
    tags: tags || [],
    bairrosUnicos,
    isLoading,
    error,
    refetch,
  };
}
