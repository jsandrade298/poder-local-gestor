import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DemandaStatus {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  notificar_municipe: boolean;
  created_at: string;
  updated_at: string;
}

export function useDemandaStatus() {
  const queryClient = useQueryClient();

  // Buscar todos os status ativos
  const { data: statusList = [], isLoading, error } = useQuery({
    queryKey: ['demanda-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demanda_status')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as DemandaStatus[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  // Buscar todos os status (incluindo inativos) - para configuração
  const { data: allStatusList = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['demanda-status-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demanda_status')
        .select('*')
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as DemandaStatus[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Criar novo status
  const createStatus = useMutation({
    mutationFn: async (newStatus: Partial<DemandaStatus>) => {
      // Obter a maior ordem atual
      const maxOrdem = Math.max(...allStatusList.map(s => s.ordem), 0);
      
      const { data, error } = await supabase
        .from('demanda_status')
        .insert({
          nome: newStatus.nome,
          slug: newStatus.slug || newStatus.nome?.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
          cor: newStatus.cor || '#6b7280',
          icone: newStatus.icone || 'circle',
          ordem: newStatus.ordem ?? maxOrdem + 1,
          ativo: newStatus.ativo ?? true,
          notificar_municipe: newStatus.notificar_municipe ?? false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Status criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um status com este identificador');
      } else {
        toast.error('Erro ao criar status: ' + error.message);
      }
    },
  });

  // Atualizar status
  const updateStatus = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DemandaStatus> & { id: string }) => {
      const { data, error } = await supabase
        .from('demanda_status')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Status atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  // Deletar status
  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      // Verificar se existem demandas com este status
      const status = allStatusList.find(s => s.id === id);
      if (status) {
        const { count } = await supabase
          .from('demandas')
          .select('*', { count: 'exact', head: true })
          .eq('status', status.slug);
        
        if (count && count > 0) {
          throw new Error(`Existem ${count} demanda(s) com este status. Altere o status dessas demandas antes de excluir.`);
        }
      }

      const { error } = await supabase
        .from('demanda_status')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir status');
    },
  });

  // Reordenar status
  const reorderStatus = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        ordem: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('demanda_status')
          .update({ ordem: update.ordem })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Ordem dos status atualizada!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao reordenar status: ' + error.message);
    },
  });

  // Funções auxiliares
  const getStatusBySlug = (slug: string): DemandaStatus | undefined => {
    return statusList.find(s => s.slug === slug);
  };

  const getStatusLabel = (slug: string): string => {
    const status = getStatusBySlug(slug);
    return status?.nome || slug;
  };

  const getStatusColor = (slug: string): string => {
    const status = getStatusBySlug(slug);
    return status?.cor || '#6b7280';
  };

  const shouldNotify = (slug: string): boolean => {
    const status = getStatusBySlug(slug);
    return status?.notificar_municipe ?? false;
  };

  // Opções para Select components
  const statusOptions = statusList.map(s => ({
    value: s.slug,
    label: s.nome,
    cor: s.cor,
  }));

  return {
    // Data
    statusList,
    allStatusList,
    statusOptions,
    
    // Loading states
    isLoading,
    isLoadingAll,
    error,
    
    // Mutations
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatus,
    
    // Helpers
    getStatusBySlug,
    getStatusLabel,
    getStatusColor,
    shouldNotify,
  };
}
