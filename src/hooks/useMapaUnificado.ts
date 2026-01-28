import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export function useMapaUnificado() {
  // Buscar TODAS as áreas (corrigido)
  const { data: areas = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['mapa-areas-todas'],
    queryFn: async () => {
      console.log('🔄 Buscando todas as áreas...');
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('❌ Erro ao buscar áreas:', error);
        return [];
      }
      
      console.log(`✅ Áreas encontradas: ${data?.length || 0}`);
      return (data || []) as AreaMapa[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar TODAS as tags
  const { data: tags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['mapa-tags-todas'],
    queryFn: async () => {
      console.log('🔄 Buscando todas as tags...');
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('❌ Erro ao buscar tags:', error);
        return [];
      }
      
      console.log(`✅ Tags encontradas: ${data?.length || 0}`);
      return (data || []) as TagMapa[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar demandas COM coordenadas válidas
  const { 
    data: demandas = [], 
    isLoading: isLoadingDemandas,
    refetch: refetchDemandas 
  } = useQuery({
    queryKey: ['mapa-demandas-geocodificadas'],
    queryFn: async () => {
      console.log('🔄 Buscando demandas geocodificadas...');
      
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas!left (nome, cor),
          municipes!left (nome, telefone)
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao buscar demandas:', error);
        return [];
      }
      
      const demandasValidas = (data || []).filter(d => {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      
      console.log(`✅ Demandas com coordenadas: ${demandasValidas.length}`);
      
      return demandasValidas.map(d => ({
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
        area_nome: d.areas?.nome || null,
        area_cor: d.areas?.cor || null,
        municipe_id: d.municipe_id,
        municipe_nome: d.municipes?.nome || null,
        municipe_telefone: d.municipes?.telefone || null,
        responsavel_id: d.responsavel_id,
        data_prazo: d.data_prazo,
        created_at: d.created_at,
        tipo: 'demanda' as const
      })) as DemandaMapa[];
    }
  });

  // Buscar munícipes COM coordenadas válidas
  const { 
    data: municipes = [], 
    isLoading: isLoadingMunicipes,
    refetch: refetchMunicipes 
  } = useQuery({
    queryKey: ['mapa-municipes-geocodificados'],
    queryFn: async () => {
      console.log('🔄 Buscando munícipes geocodificados...');
      
      const { data, error } = await supabase
        .from('municipes')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      
      if (error) {
        console.error('❌ Erro ao buscar munícipes:', error);
        return [];
      }
      
      const municipesValidos = (data || []).filter(m => {
        const lat = Number(m.latitude);
        const lng = Number(m.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      
      console.log(`✅ Munícipes com coordenadas: ${municipesValidos.length}`);
      
      if (municipesValidos.length === 0) return [];
      
      // Buscar tags dos munícipes
      const { data: tagsData } = await supabase
        .from('municipe_tags')
        .select(`
          municipe_id,
          tags!inner (id, nome, cor)
        `)
        .in('municipe_id', municipesValidos.map(m => m.id));
      
      // Organizar tags por munícipe
      const tagsPorMunicipe: Record<string, any[]> = {};
      (tagsData || []).forEach(item => {
        if (!tagsPorMunicipe[item.municipe_id]) {
          tagsPorMunicipe[item.municipe_id] = [];
        }
        tagsPorMunicipe[item.municipe_id].push(item.tags);
      });
      
      return municipesValidos.map(m => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        email: m.email,
        latitude: Number(m.latitude),
        longitude: Number(m.longitude),
        bairro: m.bairro,
        logradouro: m.logradouro,
        endereco: m.endereco,
        cidade: m.cidade,
        tags: tagsPorMunicipe[m.id]?.map(t => t.nome) || [],
        tag_cores: tagsPorMunicipe[m.id]?.map(t => t.cor) || [],
        tag_ids: tagsPorMunicipe[m.id]?.map(t => t.id) || [],
        demandas_count: 0, // Podemos calcular depois se necessário
        tipo: 'municipe' as const
      })) as MunicipeMapa[];
    }
  });

  // Bairros únicos
  const bairrosUnicos = Array.from(new Set([
    ...demandas.map(d => d.bairro).filter(Boolean) as string[],
    ...municipes.map(m => m.bairro).filter(Boolean) as string[]
  ])).sort();

  return {
    areas,
    tags,
    demandas,
    municipes,
    bairrosUnicos,
    isLoading: isLoadingAreas || isLoadingTags || isLoadingDemandas || isLoadingMunicipes,
    refetch: () => {
      refetchDemandas();
      refetchMunicipes();
    }
  };
}
