import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook centralizado para carregamento de munícipes em formulários
export function useMunicipesSelect() {
  return useQuery({
    queryKey: ['municipes-select-optimized'],
    queryFn: async () => {
      console.log('🔄 Shared Hook: Carregando TODOS os munícipes em lotes...');
      
      let allMunicipes: Array<{ id: string; nome: string }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📦 Carregando lote ${Math.floor(from / pageSize) + 1} (registros ${from + 1}-${from + pageSize})...`);
        
        const { data, error } = await supabase
          .from('municipes')
          .select('id, nome')
          .order('nome')
          .range(from, from + pageSize - 1);
          
        if (error) {
          console.error('❌ Shared Hook: Erro ao buscar munícipes:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          console.log(`✅ Lote carregado: ${data.length} munícipes (total: ${allMunicipes.length})`);
          
          // Se retornou menos que o pageSize, chegamos ao fim
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`🎯 Total final: ${allMunicipes.length} munícipes carregados em lotes`);
      return allMunicipes;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter cache por 10 minutos (nova API do TanStack Query v5)
  });
}