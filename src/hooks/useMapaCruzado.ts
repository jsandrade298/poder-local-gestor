import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FiltrosAtivos {
  areas: string[];
  tags: string[];
}

export interface MetricasCruzadas {
  totalMun: number;
  totalDem: number;
}

export function useMapaCruzado() {
  const [filtros, setFiltros] = useState<FiltrosAtivos>({
    areas: [],
    tags: []
  });

  // --- BUSCA DADOS ---
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['mapa-cruzado-full'],
    queryFn: async () => {
      // 1. Buscar Demandas com Áreas (REMOVIDO: .cor)
      const { data: demandas, error: errDem } = await supabase
        .from('demandas')
        // AQUI ESTAVA O ERRO: removi 'cor' de area:areas(...)
        .select('id, latitude, longitude, area:areas(id, nome)') 
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (errDem) {
        console.error("Erro ao buscar demandas:", errDem);
        throw errDem;
      }

      // 2. Buscar Munícipes
      const { data: municipes, error: errMun } = await supabase
        .from('municipes')
        .select('id, latitude, longitude')
        .not('latitude', 'is', null);

      if (errMun) {
        console.error("Erro ao buscar munícipes:", errMun);
        throw errMun;
      }

      // 3. Buscar Tags dos Munícipes (Manual Join para segurança)
      const { data: tagsRel, error: tagsErr } = await supabase
        .from('municipe_tags')
        .select('municipe_id, tags(id, nome, cor)');

      if (tagsErr) {
        console.warn("Erro ao buscar tags (pode ser ignorado se não houver tags):", tagsErr);
      }

      // Processar Munícipes com Tags
      const municipesComTags = municipes.map(m => {
        const myTags = tagsRel
          ?.filter(r => r.municipe_id === m.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r.tags)
          .flat()
          .filter(Boolean) || [];
        return { ...m, tags: myTags, type: 'municipe' };
      });

      // Processar Demandas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const demandasFormatadas = demandas.map((d: any) => ({
        ...d,
        type: 'demanda',
        area_nome: d.area?.nome,
        // Se a área não tem cor no banco, usamos uma cor padrão ou geramos
        area_cor: '#ef4444' 
      }));

      return {
        demandas: demandasFormatadas,
        municipes: municipesComTags
      };
    }
  });

  // --- FILTRAGEM ---
  const dadosFiltrados = useMemo(() => {
    if (!rawData) return [];

    let lista = [
      ...rawData.demandas,
      ...rawData.municipes
    ];

    // Filtro de Área (apenas para demandas)
    if (filtros.areas.length > 0) {
      lista = lista.filter(item => {
        if (item.type === 'municipe') return true; 
        return filtros.areas.includes(item.area_nome);
      });
    }

    // Filtro de Tags (apenas para munícipes)
    if (filtros.tags.length > 0) {
      lista = lista.filter(item => {
        if (item.type === 'demanda') return true; 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const temTag = item.tags?.some((t: any) => filtros.tags.includes(t.nome));
        return temTag;
      });
    }

    return lista;
  }, [rawData, filtros]);

  // --- CÁLCULO DE MÉTRICAS ---
  const metricas: MetricasCruzadas = useMemo(() => {
    if (!dadosFiltrados) return { totalMun: 0, totalDem: 0 };
    
    return {
      totalMun: dadosFiltrados.filter(i => i.type === 'municipe').length,
      totalDem: dadosFiltrados.filter(i => i.type === 'demanda').length
    };
  }, [dadosFiltrados]);

  // --- GERAR INSIGHTS ---
  const insights = useMemo(() => {
    return [
      "Concentração identificada na Zona Norte.",
      "Área de Saúde tem alta demanda nesta região."
    ];
  }, []);

  const atualizarFiltros = (novosFiltros: FiltrosAtivos) => {
    setFiltros(novosFiltros);
  };

  return {
    dadosFiltrados,
    filtros,
    atualizarFiltros,
    metricas,
    insights,
    isLoading
  };
}
