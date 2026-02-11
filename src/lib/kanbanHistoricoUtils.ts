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
    }));

    const { error } = await supabase.from("kanban_historico").insert(records);

    if (error) {
      logError("Erro ao registrar histórico batch:", error);
    }
  } catch (err) {
    logError("Erro inesperado ao registrar histórico batch:", err);
  }
}
