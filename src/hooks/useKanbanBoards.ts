import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAll } from "@/lib/fetchAll";

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
  /** projeto (membros editam) · equipe (todo o gabinete edita) · pessoal (só o dono edita) */
  tipo: "projeto" | "equipe" | "pessoal";
  dono_id: string | null;
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
  /** De onde veio (migração do Kanban antigo): "tarefa" | "demanda_kanban" */
  origem?: string | null;
  origem_id?: string | null;
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
      toast.success('Projeto criado! Você já é membro.');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      // Galeria dos Quadros: quem é membro e o resumo dos projetos
      queryClient.invalidateQueries({ queryKey: ['quadros-membros-todos'] });
      queryClient.invalidateQueries({ queryKey: ['quadros-resumos'] });
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
      toast.success('Projeto atualizado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      queryClient.invalidateQueries({ queryKey: ['inicio-meus-projetos'] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar o projeto: ' + err.message),
  });

  /**
   * Exclui de vez o projeto: etapas, cartões, checklist, comentários e
   * histórico vão junto (cascata no banco). Demandas vinculadas NÃO são
   * apagadas — só deixam de estar vinculadas ao cartão.
   */
  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('kanban_boards')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('Você não tem permissão para excluir este projeto');
    },
    onSuccess: () => {
      toast.success('Projeto excluído');
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      queryClient.invalidateQueries({ queryKey: ['quadros-resumos'] });
      queryClient.invalidateQueries({ queryKey: ['quadros-membros-todos'] });
      queryClient.invalidateQueries({ queryKey: ['inicio-meus-projetos'] });
      queryClient.invalidateQueries({ queryKey: ['inicio-minhas-tarefas'] });
    },
    onError: (err: any) => toast.error('Erro ao excluir o projeto: ' + err.message),
  });

  const archiveBoard = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase
        .from('kanban_boards') as any)
        .update({ arquivado_em: new Date().toISOString() })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('só os membros do projeto podem arquivá-lo');
      return id;
    },
    onSuccess: (id: string) => {
      const atualizar = () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
        queryClient.invalidateQueries({ queryKey: ['projetos-arquivados'] });
      };
      atualizar();
      toast.success('Projeto arquivado', {
        description: 'Fica em "Projetos arquivados", no fim da página Quadros.',
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await (supabase.from('kanban_boards') as any).update({ arquivado_em: null }).eq('id', id);
            atualizar();
          },
        },
      });
    },
    onError: (err: any) => toast.error('Erro ao arquivar: ' + err.message),
  });

  return { boards, isLoading, createBoard, updateBoard, archiveBoard, deleteBoard };
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
      // Paginado: o quadro da equipe passa de mil cartões com o tempo
      const data = await fetchAll((from, to) =>
        supabase
          .from('kanban_board_cards')
          .select(`
            *,
            responsavel:profiles!kanban_board_cards_responsavel_id_fkey(id, nome),
            criador:profiles!kanban_board_cards_created_by_fkey(id, nome)
          `)
          .eq('board_id', boardId)
          .is('arquivado_em', null)
          .order('ordem', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as any
      );
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
      /** Vincula a demanda ao cartão logo após criar */
      demanda_id?: string;
      /** Criação em lote: quem chama mostra um aviso só no fim */
      silencioso?: boolean;
    }) => {
      if (!boardId) throw new Error('Board não selecionado');
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Ordem: próximo da coluna
      const maxOrdem = Math.max(
        ...cards.filter(c => c.coluna_id === card.coluna_id).map(c => c.ordem),
        0
      );

      const { data: criado, error } = await supabase
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
        })
        .select('id')
        .single();
      if (error) throw error;

      if (card.demanda_id && criado?.id) {
        const { error: eDem } = await supabase
          .from('kanban_board_card_demandas' as any)
          .insert({ card_id: criado.id, demanda_id: card.demanda_id });
        if (eDem) throw eDem;
      }

      // Atualizar updated_at do board
      await supabase.from('kanban_boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      return criado as { id: string };
    },
    onSuccess: (_d, v) => {
      if (!v.silencioso) toast.success('Cartão criado!');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      queryClient.invalidateQueries({ queryKey: ['quadro-extras', boardId] });
      queryClient.invalidateQueries({ queryKey: ['inicio-minhas-tarefas'] });
    },
    onError: (err: any, v) => { if (!v.silencioso) toast.error('Erro ao criar card: ' + err.message); },
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
      const { data, error } = await (supabase
        .from('kanban_board_cards') as any)
        .update({ arquivado_em: new Date().toISOString() })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão neste cartão');
      return id;
    },
    onSuccess: (id: string) => {
      const atualizar = () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
        queryClient.invalidateQueries({ queryKey: ['cartoes-arquivados', boardId] });
        queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      };
      atualizar();
      toast.success('Cartão arquivado', {
        description: 'Fica em "Arquivados", no topo do quadro.',
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await (supabase.from('kanban_board_cards') as any).update({ arquivado_em: null }).eq('id', id);
            atualizar();
          },
        },
      });
    },
    onError: (err: any) => toast.error('Erro ao arquivar: ' + err.message),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase
        .from('kanban_board_cards') as any)
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão para excluir este cartão');
    },
    onSuccess: () => {
      toast.success('Cartão excluído');
      queryClient.invalidateQueries({ queryKey: ['kanban-board-cards', boardId] });
      queryClient.invalidateQueries({ queryKey: ['cartoes-arquivados', boardId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
    onError: (err: any) => toast.error('Erro ao excluir: ' + err.message),
  });

  return { cards, isLoading, createCard, updateCard, moveCard, archiveCard, deleteCard };
}
