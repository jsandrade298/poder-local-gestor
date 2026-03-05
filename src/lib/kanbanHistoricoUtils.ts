import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorUtils";

interface RegistrarHistoricoParams {
  item_id: string;
  item_tipo: "demanda" | "tarefa" | "rota";
  item_titulo: string;
  kanban_type: string;
  posicao_anterior?: string | null;
  posicao_nova?: string | null;
  acao: "adicionado" | "movido" | "removido";
  snapshot?: Record<string, unknown> | null;
}

/**
 * Registra uma movimentação no histórico do Kanban.
 * Chamado automaticamente nas ações de adicionar, mover e remover itens.
 * Não bloqueia a operação principal em caso de erro.
 */
export async function registrarHistorico(params: RegistrarHistoricoParams) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("kanban_historico").insert({
      item_id: params.item_id,
      item_tipo: params.item_tipo,
      item_titulo: params.item_titulo,
      kanban_type: params.kanban_type,
      posicao_anterior: params.posicao_anterior || null,
      posicao_nova: params.posicao_nova || null,
      acao: params.acao,
      movido_por: user?.id || null,
      snapshot: params.snapshot || null,
    });

    if (error) {
      logError("Erro ao registrar histórico kanban:", error);
    }
  } catch (err) {
    // Nunca bloqueia a operação principal
    logError("Erro inesperado ao registrar histórico:", err);
  }
}

/**
 * Registra múltiplas adições de uma vez (batch).
 * Usado quando vários itens são adicionados ao kanban simultaneamente.
 */
export async function registrarHistoricoBatch(
  items: RegistrarHistoricoParams[]
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const records = items.map((params) => ({
      item_id: params.item_id,
      item_tipo: params.item_tipo,
      item_titulo: params.item_titulo,
      kanban_type: params.kanban_type,
      posicao_anterior: params.posicao_anterior || null,
      posicao_nova: params.posicao_nova || null,
      acao: params.acao,
      movido_por: user?.id || null,
      snapshot: params.snapshot || null,
    }));

    const { error } = await supabase.from("kanban_historico").insert(records);

    if (error) {
      logError("Erro ao registrar histórico batch:", error);
    }
  } catch (err) {
    logError("Erro inesperado ao registrar histórico batch:", err);
  }
}

// ─── Snapshot de Tarefa ──────────────────────────────────────────────────────

export interface TarefaSnapshot {
  titulo: string;
  descricao: string | null;
  prioridade: string;
  cor: string | null;
  data_prazo: string | null;
  kanban_position: string;
  kanban_type: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  responsavel: { id: string; nome: string } | null;
  colaboradores: { id: string; nome: string }[];
  checklist: { texto: string; concluido: boolean; ordem: number }[];
  comentarios: { texto: string; autor_nome: string; created_at: string }[];
}

/**
 * Captura um snapshot completo de uma tarefa antes de removê-la.
 * Inclui: dados da tarefa, checklist, comentários e colaboradores.
 * Retorna null se a tarefa não for encontrada (nunca bloqueia).
 */
export async function capturarSnapshotTarefa(
  tarefaId: string
): Promise<TarefaSnapshot | null> {
  try {
    // Buscar tarefa (sem join no responsável — a FK aponta para auth.users, não profiles)
    const { data: tarefa, error: tarefaErr } = await supabase
      .from("tarefas")
      .select(`
        titulo, descricao, prioridade, cor, data_prazo,
        kanban_position, kanban_type, completed, completed_at, created_at,
        responsavel_id
      `)
      .eq("id", tarefaId)
      .single();

    if (tarefaErr || !tarefa) {
      logError("Erro ao buscar tarefa para snapshot:", tarefaErr);
      return null;
    }

    // Buscar nome do responsável via profiles (profiles.id = auth.users.id)
    let responsavel: { id: string; nome: string } | null = null;
    if (tarefa.responsavel_id) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("id", tarefa.responsavel_id)
        .single();
      if (perfil) responsavel = { id: perfil.id, nome: perfil.nome };
    }

    // Buscar checklist
    const { data: checklist = [] } = await supabase
      .from("tarefa_checklist_items")
      .select("texto, concluido, ordem")
      .eq("tarefa_id", tarefaId)
      .order("ordem", { ascending: true });

    // Buscar comentários com autor
    const { data: comentarios = [] } = await supabase
      .from("tarefa_comentarios")
      .select(`
        texto, created_at,
        autor:profiles!tarefa_comentarios_autor_id_fkey(nome)
      `)
      .eq("tarefa_id", tarefaId)
      .order("created_at", { ascending: true });

    // Buscar colaboradores
    const { data: colaboradores = [] } = await supabase
      .from("tarefa_colaboradores")
      .select(`
        colaborador:profiles!tarefa_colaboradores_colaborador_id_fkey(id, nome)
      `)
      .eq("tarefa_id", tarefaId);

    return {
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      cor: tarefa.cor,
      data_prazo: tarefa.data_prazo,
      kanban_position: tarefa.kanban_position,
      kanban_type: tarefa.kanban_type,
      completed: tarefa.completed,
      completed_at: tarefa.completed_at,
      created_at: tarefa.created_at,
      responsavel,
      colaboradores: (colaboradores || []).map((c: any) => ({
        id: c.colaborador?.id || "",
        nome: c.colaborador?.nome || "Desconhecido",
      })),
      checklist: (checklist || []).map((item: any) => ({
        texto: item.texto,
        concluido: item.concluido,
        ordem: item.ordem,
      })),
      comentarios: (comentarios || []).map((c: any) => ({
        texto: c.texto,
        autor_nome: c.autor?.nome || "Desconhecido",
        created_at: c.created_at,
      })),
    };
  } catch (err) {
    logError("Erro ao capturar snapshot da tarefa:", err);
    return null;
  }
}

/**
 * Captura snapshots de múltiplas tarefas.
 * Retorna um Map<tarefaId, snapshot>.
 */
export async function capturarSnapshotsTarefaBatch(
  tarefaIds: string[]
): Promise<Map<string, TarefaSnapshot>> {
  const snapshots = new Map<string, TarefaSnapshot>();
  
  // Paralelizar as capturas para performance
  const results = await Promise.allSettled(
    tarefaIds.map(async (id) => {
      const snapshot = await capturarSnapshotTarefa(id);
      if (snapshot) snapshots.set(id, snapshot);
    })
  );

  return snapshots;
}
