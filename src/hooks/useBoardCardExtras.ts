import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface BoardCardChecklistItem {
  id: string;
  card_id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export interface BoardCardComentario {
  id: string;
  card_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
  autor?: { id: string; nome: string } | null;
}

// ── Hook: Checklist ────────────────────────────────────────────

export function useBoardCardChecklist(cardId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['board-card-checklist', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('kanban_board_card_checklist')
        .select('*')
        .eq('card_id', cardId)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as BoardCardChecklistItem[];
    },
    enabled: !!cardId,
  });

  const addItem = useMutation({
    mutationFn: async (texto: string) => {
      if (!cardId) throw new Error('Card não selecionado');
      const maxOrdem = items.length > 0 ? Math.max(...items.map(i => i.ordem)) : -1;
      const { error } = await supabase
        .from('kanban_board_card_checklist')
        .insert({ card_id: cardId, texto, ordem: maxOrdem + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-card-checklist', cardId] });
      queryClient.invalidateQueries({ queryKey: ['board-card-counts'] });
    },
    onError: (err: any) => toast.error('Erro ao adicionar item: ' + err.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, concluido }: { itemId: string; concluido: boolean }) => {
      const { error } = await supabase
        .from('kanban_board_card_checklist')
        .update({ concluido, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-card-checklist', cardId] });
      queryClient.invalidateQueries({ queryKey: ['board-card-counts'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('kanban_board_card_checklist')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-card-checklist', cardId] });
      queryClient.invalidateQueries({ queryKey: ['board-card-counts'] });
    },
  });

  const total = items.length;
  const done = items.filter(i => i.concluido).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { items, isLoading, addItem, toggleItem, deleteItem, total, done, percent };
}

// ── Hook: Comentários ──────────────────────────────────────────

export function useBoardCardComentarios(cardId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey: ['board-card-comentarios', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('kanban_board_card_comentarios')
        .select(`
          *,
          autor:profiles!kanban_board_card_comentarios_autor_id_fkey(id, nome)
        `)
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as BoardCardComentario[];
    },
    enabled: !!cardId,
  });

  const addComentario = useMutation({
    mutationFn: async (texto: string) => {
      if (!cardId) throw new Error('Card não selecionado');
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('kanban_board_card_comentarios')
        .insert({ card_id: cardId, autor_id: user.user.id, texto });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-card-comentarios', cardId] });
      queryClient.invalidateQueries({ queryKey: ['board-card-counts'] });
    },
    onError: (err: any) => toast.error('Erro ao comentar: ' + err.message),
  });

  const deleteComentario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kanban_board_card_comentarios')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-card-comentarios', cardId] });
      queryClient.invalidateQueries({ queryKey: ['board-card-counts'] });
    },
  });

  return { comentarios, isLoading, addComentario, deleteComentario };
}

// ── Hook: Contagens agregadas (para preview nos cards do board) ──

export function useBoardCardCounts(boardId: string | undefined) {
  const { data = { checklist: {}, comentarios: {} } } = useQuery({
    queryKey: ['board-card-counts', boardId],
    queryFn: async () => {
      if (!boardId) return { checklist: {}, comentarios: {} };

      // IDs dos cards do board
      const { data: cardsRaw } = await supabase
        .from('kanban_board_cards')
        .select('id')
        .eq('board_id', boardId)
        .is('arquivado_em', null);

      const cardIds = (cardsRaw || []).map((c: any) => c.id);
      if (cardIds.length === 0) return { checklist: {}, comentarios: {} };

      // Checklist counts
      const { data: checklistRaw } = await supabase
        .from('kanban_board_card_checklist')
        .select('card_id, concluido')
        .in('card_id', cardIds);

      const checklist: Record<string, { total: number; done: number }> = {};
      (checklistRaw || []).forEach((item: any) => {
        if (!checklist[item.card_id]) checklist[item.card_id] = { total: 0, done: 0 };
        checklist[item.card_id].total += 1;
        if (item.concluido) checklist[item.card_id].done += 1;
      });

      // Comentários counts
      const { data: comentariosRaw } = await supabase
        .from('kanban_board_card_comentarios')
        .select('card_id')
        .in('card_id', cardIds);

      const comentarios: Record<string, number> = {};
      (comentariosRaw || []).forEach((item: any) => {
        comentarios[item.card_id] = (comentarios[item.card_id] || 0) + 1;
      });

      return { checklist, comentarios };
    },
    enabled: !!boardId,
    staleTime: 30_000,
  });

  return data;
}
