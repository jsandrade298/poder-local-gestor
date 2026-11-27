import { supabase } from "@/integrations/supabase/client";
import { garantirQuadroPessoal } from "@/hooks/useQuadros";
import type { AcaoJorginho } from "@/hooks/useJorginho";

/**
 * Executa uma ação que o Jotinha PROPÔS e a pessoa CONFIRMOU.
 * Roda aqui no app, com o login de quem confirmou (as mesmas regras de
 * acesso de qualquer tela). Mudanças em demandas ficam registradas na
 * linha do tempo, dizendo que vieram do Jotinha.
 */

export function descreverAcao(a: AcaoJorginho) {
  const data = (iso?: string | null) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "");
  switch (a.tipo) {
    case "criar_tarefa": return { titulo: "Criar tarefa no Meu quadro", detalhe: `${a.titulo}${a.prazo ? ` · prazo ${data(a.prazo)}` : ""}` };
    case "mudar_responsavel": return { titulo: `Passar para ${a.pessoaNome}`, detalhe: a.demandas.map((d) => `#${d.protocolo}`).join(", ") };
    case "mudar_prazo": return { titulo: `Definir prazo: ${data(a.prazo)}`, detalhe: `#${a.protocolo} · ${a.titulo}` };
    case "comentar": return { titulo: `Registrar comentário em #${a.protocolo}`, detalhe: a.texto };
  }
}

async function registrar(demandaId: string, uid: string, titulo: string, descricao: string) {
  await (supabase.from("demanda_atividades") as any).insert({ demanda_id: demandaId, created_by: uid, tipo_atividade: "atualizacao", titulo, descricao });
}

export async function executarAcao(a: AcaoJorginho, quem: { uid: string; nome?: string | null }): Promise<{ mensagem: string; link?: string }> {
  switch (a.tipo) {
    case "criar_tarefa": {
      const boardId = await garantirQuadroPessoal(quem.uid, quem.nome);
      const { data: col, error: e1 } = await supabase.from("kanban_board_colunas").select("id").eq("board_id", boardId).eq("arquivada", false).order("ordem").limit(1).maybeSingle();
      if (e1 || !col) throw e1 || new Error("Seu quadro não tem etapas");
      const { data: novo, error } = await supabase.from("kanban_board_cards").insert({
        board_id: boardId, coluna_id: col.id, titulo: a.titulo, descricao: a.descricao || null, responsavel_id: quem.uid, created_by: quem.uid,
        data_prazo: a.prazo || null, prioridade: "media", cor: "#3b82f6", ordem: 0,
      }).select("id").single();
      if (error) throw error;
      return { mensagem: "Tarefa criada no Meu quadro ✅", link: `/quadros/${boardId}?cartao=${novo.id}` };
    }
    case "mudar_responsavel": {
      const ids = a.demandas.map((d) => d.id);
      const { data, error } = await supabase.from("demandas").update({ responsavel_id: a.pessoaId }).in("id", ids).select("id");
      if (error) throw error;
      await Promise.all((data ?? []).map((d: any) => registrar(d.id, quem.uid, `Responsável: ${a.pessoaNome}`, `Alterado pelo Jotinha, a pedido de ${quem.nome || "alguém da equipe"}.`)));
      const n = data?.length ?? 0;
      return { mensagem: n === ids.length ? `${n === 1 ? "Demanda passada" : `${n} demandas passadas`} para ${a.pessoaNome} ✅` : `${n} de ${ids.length} alteradas (as outras você não pode editar).` };
    }
    case "mudar_prazo": {
      const { data, error } = await supabase.from("demandas").update({ data_prazo: a.prazo }).eq("id", a.demandaId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não pode editar esta demanda.");
      await registrar(a.demandaId, quem.uid, `Prazo: ${new Date(a.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`, `Definido pelo Jotinha, a pedido de ${quem.nome || "alguém da equipe"}.`);
      return { mensagem: "Prazo definido ✅", link: `/demandas?protocolo=${encodeURIComponent(a.protocolo)}` };
    }
    case "comentar": {
      const { error } = await (supabase.from("demanda_atividades") as any).insert({ demanda_id: a.demandaId, created_by: quem.uid, tipo_atividade: "comentario", titulo: "Comentário", descricao: a.texto });
      if (error) throw error;
      return { mensagem: "Comentário registrado ✅", link: `/demandas?protocolo=${encodeURIComponent(a.protocolo)}` };
    }
  }
}
