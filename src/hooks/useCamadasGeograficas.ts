import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EstiloContorno = 'solido' | 'tracado' | 'pontilhado';

export interface CamadaEstiloVisual {
  preenchimento?: boolean;       // true = preenche, false = só contorno
  estilo_contorno?: EstiloContorno; // tipo de traçado da borda
  espessura_contorno?: number;   // peso da linha (default 1)
}

export interface CamadaGeografica {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  cor_padrao: string;
  opacidade: number;
  visivel: boolean;
  geojson: any;
  propriedades?: CamadaEstiloVisual & Record<string, any>;
  created_at: string;
  created_by?: string;
}

export interface NovaCamada {
  nome: string;
  descricao?: string;
  tipo: string;
  cor_padrao: string;
  opacidade: number;
  visivel: boolean;
  geojson: any;
  propriedades?: any;
}

export function useCamadasGeograficas() {
  const queryClient = useQueryClient();

  // Buscar todas as camadas - com tratamento de erro para tabela inexistente
  const { data: camadas = [], isLoading, error } = useQuery({
    queryKey: ['camadas-geograficas'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('camadas_geograficas')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Se a tabela não existir, retornar array vazio
        if (error) {
          console.warn('Tabela camadas_geograficas não encontrada ou erro:', error.message);
          return [];
        }
        
        return (data || []) as CamadaGeografica[];
      } catch (err) {
        console.warn('Erro ao buscar camadas geográficas:', err);
        return [];
      }
    },
    // Não mostrar erro se a tabela não existir
    retry: false,
    // Retornar array vazio em caso de erro
    placeholderData: []
  });

  // Adicionar nova camada
  const adicionarCamada = useMutation({
    mutationFn: async (camada: NovaCamada) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('camadas_geograficas')
        .insert({
          ...camada,
          created_by: user?.user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
      toast.success('Camada importada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao adicionar camada:', error);
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        toast.error('Tabela de camadas não configurada. Execute o SQL no Supabase.');
      } else {
        toast.error('Erro ao importar camada: ' + (error.message || 'Erro desconhecido'));
      }
    }
  });

  // Atualizar visibilidade
  const toggleVisibilidade = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      const { error } = await supabase
        .from('camadas_geograficas')
        .update({ visivel })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar visibilidade:', error);
      toast.error('Erro ao atualizar camada');
    }
  });

  // Atualizar cor
  const atualizarCor = useMutation({
    mutationFn: async ({ id, cor }: { id: string; cor: string }) => {
      const { error } = await supabase
        .from('camadas_geograficas')
        .update({ cor_padrao: cor })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar cor:', error);
      toast.error('Erro ao atualizar cor da camada');
    }
  });

  // Atualizar opacidade
  const atualizarOpacidade = useMutation({
    mutationFn: async ({ id, opacidade }: { id: string; opacidade: number }) => {
      const { error } = await supabase
        .from('camadas_geograficas')
        .update({ opacidade })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar opacidade:', error);
      toast.error('Erro ao atualizar opacidade da camada');
    }
  });

  // Atualizar propriedades visuais (preenchimento, estilo de contorno, etc.)
  const atualizarPropriedades = useMutation({
    mutationFn: async ({ id, propriedades }: { id: string; propriedades: Partial<CamadaEstiloVisual> }) => {
      // Buscar propriedades atuais para fazer merge
      const camadaAtual = camadas.find(c => c.id === id);
      const propsAtuais = camadaAtual?.propriedades || {};
      const novasProps = { ...propsAtuais, ...propriedades };

      const { error } = await supabase
        .from('camadas_geograficas')
        .update({ propriedades: novasProps })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar propriedades:', error);
      toast.error('Erro ao atualizar propriedades da camada');
    }
  });

  // Remover camada
  const removerCamada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('camadas_geograficas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camadas-geograficas'] });
      toast.success('Camada removida com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao remover camada:', error);
      toast.error('Erro ao remover camada');
    }
  });

  // Camadas visíveis para renderização (com fallback seguro)
  const camadasVisiveis = Array.isArray(camadas) ? camadas.filter(c => c.visivel) : [];

  return {
    camadas: Array.isArray(camadas) ? camadas : [],
    camadasVisiveis,
    isLoading,
    error,
    adicionarCamada,
    toggleVisibilidade,
    atualizarCor,
    atualizarOpacidade,
    atualizarPropriedades,
    removerCamada
  };
}
