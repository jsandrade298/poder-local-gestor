import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { aplicarBusca, CAMPOS_PADRAO_DEMANDA, CAMPOS_NUMERICOS_DEMANDA } from "@/lib/busca";

/**
 * Quadros de projeto: membros, colaboradores, demandas vinculadas, histórico.
 * Regras (banco): todo o gabinete vê; só membros escrevem; quem cria é membro.
 * Os cartões, colunas, checklist e comentários usam os hooks já existentes
 * (useKanbanBoards / useBoardCardExtras).
 */

export interface Pessoa { id: string; nome: string }

// ── Pessoas do gabinete (selects, menções) ──────────────────────

export function usePessoasGabinete() {
  const { data = [] } = useQuery({
    queryKey: ["pessoas-gabinete"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as Pessoa[];
    },
    staleTime: 10 * 60_000,
  });
  const porId = useMemo(() => new Map(data.map((p) => [p.id, p])), [data]);
  return { pessoas: data, porId };
}

// ── Avisos (notificações internas) ──────────────────────────────

export async function avisar(params: {
  destinatarios: string[];
  remetente: string;
  tipo: "atribuicao" | "mencao" | "tarefa_atribuida";
  titulo: string;
  mensagem: string;
  url: string;
}) {
  const alvo = [...new Set(params.destinatarios)].filter((id) => id && id !== params.remetente);
  if (alvo.length === 0) return;
  const { error } = await supabase.from("notificacoes").insert(
    alvo.map((destinatario_id) => ({
      destinatario_id,
      remetente_id: params.remetente,
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
      url_destino: params.url,
      lida: false,
    }))
  );
  // Aviso não pode derrubar a ação principal
  if (error) console.error("Erro ao criar aviso:", error);
}

export const urlDoCartao = (boardId: string, cardId: string) => `/quadros/${boardId}?cartao=${cardId}`;

// ── Membros de todos os projetos (galeria) ──────────────────────

export function useMembrosDeTodosQuadros() {
  const { data = [] } = useQuery({
    queryKey: ["quadros-membros-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_board_membros").select("board_id, usuario_id");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  return useMemo(() => {
    const m = new Map<string, string[]>();
    data.forEach((r: any) => m.set(r.board_id, [...(m.get(r.board_id) || []), r.usuario_id]));
    return m;
  }, [data]);
}

// ── Membros de um projeto ───────────────────────────────────────

export function useMembrosQuadro(boardId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["quadro-membros", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_board_membros")
        .select("id, usuario_id, created_at, pessoa:profiles!kanban_board_membros_usuario_id_fkey(id, nome)")
        .eq("board_id", boardId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["quadro-membros", boardId] });
    qc.invalidateQueries({ queryKey: ["quadros-membros-todos"] });
  };

  const incluir = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("kanban_board_membros").insert({ board_id: boardId, usuario_id: usuarioId });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error("Não foi possível incluir: " + e.message),
  });

  const remover = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("kanban_board_membros").delete().eq("board_id", boardId!).eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error("Não foi possível remover: " + e.message),
  });

  const souMembro = membros.some((m) => m.usuario_id === user?.id);
  return { membros, isLoading, souMembro, incluir, remover };
}

// ── Colaboradores e demandas de todos os cartões de um projeto ──

export function useExtrasDoQuadro(boardId: string | undefined) {
  const { data = { colab: new Map<string, string[]>(), dems: new Map<string, { id: string; protocolo: string }[]>() } } = useQuery({
    queryKey: ["quadro-extras", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const [c, d] = await Promise.all([
        supabase.from("kanban_board_card_colaboradores").select("card_id, usuario_id, kanban_board_cards!inner(board_id)").eq("kanban_board_cards.board_id", boardId!),
        supabase.from("kanban_board_card_demandas").select("card_id, demanda_id, demandas(protocolo), kanban_board_cards!inner(board_id)").eq("kanban_board_cards.board_id", boardId!),
      ]);
      if (c.error) throw c.error;
      if (d.error) throw d.error;
      const colab = new Map<string, string[]>();
      (c.data ?? []).forEach((r: any) => colab.set(r.card_id, [...(colab.get(r.card_id) || []), r.usuario_id]));
      const dems = new Map<string, { id: string; protocolo: string }[]>();
      (d.data ?? []).forEach((r: any) => dems.set(r.card_id, [...(dems.get(r.card_id) || []), { id: r.demanda_id, protocolo: r.demandas?.protocolo }]));
      return { colab, dems };
    },
    staleTime: 30_000,
  });
  return data;
}

// ── Colaboradores de um cartão ──────────────────────────────────

export function useColaboradoresCartao(cardId: string | undefined, boardId: string | undefined) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["cartao-colab", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_board_card_colaboradores").select("usuario_id").eq("card_id", cardId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.usuario_id as string);
    },
  });
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cartao-colab", cardId] });
    qc.invalidateQueries({ queryKey: ["quadro-extras", boardId] });
    qc.invalidateQueries({ queryKey: ["cartao-historico", cardId] });
  };
  const incluir = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("kanban_board_card_colaboradores").insert({ card_id: cardId, usuario_id: usuarioId });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error("Não foi possível incluir: " + e.message),
  });
  const remover = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("kanban_board_card_colaboradores").delete().eq("card_id", cardId!).eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
  return { colaboradores: data, incluir, remover };
}

// ── Demandas vinculadas a um cartão ─────────────────────────────

export function useDemandasCartao(cardId: string | undefined, boardId: string | undefined) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["cartao-demandas", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_board_card_demandas")
        .select("demanda_id, demandas(id, protocolo, titulo, status)")
        .eq("card_id", cardId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.demandas).filter(Boolean) as { id: string; protocolo: string; titulo: string; status: string }[];
    },
  });
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cartao-demandas", cardId] });
    qc.invalidateQueries({ queryKey: ["quadro-extras", boardId] });
    qc.invalidateQueries({ queryKey: ["cartao-historico", cardId] });
  };
  const vincular = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase.from("kanban_board_card_demandas").insert({ card_id: cardId, demanda_id: demandaId });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Demanda vinculada"); },
    onError: (e: any) => toast.error("Não foi possível vincular: " + e.message),
  });
  const desvincular = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase.from("kanban_board_card_demandas").delete().eq("card_id", cardId!).eq("demanda_id", demandaId);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Demanda desvinculada — ela continua em Demandas"); },
  });
  return { demandas: data, vincular, desvincular };
}

/** Busca de demandas para vincular (protocolo, título, munícipe). */
export function useBuscaDemandas(termo: string) {
  return useQuery({
    queryKey: ["busca-demandas-vincular", termo],
    enabled: termo.trim().length >= 2,
    queryFn: async () => {
      let q = supabase.from("demandas").select("id, protocolo, titulo, status").order("created_at", { ascending: false }).limit(8);
      q = aplicarBusca(q, termo, { campos: CAMPOS_PADRAO_DEMANDA, camposNumericos: CAMPOS_NUMERICOS_DEMANDA });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

// ── Histórico de um cartão ──────────────────────────────────────

export function useHistoricoCartao(cardId: string | undefined) {
  return useQuery({
    queryKey: ["cartao-historico", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_board_card_historico")
        .select("id, acao, detalhe, created_at, usuario_id")
        .eq("card_id", cardId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Texto legível de uma linha do histórico. */
export function descreverHistorico(acao: string, d: any): string {
  const q = (s: any) => (s ? `“${s}”` : "");
  switch (acao) {
    case "criou": return "criou o cartão";
    case "moveu": return `moveu de ${d?.de ?? "—"} para ${d?.para ?? "—"}`;
    case "prazo": return d?.para ? `definiu o prazo para ${new Date(d.para + "T12:00").toLocaleDateString("pt-BR")}` : "removeu o prazo";
    case "responsavel": return d?.para ? `passou a responsabilidade para ${d.para}` : "deixou o cartão sem responsável";
    case "renomeou": return `renomeou para ${q(d?.para)}`;
    case "arquivou": return "arquivou o cartão";
    case "desarquivou": return "desarquivou o cartão";
    case "checklist_incluiu": return `incluiu no checklist ${q(d?.item)}`;
    case "checklist_excluiu": return `excluiu do checklist ${q(d?.item)}`;
    case "checklist_concluiu": return `concluiu ${q(d?.item)}`;
    case "checklist_reabriu": return `reabriu ${q(d?.item)}`;
    case "colaborador_incluiu": return `incluiu ${d?.pessoa ?? "alguém"} como colaborador(a)`;
    case "colaborador_removeu": return `removeu ${d?.pessoa ?? "alguém"} dos colaboradores`;
    case "demanda_vinculou": return `vinculou a demanda #${d?.protocolo ?? ""}`;
    case "demanda_desvinculou": return `desvinculou a demanda #${d?.protocolo ?? ""}`;
    default: return acao;
  }
}

/** Coluna que representa "concluído" (não há marcação no banco; usa o nome). */
export function colunaEhFinal(c: { slug?: string | null; nome?: string | null }) {
  const t = `${c.slug ?? ""} ${c.nome ?? ""}`.toLowerCase();
  return /conclu|feito|finaliz|entregue|done/.test(t);
}
