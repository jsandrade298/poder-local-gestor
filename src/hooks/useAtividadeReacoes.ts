import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AtividadeReacao {
  id: string;
  atividade_id: string;
  user_id: string;
  tipo: string;
  created_at: string;
  user_nome?: string;
}

/**
 * Hook que carrega todas as reações das atividades de uma demanda
 * e oferece toggle para o usuário atual reagir/desreagir.
 *
 * Uso:
 *   const { reacoesPorAtividade, toggle, isToggling } = useAtividadeReacoes(demandaId);
 *   const reacoesDaAtividade = reacoesPorAtividade[atividadeId] || [];
 */
export function useAtividadeReacoes(demandaId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: reacoes = [], isLoading } = useQuery({
    queryKey: ['atividade-reacoes', demandaId],
    queryFn: async () => {
      if (!demandaId) return [];

      // Busca os IDs das atividades desta demanda
      const { data: atividades, error: atvErr } = await supabase
        .from('demanda_atividades')
        .select('id')
        .eq('demanda_id', demandaId);
      if (atvErr) throw atvErr;
      const atividadeIds = (atividades || []).map((a: any) => a.id);
      if (atividadeIds.length === 0) return [];

      // Busca as reações
      const { data: reacoesRaw, error } = await supabase
        .from('atividade_reacoes')
        .select('id, atividade_id, user_id, tipo, created_at')
        .in('atividade_id', atividadeIds);
      if (error) throw error;

      // Busca os nomes dos usuários que reagiram
      const userIds = Array.from(new Set((reacoesRaw || []).map((r: any) => r.user_id)));
      let perfis: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', userIds);
        perfis = Object.fromEntries((profilesData || []).map((p: any) => [p.id, p.nome]));
      }

      return (reacoesRaw || []).map((r: any) => ({
        ...r,
        user_nome: perfis[r.user_id] || 'Usuário',
      })) as AtividadeReacao[];
    },
    enabled: !!demandaId,
  });

  // Agrupa reações por atividade para consumo fácil no UI
  const reacoesPorAtividade: Record<string, AtividadeReacao[]> = {};
  reacoes.forEach((r) => {
    if (!reacoesPorAtividade[r.atividade_id]) reacoesPorAtividade[r.atividade_id] = [];
    reacoesPorAtividade[r.atividade_id].push(r);
  });

  /** Toggle: cria se não existir, deleta se já existe (do usuário atual) */
  const toggle = useMutation({
    mutationFn: async ({ atividadeId, tipo = 'joinha' }: { atividadeId: string; tipo?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado');

      // Verifica se já existe
      const existente = reacoes.find(
        (r) => r.atividade_id === atividadeId && r.user_id === userId && r.tipo === tipo
      );

      if (existente) {
        // Remove
        const { error } = await supabase
          .from('atividade_reacoes')
          .delete()
          .eq('id', existente.id);
        if (error) throw error;
        return { action: 'removed' as const };
      } else {
        // Cria
        const { error } = await supabase
          .from('atividade_reacoes')
          .insert({ atividade_id: atividadeId, user_id: userId, tipo });
        if (error) throw error;
        return { action: 'added' as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividade-reacoes', demandaId] });
    },
    onError: (error: any) => {
      toast.error('Erro ao reagir: ' + error.message);
    },
  });

  return {
    reacoes,
    reacoesPorAtividade,
    isLoading,
    toggle: (atividadeId: string, tipo: string = 'joinha') =>
      toggle.mutate({ atividadeId, tipo }),
    isToggling: toggle.isPending,
  };
}
