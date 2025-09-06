import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook centralizado para carregamento de munícipes em formulários
export function useMunicipesSelect() {
  return useQuery({
    queryKey: ['municipes-select-optimized'],
    queryFn: async () => {
      console.log('🔄 Shared Hook: Carregando munícipes para formulários...');
      
      // Carregar em lotes para garantir que pega todos os munícipes
      const BATCH_SIZE = 1000;
      let allMunicipes: any[] = [];
      let hasMore = true;
      let offset = 0;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('municipes')
          .select('id, nome')
          .order('nome')
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
          console.error('❌ Shared Hook: Erro ao buscar munícipes:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          offset += BATCH_SIZE;
          
          // Se retornou menos que o tamanho do lote, não há mais dados
          hasMore = data.length === BATCH_SIZE;
          
          console.log(`📦 Shared Hook: Lote carregado - ${data.length} munícipes (total: ${allMunicipes.length})`);
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Shared Hook: ${allMunicipes.length} munícipes carregados para formulários`);
      return allMunicipes;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter cache por 10 minutos (nova API do TanStack Query v5)
  });
}