import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook centralizado para carregamento de munícipes em formulários
export function useMunicipesSelect() {
  return useQuery({
    queryKey: ['municipes-select-optimized'],
    queryFn: async () => {
      console.log('🔄 Shared Hook: Carregando munícipes para formulários...');
      
      // Carregar TODOS os munícipes sem limite
      console.log('🔄 Shared Hook: Buscando TODOS os munícipes sem limitação...');
      
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome')
        .order('nome');
        
      if (error) {
        console.error('❌ Shared Hook: Erro ao buscar munícipes:', error);
        throw error;
      }
      
      console.log(`✅ Shared Hook: ${data?.length || 0} munícipes carregados para formulários`);
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter cache por 10 minutos (nova API do TanStack Query v5)
  });
}