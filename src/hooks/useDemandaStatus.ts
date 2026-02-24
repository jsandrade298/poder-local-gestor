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
  is_final: boolean;  // ← novo: indica que este status representa conclusão
  created_at: string;
  updated_at: string;
}

export function useDemandaStatus() {
  const queryClient = useQueryClient();

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
    staleTime: 1000 * 60 * 5,
  });

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

  // Slugs que representam conclusão (derivados dos dados reais — sem hard-code)
  const finalSlugs = statusList.filter(s => s.is_final).map(s => s.slug);

  const createStatus = useMutation({
    mutationFn: async (newStatus: Partial<DemandaStatus>) => {
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
          is_final: newStatus.is_final ?? false,
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
      if (error.code === '23505') toast.error('Já existe um status com este identificador');
      else toast.error('Erro ao criar status: ' + error.message);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DemandaStatus> & { id: string }) => {
      const { data, error } = await supabase
        .from('demanda_status')
        .update({ ...updates, updated_at: new Date().toISOString() })
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
    onError: (error: any) => toast.error('Erro ao atualizar status: ' + error.message),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
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
      const { error } = await supabase.from('demanda_status').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao excluir status'),
  });

  const reorderStatus = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (const [index, id] of orderedIds.entries()) {
        const { error } = await supabase
          .from('demanda_status')
          .update({ ordem: index + 1 })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Ordem dos status atualizada!');
      queryClient.invalidateQueries({ queryKey: ['demanda-status'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-status-all'] });
    },
    onError: (error: any) => toast.error('Erro ao reordenar status: ' + error.message),
  });

  const getStatusBySlug = (slug: string) => statusList.find(s => s.slug === slug);
  const getStatusLabel = (slug: string) => getStatusBySlug(slug)?.nome || slug;
  const getStatusColor = (slug: string) => getStatusBySlug(slug)?.cor || '#6b7280';
  const shouldNotify = (slug: string) => getStatusBySlug(slug)?.notificar_municipe ?? false;
  const isFinal = (slug: string) => getStatusBySlug(slug)?.is_final ?? false;

  const statusOptions = statusList.map(s => ({ value: s.slug, label: s.nome, cor: s.cor }));

  return {
    statusList, allStatusList, statusOptions, finalSlugs,
    isLoading, isLoadingAll, error,
    createStatus, updateStatus, deleteStatus, reorderStatus,
    getStatusBySlug, getStatusLabel, getStatusColor, shouldNotify, isFinal,
  };
}
