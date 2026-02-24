import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { geocodificarEndereco } from './useBrasilAPI';

export interface AreaMapa {
  id: string;
  nome: string;
  cor: string | null;
  descricao?: string | null;
}

export interface TagMapa {
  id: string;
  nome: string;
  cor: string | null;
}

export interface CategoriaMapa {
  id: string;
  nome: string;
  cor: string;
  icone: string;
}

export interface DemandaMapa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  protocolo: string;
  latitude: number | null;
  longitude: number | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  cep: string | null;
  endereco_completo: string | null;
  area_id: string | null;
  area_nome: string | null;
  area_cor: string | null;
  municipe_id: string | null;
  municipe_nome: string | null;
  municipe_telefone: string | null;
  responsavel_id: string | null;
  data_prazo: string | null;
  created_at: string | null;
  geocodificado: boolean;
  tipo: 'demanda';
}

export interface MunicipeMapa {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  bairro: string | null;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
  endereco_completo: string | null;
  tags: { id: string; nome: string; cor: string | null }[];
  categoria_id: string | null;
  demandas_count: number;
  geocodificado: boolean;
  tipo: 'municipe';
}

// Função para construir endereço completo
function buildFullAddress(
  logradouro?: string | null,
  numero?: string | null,
  bairro?: string | null,
  cidade?: string | null,
  cep?: string | null
): string {
  const parts: string[] = [];

  if (logradouro) {
    parts.push(logradouro);
    if (numero) {
      parts[parts.length - 1] += `, ${numero}`;
    }
  }

  if (bairro) parts.push(bairro);
  if (cidade) parts.push(cidade);
  if (cep) parts.push(cep);

  return parts.join(', ');
}

// Função para gerar cor consistente baseada em texto (Fallback)
function gerarCorPorTexto(texto: string): string {
  const cores = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return cores[Math.abs(hash) % cores.length];
}

// Função para validar coordenadas
function isValidCoordinate(lat: any, lng: any): boolean {
  const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
  const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  if (latNum === null || latNum === undefined || lngNum === null || lngNum === undefined) {
    return false;
  }
  
  if (isNaN(latNum) || isNaN(lngNum)) {
    return false;
  }
  
  // Verificar se não é zero
  if (latNum === 0 && lngNum === 0) {
    return false;
  }
  
  // Verificar se está dentro de limites razoáveis para o Brasil
  if (latNum < -35 || latNum > 6 || lngNum < -75 || lngNum > -30) {
    return false;
  }
  
  return true;
}

export function useMapaUnificado() {
  const [geocodificando, setGeocodificando] = useState(false);
  const [progressoGeocodificacao, setProgressoGeocodificacao] = useState({ atual: 0, total: 0 });

  // Buscar TODAS as áreas (Incluindo a cor)
  const { data: areas = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['mapa-areas-todas'],
    queryFn: async () => {
      console.log('🔄 [MAPA] Buscando todas as áreas...');
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome, descricao, cor')
        .order('nome');
      
      if (error) {
        console.error('❌ [MAPA] Erro ao buscar áreas:', error);
        return [];
      }
      
      const areasComCor = (data || []).map(area => ({
        ...area,
        // Usa a cor do banco ou gera uma se for null
        cor: area.cor || gerarCorPorTexto(area.nome)
      }));
      
      console.log(`✅ [MAPA] Áreas encontradas: ${areasComCor.length}`);
      return areasComCor as AreaMapa[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar TODAS as tags
  const { data: tags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['mapa-tags-todas'],
    queryFn: async () => {
      console.log('🔄 [MAPA] Buscando todas as tags...');
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) {
        console.error('❌ [MAPA] Erro ao buscar tags:', error);
        return [];
      }
      
      const tagsComCor = (data || []).map(tag => ({
        ...tag,
        cor: tag.cor || gerarCorPorTexto(tag.nome)
      }));
      
      console.log(`✅ [MAPA] Tags encontradas: ${tagsComCor.length}`);
      return tagsComCor as TagMapa[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar TODAS as categorias
  const { data: categorias = [], isLoading: isLoadingCategorias } = useQuery({
    queryKey: ['mapa-categorias-todas'],
    queryFn: async () => {
      console.log('🔄 [MAPA] Buscando todas as categorias...');
      const { data, error } = await supabase
        .from('municipe_categorias')
        .select('id, nome, cor, icone')
        .order('ordem');
      
      if (error) {
        console.error('❌ [MAPA] Erro ao buscar categorias:', error);
        return [];
      }
      
      console.log(`✅ [MAPA] Categorias encontradas: ${data?.length || 0}`);
      return (data || []) as CategoriaMapa[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar demandas
  const { 
    data: demandasRaw = [], 
    isLoading: isLoadingDemandas,
    refetch: refetchDemandas 
  } = useQuery({
    queryKey: ['mapa-demandas-todas'],
    queryFn: async () => {
      console.log('🔄 [MAPA] Buscando todas as demandas...');
      
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
          cep,
          area_id,
          municipe_id,
          responsavel_id,
          data_prazo,
          created_at,
          areas (id, nome, cor),
          municipes (id, nome, telefone, bairro, cidade, latitude, longitude)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [MAPA] Erro ao buscar demandas:', error);
        return [];
      }
      
      console.log(`📊 [MAPA] Demandas retornadas do banco: ${data?.length || 0}`);
      
      const processadas = (data || []).map(d => {
        // Tentar usar coordenadas da demanda, senão do munícipe
        let lat = d.latitude;
        let lng = d.longitude;
        
        // Se não tem coordenadas próprias, usar do munícipe
        if (!isValidCoordinate(lat, lng) && d.municipes) {
          lat = d.municipes.latitude;
          lng = d.municipes.longitude;
        }
        
        // Converter para número
        const latNum = typeof lat === 'string' ? parseFloat(lat) : (lat || null);
        const lngNum = typeof lng === 'string' ? parseFloat(lng) : (lng || null);
        
        // Determinar cor da área (Banco > Gerada > Fallback)
        let areaCor = null;
        if (d.areas) {
          areaCor = d.areas.cor || gerarCorPorTexto(d.areas.nome);
        }

        return {
          id: d.id,
          titulo: d.titulo,
          descricao: d.descricao,
          status: d.status,
          prioridade: d.prioridade,
          protocolo: d.protocolo,
          latitude: latNum,
          longitude: lngNum,
          bairro: d.bairro || d.municipes?.bairro || null,
          logradouro: d.logradouro || null,
          numero: d.numero,
          cidade: d.cidade || d.municipes?.cidade || null,
          cep: d.cep,
          endereco_completo: buildFullAddress(
            d.logradouro,
            d.numero,
            d.bairro || d.municipes?.bairro,
            d.cidade || d.municipes?.cidade,
            d.cep
          ),
          area_id: d.area_id,
          area_nome: d.areas?.nome || null,
          area_cor: areaCor,
          municipe_id: d.municipe_id,
          municipe_nome: d.municipes?.nome || null,
          municipe_telefone: d.municipes?.telefone || null,
          responsavel_id: d.responsavel_id,
          data_prazo: d.data_prazo,
          created_at: d.created_at,
          geocodificado: isValidCoordinate(latNum, lngNum),
          tipo: 'demanda' as const
        };
      });
      
      return processadas as DemandaMapa[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Buscar munícipes — com join para tags (query única ao invés de 3 sequenciais)
  const { 
    data: municipesRaw = [], 
    isLoading: isLoadingMunicipes,
    refetch: refetchMunicipes 
  } = useQuery({
    queryKey: ['mapa-municipes-todos'],
    queryFn: async () => {
      console.log('🔄 [MAPA] Buscando munícipes com tags (query única)...');
      
      // Query única com join — substitui 3 queries sequenciais
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          id,
          nome,
          telefone,
          email,
          latitude,
          longitude,
          bairro,
          endereco,
          cidade,
          cep,
          categoria_id,
          municipe_tags(
            tags(id, nome, cor)
          )
        `);
      
      if (error) {
        console.error('❌ [MAPA] Erro ao buscar munícipes:', error);
        return [];
      }
      
      if (!data || data.length === 0) return [];

      // Buscar contagem de demandas — query leve (só municipe_id)
      const { data: demandasCount } = await supabase
        .from('demandas')
        .select('municipe_id');
      
      const contagemDemandas: Record<string, number> = {};
      (demandasCount || []).forEach(d => {
        contagemDemandas[d.municipe_id] = (contagemDemandas[d.municipe_id] || 0) + 1;
      });
      
      const processados = data.map(m => {
        const latNum = typeof m.latitude === 'string' ? parseFloat(m.latitude) : (m.latitude || null);
        const lngNum = typeof m.longitude === 'string' ? parseFloat(m.longitude) : (m.longitude || null);
        
        // Extrair tags do join
        const tags = (m.municipe_tags || [])
          .filter((mt: any) => mt.tags)
          .map((mt: any) => ({
            id: mt.tags.id,
            nome: mt.tags.nome,
            cor: mt.tags.cor || gerarCorPorTexto(mt.tags.nome)
          }));
        
        return {
          id: m.id,
          nome: m.nome,
          telefone: m.telefone,
          email: m.email,
          latitude: latNum,
          longitude: lngNum,
          bairro: m.bairro,
          endereco: m.endereco,
          cidade: m.cidade,
          cep: m.cep,
          endereco_completo: buildFullAddress(
            m.endereco,
            null,
            m.bairro,
            m.cidade,
            m.cep
          ),
          tags,
          categoria_id: m.categoria_id || null,
          demandas_count: contagemDemandas[m.id] || 0,
          geocodificado: isValidCoordinate(latNum, lngNum),
          tipo: 'municipe' as const
        };
      });
      
      return processados as MunicipeMapa[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Filtrar apenas os que têm coordenadas válidas para exibição no mapa
  const demandas = demandasRaw.filter(d => isValidCoordinate(d.latitude, d.longitude));
  const municipes = municipesRaw.filter(m => isValidCoordinate(m.latitude, m.longitude));

  // Contar itens sem geocodificação
  const semCoordenadas = {
    demandas: demandasRaw.filter(d => !isValidCoordinate(d.latitude, d.longitude)).length,
    municipes: municipesRaw.filter(m => !isValidCoordinate(m.latitude, m.longitude)).length
  };

  // Função para geocodificar todos os registros sem coordenadas
  const geocodificarTodos = useCallback(async () => {
    const demandasSemCoord = demandasRaw.filter(d => !isValidCoordinate(d.latitude, d.longitude));
    const municipesSemCoord = municipesRaw.filter(m => !isValidCoordinate(m.latitude, m.longitude));
    
    const total = demandasSemCoord.length + municipesSemCoord.length;
    
    if (total === 0) {
      toast.info("Todos os registros já possuem coordenadas!");
      return;
    }

    setGeocodificando(true);
    setProgressoGeocodificacao({ atual: 0, total });
    
    let processados = 0;
    let sucesso = 0;
    let falhas = 0;

    toast.info(`Iniciando geocodificação de ${total} registros...`);

    // Geocodificar demandas
    for (const demanda of demandasSemCoord) {
      try {
        const logradouro = demanda.logradouro || '';
        const numero = demanda.numero || '';
        const bairro = demanda.bairro || '';
        const cidade = demanda.cidade || 'São Paulo';
        const estado = 'SP'; 

        if (logradouro || bairro) {
          const coord = await geocodificarEndereco(logradouro, numero, bairro, cidade, estado);

          if (coord) {
            const { error } = await supabase
              .from('demandas')
              .update({
                latitude: coord.latitude,
                longitude: coord.longitude,
                geocodificado: true
              })
              .eq('id', demanda.id);

            if (!error) sucesso++;
            else falhas++;
          } else falhas++;
        } else falhas++;

        processados++;
        setProgressoGeocodificacao({ atual: processados, total });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        falhas++;
        processados++;
        setProgressoGeocodificacao({ atual: processados, total });
      }
    }

    // Geocodificar munícipes
    for (const municipe of municipesSemCoord) {
      try {
        const enderecoCompleto = municipe.endereco || '';
        const bairro = municipe.bairro || '';
        const cidade = municipe.cidade || 'São Paulo';
        const estado = 'SP';

        const matchNumero = enderecoCompleto.match(/,?\s*(\d+)\s*$/);
        const numero = matchNumero ? matchNumero[1] : '';
        const logradouro = matchNumero 
          ? enderecoCompleto.replace(/,?\s*\d+\s*$/, '').trim()
          : enderecoCompleto;

        if (logradouro || bairro) {
          const coord = await geocodificarEndereco(logradouro, numero, bairro, cidade, estado);

          if (coord) {
            const { error } = await supabase
              .from('municipes')
              .update({
                latitude: coord.latitude,
                longitude: coord.longitude,
                geocodificado: true
              })
              .eq('id', municipe.id);

            if (!error) sucesso++;
            else falhas++;
          } else falhas++;
        } else falhas++;

        processados++;
        setProgressoGeocodificacao({ atual: processados, total });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        falhas++;
        processados++;
        setProgressoGeocodificacao({ atual: processados, total });
      }
    }

    setGeocodificando(false);
    
    await refetchDemandas();
    await refetchMunicipes();

    if (sucesso > 0) toast.success(`Geocodificação concluída! ${sucesso} registros atualizados.`);
    if (falhas > 0) toast.warning(`${falhas} registros não puderam ser geocodificados.`);
  }, [demandasRaw, municipesRaw, refetchDemandas, refetchMunicipes]);

  // Bairros únicos
  const bairrosUnicos = Array.from(new Set([
    ...demandasRaw.map(d => d.bairro).filter(Boolean) as string[],
    ...municipesRaw.map(m => m.bairro).filter(Boolean) as string[]
  ])).sort();

  return {
    areas,
    tags,
    categorias,
    demandas,
    municipes,
    demandasRaw,
    municipesRaw,
    bairrosUnicos,
    semCoordenadas,
    isLoading: isLoadingAreas || isLoadingTags || isLoadingCategorias || isLoadingDemandas || isLoadingMunicipes,
    geocodificando,
    progressoGeocodificacao,
    geocodificarTodos,
    refetch: async () => {
      await refetchDemandas();
      await refetchMunicipes();
    }
  };
}
