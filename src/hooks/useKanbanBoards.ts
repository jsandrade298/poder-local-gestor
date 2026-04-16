import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface KanbanBoard {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  criado_por: string;
  created_at: string;
  updated_at: string;
  arquivado_em: string | null;
  // Agregados (calculados no front)
  colunas_count?: number;
  cards_count?: number;
  criador_nome?: string;
}

export interface KanbanBoardColuna {
  id: string;
  tenant_id: string;
  board_id: string;
  nome: string;
  slug: string;
  cor: string;
  ordem: number;
  arquivada: boolean;
  created_at: string;
}

export interface KanbanBoardCard {
  id: string;
  tenant_id: string;
  board_id: string;
  coluna_id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  prioridade: string;
  cor: string | null;
  data_prazo: string | null;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  arquivado_em: string | null;
  // Joins
  responsavel?: { id: string; nome: string } | null;
  criador?: { id: string; nome: string } | null;
}

// ── Hook: listar boards ────────────────────────────────────────

export function useKanbanBoards() {
  const queryClient = useQueryClient();

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ['kanban-boards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select(`
          *,
          criador:profiles!kanban_boards_criado_por_fkey(id, nome)
        `)
        .is('arquivado_em', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      // Buscar contagens
      const boardIds = (data || []).map((b: any) => b.id);
      if (boardIds.length === 0) return [];

      const { data: colunasCount } = await supabase
        .from('kanban_board_colunas')
        .select('board_id')
        .in('board_id', boardIds)
        .eq('arquivada', false);

      const { data: cardsCount } = await supabase
        .from('kanban_board_cards')
        .select('board_id')
        .in('board_id', boardIds)
        .is('arquivado_em', null);

      const colunasMap: Record<string, number> = {};
      (colunasCount || []).forEach((c: any) => {
        colunasMap[c.board_id] = (colunasMap[c.board_id] || 0) + 1;
      });

      const cardsMap: Record<string, number> = {};
      (cardsCount || []).forEach((c: any) => {
        cardsMap[c.board_id] = (cardsMap[c.board_id] || 0) + 1;
      });

      return (data || []).map((b: any) => ({
        ...b,
        criador_nome: b.criador?.nome || 'Usuário',
        colunas_count: colunasMap[b.id] || 0,
        cards_count: cardsMap[b.id] || 0,
      })) as KanbanBoard[];
    },
    staleTime: 60_000,
  });

  const createBoard = useMutation({
    mutationFn: async (board: { nome: string; descricao?: string; cor: string; icone: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Criar board
      const { data, error } = await supabase
        .from('kanban_boards')
        .insert({
          nome: board.nome,
          descricao: board.descricao || null,
          cor: board.cor,
          icone: board.icone,
          criado_por: user.user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Criar 3 colunas padrão
      const colunasDefault = [
        { nome: 'A Fazer', slug: 'a_fazer', cor: '#3b82f6', ordem: 1 },
        { nome: 'Em Progresso', slug: 'em_progresso', cor: '#f59e0b', ordem: 2 },
        { nome: 'Concluído', slug: 'concluido', cor: '#22c55e', ordem: 3 },
      ];
      const { error: colError } = await supabase
        .from('kanban_board_colunas')
        .insert(colunasDefault.map(c => ({ ...c, board_id: data.id })));
      if (colError) throw colError;

      return data;
    },
    onSuccess: () => {
      toast.success('Board criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao criar board: ' + err.message),
  });

  const updateBoard = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KanbanBoard> & { id: string }) => {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Board atualizado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar board: ' + err.message),
  });

  const archiveBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ arquivado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Board arquivado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao arquivar board: ' + err.message),
  });

  return { boards, isLoading, createBoard, updateBoard, archiveBoard };
}

// ── Hook: colunas de um board ──────────────────────────────────

export function useKanbanBoardColunas(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: colunas = [], isLoading } = useQuery({
    queryKey: ['kanban-board-colunas', boardId],
    queryFn: async () => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from('kanban_board_colunas')
        .select('*')
        .eq('board_id', boardId)
        .eq('arquivada', false)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanBoardColuna[];
    },
    enabled: !!boardId,
    staleTime: 60_000,
  });

  const createColuna = useMutation({
    mutationFn: async (coluna: { nome: string; cor: string }) => {
      if (!boardId) throw new Error('Board não selecionado');
      const maxOrdem = Math.max(...colunas.map(c => c.ordem), 0);
      const slug = coluna.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const { error } = await supabase
        .from('kanban_board_colunas')
        .insert({ board_id: boardId, nome: coluna.nome, slug, cor: coluna.cor, ordem: maxOrdem + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coluna criada!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-colunas', boardId] });
    },
    onError: (err: any) => toast.error('Erro ao criar coluna: ' + err.message),
  });

  const updateColuna = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KanbanBoardColuna> & { id: string }) => {
      const { error } = await supabase
        .from('kanban_board_colunas')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-colunas', boardId] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar coluna: ' + err.message),
  });

  const archiveColuna = useMutation({
    mutationFn: async (id: string) => {
      // Verificar se tem cards
      const { count } = await supabase
        .from('kanban_board_cards')
        .select('*', { count: 'exact', head: true })
        .eq('coluna_id', id)
        .is('arquivado_em', null);
      if (count && count > 0) {
        throw new Error(`Mova ou arquive os ${count} card(s) desta coluna antes de removê-la.`);
      }
      const { error } = await supabase
        .from('kanban_board_colunas')
        .update({ arquivada: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coluna removida!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-colunas', boardId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reorderColunas = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (const [i, id] of orderedIds.entries()) {
        const { error } = await supabase
          .from('kanban_board_colunas')
          .update({ ordem: i + 1 })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-colunas', boardId] });
    },
    onError: (err: any) => toast.error('Erro ao reordenar: ' + err.message),
  });

  return { colunas, isLoading, createColuna, updateColuna, archiveColuna, reorderColunas };
}

// ── Hook: cards de um board ────────────────────────────────────

export function useKanbanBoardCards(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['kanban-board-cards', boardId],
    queryFn: async () => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from('kanban_board_cards')
        .select(`
          *,
          responsavel:profiles!kanban_board_cards_responsavel_id_fkey(id, nome),
          criador:profiles!kanban_board_cards_created_by_fkey(id, nome)
        `)
        .eq('board_id', boardId)
        .is('arquivado_em', null)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanBoardCard[];
    },
    enabled: !!boardId,
    staleTime: 30_000,
  });

  const createCard = useMutation({
    mutationFn: async (card: {
      coluna_id: string;
      titulo: string;
      descricao?: string;
      responsavel_id?: string;
      prioridade?: string;
      cor?: string;
      data_prazo?: string;
    }) => {
      if (!boardId) throw new Error('Board não selecionado');
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Ordem: próximo da coluna
      const maxOrdem = Math.max(
        ...cards.filter(c => c.coluna_id === card.coluna_id).map(c => c.ordem),
        0
      );

      const { error } = await supabase
        .from('kanban_board_cards')
        .insert({
          board_id: boardId,
          coluna_id: card.coluna_id,
          titulo: card.titulo,
          descricao: card.descricao || null,
          responsavel_id: card.responsavel_id || null,
          prioridade: card.prioridade || 'media',
          cor: card.cor || '#3b82f6',
          data_prazo: card.data_prazo || null,
          ordem: maxOrdem + 1,
          created_by: user.user.id,
        });
      if (error) throw error;

      // Atualizar updated_at do board
      await supabase.from('kanban_boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
    },
    onSuccess: () => {
      toast.success('Card criado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao criar card: ' + err.message),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KanbanBoardCard> & { id: string }) => {
      const { error } = await supabase
        .from('kanban_board_cards')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      if (boardId) {
        await supabase.from('kanban_boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar card: ' + err.message),
  });

  const moveCard = useMutation({
    mutationFn: async ({ cardId, colunaId, ordem }: { cardId: string; colunaId: string; ordem: number }) => {
      const { error } = await supabase
        .from('kanban_board_cards')
        .update({ coluna_id: colunaId, ordem, updated_at: new Date().toISOString() })
        .eq('id', cardId);
      if (error) throw error;

      if (boardId) {
        await supabase.from('kanban_boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
    },
    onError: (err: any) => toast.error('Erro ao mover card: ' + err.message),
  });

  const archiveCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kanban_board_cards')
        .update({ arquivado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Card arquivado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao arquivar card: ' + err.message),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kanban_board_cards')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Card excluído!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao excluir card: ' + err.message),
  });

  return { cards, isLoading, createCard, updateCard, moveCard, archiveCard, deleteCard };
}
