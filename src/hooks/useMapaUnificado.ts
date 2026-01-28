import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMapaUnificado() {
  const { data: demandas = [], isLoading: isLoadingDemandas, refetch: refetchDemandas } = useQuery({
    queryKey: ['demandas-mapa'],
    queryFn: async () => {
      // AQUI ESTÁ O FIX: Adicionamos "area:areas(id, nome)" para popular o objeto area
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

  const { data: municipes = [], isLoading: isLoadingMunicipes, refetch: refetchMunicipes } = useQuery({
    queryKey: ['municipes-mapa'],
    queryFn: async () => {
      // Tentamos buscar tags também, caso seja uma relação
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          *,
          tags (
            id,
            nome,
            cor
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) {
        console.error('Erro ao buscar munícipes:', error);
        throw error;
      }
      return data;
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
