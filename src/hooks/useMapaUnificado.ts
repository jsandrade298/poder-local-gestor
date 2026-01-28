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
export function useMapaUnificado() {
  // --- BUSCA DEMANDAS (Com Áreas) ---
  const { data: demandas = [], isLoading: isLoadingDemandas, refetch: refetchDemandas } = useQuery({
    queryKey: ['demandas-mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          area:areas (
            id,
            nome
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) {
        console.error('Erro ao buscar demandas:', error);
        throw error;
      }
      return data;
    },
  });

  // --- BUSCA MUNÍCIPES (Com estratégia de falha segura para Tags) ---
  const { data: municipes = [], isLoading: isLoadingMunicipes, refetch: refetchMunicipes } = useQuery({
    queryKey: ['municipes-mapa'],
    queryFn: async () => {
      // 1. Busca dados principais (CRÍTICO: Isso garante que o munícipe apareça no mapa)
      const { data: municipesData, error: munError } = await supabase
        .from('municipes')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (munError) {
        console.error('Erro crítico ao buscar munícipes:', munError);
        throw munError;
      }

      // 2. Busca relacionamento de Tags separadamente
      // Se a tabela 'municipe_tags' não existir ou der erro, o código captura e segue sem tags.
      try {
        const { data: tagsRelation, error: tagsError } = await supabase
          .from('municipe_tags') // Nome padrão da tabela pivô
          .select(`
            municipe_id,
            tags (
              id,
              nome,
              cor
            )
          `);

        if (tagsError) {
          console.warn("Aviso: Não foi possível carregar as tags (verifique se a tabela 'municipe_tags' existe).", tagsError);
          return municipesData; // Retorna munícipes sem tags para não quebrar o mapa
        }

        // 3. Mescla as tags nos munícipes manualmente
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const municipesWithTags = municipesData.map((m: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const myTags = tagsRelation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((r: any) => r.municipe_id === m.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((r: any) => r.tags)
            .flat()
            .filter(Boolean); // Remove nulos caso existam
          
          return { ...m, tags: myTags };
        });

        return municipesWithTags;

      } catch (error) {
        console.error("Erro ao processar tags:", error);
        return municipesData; // Fallback de segurança
      }
    },
  });

  return {
    demandas,
    municipes,
    isLoading: isLoadingDemandas || isLoadingMunicipes,
    refetch: () => {
      refetchDemandas();
      refetchMunicipes();
    }
  };
}
