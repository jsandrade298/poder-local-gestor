// ============================================================
// Enfileiramento de notificações do sistema
//
// Antes, cada notificação interna virava um envio de WhatsApp na
// hora (limitado por um cron fixo de 3x/dia). Agora ela entra na
// fila do gabinete e sai no próximo horário configurado, junto com
// as outras, em um resumo só — ver despachar-notificacoes-whatsapp.
//
// Exceções que continuam saindo imediatamente:
//   - tipos marcados como urgentes na agenda do gabinete
//   - gabinetes sem agenda ativa
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

export interface NotificacaoParaFila {
  tenant_id: string;
  notificacao_id?: string | null;
  destinatario_id: string;
  destinatario_nome?: string | null;
  destinatario_telefone: string;
  tipo: string;
  titulo?: string | null;
  mensagem?: string | null;
  url_destino?: string | null;
}

export type ResultadoFila =
  | { enfileirada: true; fila_id: string }
  | { enfileirada: false; motivo: "urgente" | "sem_agenda" | "agenda_inativa" | "duplicada" };

/**
 * Decide entre enfileirar a notificação ou deixar o chamador enviá-la
 * na hora.
 *
 * Retorna `enfileirada: false` quando o envio deve ser imediato — nesse
 * caso o chamador segue com o disparo direto pela W-API.
 */
export async function enfileirarNotificacao(
  supabase: SupabaseClient,
  notificacao: NotificacaoParaFila,
): Promise<ResultadoFila> {
  const { data: agenda } = await supabase
    .from("notificacao_whatsapp_agenda")
    .select("ativo, tipos_urgentes")
    .eq("tenant_id", notificacao.tenant_id)
    .maybeSingle();

  // Gabinete ainda sem agenda: mantém o comportamento imediato
  if (!agenda) return { enfileirada: false, motivo: "sem_agenda" };

  if (!agenda.ativo) return { enfileirada: false, motivo: "agenda_inativa" };

  if ((agenda.tipos_urgentes || []).includes(notificacao.tipo)) {
    return { enfileirada: false, motivo: "urgente" };
  }

  const { data, error } = await supabase
    .from("notificacao_whatsapp_fila")
    .insert({
      tenant_id: notificacao.tenant_id,
      notificacao_id: notificacao.notificacao_id ?? null,
      destinatario_id: notificacao.destinatario_id,
      destinatario_nome: notificacao.destinatario_nome ?? null,
      destinatario_telefone: notificacao.destinatario_telefone,
      tipo: notificacao.tipo,
      titulo: notificacao.titulo ?? null,
      mensagem: notificacao.mensagem ?? null,
      url_destino: notificacao.url_destino ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = a mesma notificação já está na fila (índice único)
    if (error.code === "23505") return { enfileirada: false, motivo: "duplicada" };
    throw error;
  }

  return { enfileirada: true, fila_id: data.id };
}
