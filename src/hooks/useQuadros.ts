import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { aplicarBusca, CAMPOS_PADRAO_DEMANDA, CAMPOS_NUMERICOS_DEMANDA } from "@/lib/busca";
import { fetchAll } from "@/lib/fetchAll";

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
      const { data, error } = await (supabase.from("profiles") as any).select("id, nome, ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as (Pessoa & { ativo?: boolean })[];
    },
    staleTime: 10 * 60_000,
  });
  // Quem foi desativado some das listas de escolha, mas o nome continua no histórico
  const pessoas = useMemo(() => data.filter((p) => p.ativo !== false), [data]);
  const porId = useMemo(() => new Map(data.map((p) => [p.id, p])), [data]);
  return { pessoas, porId };
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

export interface DemandaNoCartao {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  municipe_id: string | null;
  /** Dados essenciais mostrados no cartão */
  descricao?: string | null;
  data_prazo?: string | null;
  created_at?: string | null;
  responsavel_id?: string | null;
  area?: string | null;
  municipe?: string | null;
}

export function useExtrasDoQuadro(boardId: string | undefined) {
  const { data = { colab: new Map<string, string[]>(), dems: new Map<string, DemandaNoCartao[]>() } } = useQuery({
    queryKey: ["quadro-extras", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const [c, d] = await Promise.all([
        fetchAll((f, t) => supabase.from("kanban_board_card_colaboradores").select("id, card_id, usuario_id, kanban_board_cards!inner(board_id)").eq("kanban_board_cards.board_id", boardId!).order("id").range(f, t) as any),
        fetchAll((f, t) => supabase.from("kanban_board_card_demandas").select("id, card_id, demanda_id, demandas(protocolo, titulo, status, municipe_id, descricao, data_prazo, created_at, responsavel_id, areas(nome), municipes(nome)), kanban_board_cards!inner(board_id)").eq("kanban_board_cards.board_id", boardId!).order("id").range(f, t) as any),
      ]);
      const colab = new Map<string, string[]>();
      (c as any[]).forEach((r) => colab.set(r.card_id, [...(colab.get(r.card_id) || []), r.usuario_id]));
      const dems = new Map<string, DemandaNoCartao[]>();
      // Demanda na lixeira vem sem dados (a leitura a esconde): não mostra no cartão
      (d as any[]).filter((r) => r.demandas).forEach((r) => dems.set(r.card_id, [...(dems.get(r.card_id) || []), {
        id: r.demanda_id, protocolo: r.demandas?.protocolo, titulo: r.demandas?.titulo,
        status: r.demandas?.status, municipe_id: r.demandas?.municipe_id ?? null,
        descricao: r.demandas?.descricao ?? null, data_prazo: r.demandas?.data_prazo ?? null,
        created_at: r.demandas?.created_at ?? null, responsavel_id: r.demandas?.responsavel_id ?? null,
        area: r.demandas?.areas?.nome ?? null, municipe: r.demandas?.municipes?.nome ?? null,
      }]));
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
        .select("demanda_id, demandas(id, protocolo, titulo, status, data_prazo)")
        .eq("card_id", cardId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.demandas).filter(Boolean) as { id: string; protocolo: string; titulo: string; status: string; data_prazo: string | null }[];
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
      let q = supabase.from("demandas").select("id, protocolo, titulo, status, responsavel_id").order("created_at", { ascending: false }).limit(8);
      q = aplicarBusca(q, termo, { campos: CAMPOS_PADRAO_DEMANDA, camposNumericos: CAMPOS_NUMERICOS_DEMANDA });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

// ── Projetos arquivados ─────────────────────────────────────────

export function useProjetosArquivados() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["projetos-arquivados"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("kanban_boards") as any)
        .select("id, nome, cor, icone, tipo, arquivado_em, kanban_board_membros(usuario_id)")
        .eq("tipo", "projeto")
        .not("arquivado_em", "is", null)
        .order("arquivado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b: any) => ({ ...b, membros: (b.kanban_board_membros ?? []).map((m: any) => m.usuario_id) as string[] }));
    },
    staleTime: 60_000,
  });
  const desarquivar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.from("kanban_boards") as any)
        .update({ arquivado_em: null }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Só os membros do projeto podem desarquivá-lo");
    },
    onSuccess: () => {
      toast.success("Projeto de volta aos Quadros");
      qc.invalidateQueries({ queryKey: ["projetos-arquivados"] });
      qc.invalidateQueries({ queryKey: ["kanban-boards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, desarquivar };
}

// ── Cartões arquivados de um quadro ─────────────────────────────

export function useCartoesArquivados(boardId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["cartoes-arquivados", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("kanban_board_cards") as any)
        .select("id, titulo, coluna_id, responsavel_id, created_by, arquivado_em, board_id")
        .eq("board_id", boardId!)
        .not("arquivado_em", "is", null)
        .order("arquivado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const desarquivar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.from("kanban_board_cards") as any)
        .update({ arquivado_em: null }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para desarquivar este cartão");
    },
    onSuccess: () => {
      toast.success("Cartão de volta ao quadro");
      qc.invalidateQueries({ queryKey: ["cartoes-arquivados", boardId] });
      qc.invalidateQueries({ queryKey: ["kanban-board-cards", boardId] });
      qc.invalidateQueries({ queryKey: ["kanban-boards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, desarquivar };
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
    case "importou": return `criou (${d?.de ?? "Kanban antigo"}; trazido para os Quadros em 24/11/2026)`;
    default: return acao;
  }
}

// ── Quadro pessoal ("Meu quadro") ───────────────────────────────

const ETAPAS_PADRAO = [
  { nome: "A Fazer", slug: "a_fazer", cor: "#3b82f6", ordem: 1 },
  { nome: "Em Progresso", slug: "em_progresso", cor: "#f59e0b", ordem: 2 },
  { nome: "Feito", slug: "feito", cor: "#22c55e", ordem: 3 },
];

/** Devolve o id do quadro pessoal da pessoa, criando na primeira vez. */
export async function garantirQuadroPessoal(uid: string, nome?: string | null): Promise<string> {
  // (colunas novas ainda não estão nos tipos gerados do Supabase)
  const quadros = supabase.from("kanban_boards") as any;
  const { data: existente, error: e1 } = await quadros
    .select("id").eq("tipo", "pessoal").eq("dono_id", uid).maybeSingle();
  if (e1) throw e1;
  if (existente?.id) return existente.id;

  const { data: novo, error: e2 } = await supabase.from("kanban_boards").insert({
    nome: `Quadro de ${nome || "sem nome"}`,
    descricao: "Quadro pessoal: o gabinete vê, só o dono edita.",
    cor: "#475569", icone: "🗂️", tipo: "pessoal", dono_id: uid, criado_por: uid,
  } as any).select("id").single();
  if (e2) throw e2;

  const { error: e3 } = await supabase.from("kanban_board_colunas")
    .insert(ETAPAS_PADRAO.map((c) => ({ ...c, board_id: novo.id })));
  if (e3) throw e3;
  return novo.id;
}

/** Nome para mostrar: o quadro pessoal de quem está vendo vira "Meu quadro". */
export function nomeDoQuadro(b: { nome: string; tipo?: string; dono_id?: string | null }, uid: string) {
  return b.tipo === "pessoal" && b.dono_id === uid ? "Meu quadro" : b.nome;
}

/** Slug "de Kanban" da etapa, para sugerir o status da demanda. */
export function etapaComoKanban(c: { slug?: string | null; nome?: string | null }) {
  if (colunaEhFinal(c)) return "feito";
  const t = `${c.slug ?? ""} ${c.nome ?? ""}`.toLowerCase();
  if (/progress|andamento|produ|execu|fazendo/.test(t)) return "em_progresso";
  return "a_fazer";
}

/** Coluna que representa "concluído" (não há marcação no banco; usa o nome). */
export function colunaEhFinal(c: { slug?: string | null; nome?: string | null }) {
  const t = `${c.slug ?? ""} ${c.nome ?? ""}`.toLowerCase();
  return /conclu|feito|finaliz|entregue|done/.test(t);
}
