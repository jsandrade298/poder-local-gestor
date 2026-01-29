import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CamadaGeografica {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  cor_padrao: string;
  opacidade: number;
  visivel: boolean;
  geojson: any;
  propriedades?: any;
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

  // Buscar todas as camadas
  const { data: camadas = [], isLoading, error } = useQuery({
    queryKey: ['camadas-geograficas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('camadas_geograficas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CamadaGeografica[];
    }
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
      toast.error('Erro ao importar camada: ' + (error.message || 'Erro desconhecido'));
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

  // Camadas visíveis para renderização
  const camadasVisiveis = camadas.filter(c => c.visivel);

  return {
    camadas,
    camadasVisiveis,
    isLoading,
    error,
    adicionarCamada,
    toggleVisibilidade,
    atualizarCor,
    atualizarOpacidade,
    removerCamada
  };
}
