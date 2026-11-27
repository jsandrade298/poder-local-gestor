import { supabase } from "@/integrations/supabase/client";
import { garantirQuadroPessoal } from "@/hooks/useQuadros";
import type { AcaoJorginho } from "@/hooks/useJorginho";

/**
 * Executa uma ação que o Jotinha PROPÔS e a pessoa CONFIRMOU (no botão ou,
 * numa ligação, falando). Roda aqui no app, com o login de quem confirmou —
 * as mesmas regras de acesso de qualquer tela. Mudanças em demandas ficam na
 * linha do tempo, dizendo que vieram do Jotinha.
 */

const primeiro = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const dataCurta = (iso?: string | null) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "");
const dataFalada = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const quandoFalado = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).replace(",", "").replace(" às ", " às ");
const quandoCurto = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ATIVIDADE_DEMANDA: Record<string, string> = { comentario: "um comentário", visita: "uma visita técnica", atualizacao: "uma atualização" };
const ATIVIDADE_PRONTUARIO: Record<string, string> = { anotacao: "uma anotação", ligacao: "uma ligação", reuniao: "uma reunião", visita: "uma visita", whatsapp: "um contato por WhatsApp", atendimento: "um atendimento", evento: "um evento" };

function mudancas(a: Extract<AcaoJorginho, { tipo: "alterar_demanda" }>) {
  return [a.status && `status ${a.status.nome}`, a.prioridade && `prioridade ${a.prioridade === "media" ? "média" : a.prioridade}`, a.area && `área ${a.area.nome}`].filter(Boolean).join(", ");
}

/** Cartão de confirmação (na conversa escrita). */
export function descreverAcao(a: AcaoJorginho) {
  switch (a.tipo) {
    case "criar_tarefa": return {
      titulo: `Criar tarefa ${a.quadroNome ? `no quadro ${a.quadroNome}` : "no Meu quadro"}`,
      detalhe: [a.titulo, a.prazo && `prazo ${dataCurta(a.prazo)}`, a.responsavelNome && `com ${a.responsavelNome}`, a.protocolo && `vinculada à #${a.protocolo}`].filter(Boolean).join(" · "),
    };
    case "mudar_responsavel": return { titulo: `Passar para ${a.pessoaNome}`, detalhe: a.demandas.map((d) => `#${d.protocolo}`).join(", ") };
    case "mudar_prazo": return { titulo: `Definir prazo: ${dataCurta(a.prazo)}`, detalhe: `#${a.protocolo} · ${a.titulo}` };
    case "alterar_demanda": return { titulo: `Mudar ${mudancas(a)}`, detalhe: a.demandas.map((d) => `#${d.protocolo} · ${d.titulo}`).join("; ") };
    case "comentar": return { titulo: `Registrar ${ATIVIDADE_DEMANDA[a.atividade || "comentario"] || "um comentário"} em #${a.protocolo}`, detalhe: a.texto };
    case "registrar_prontuario": return { titulo: `Registrar no prontuário de ${a.municipeNome}`, detalhe: `${ATIVIDADE_PRONTUARIO[a.atividade] || "registro"}: ${a.texto}` };
    case "criar_municipe": return { titulo: "Cadastrar munícipe novo", detalhe: `${a.nome}${a.bairro ? ` · ${a.bairro}` : ""}` };
    case "criar_compromisso": return { titulo: `Marcar na ${a.agenda === "mandato" ? "agenda do mandato" : "sua agenda"}`, detalhe: [a.titulo, quandoCurto(a.inicio), a.local].filter(Boolean).join(" · ") };
    case "navegar": return { titulo: `Abrir ${a.rotulo}`, detalhe: a.link };
    case "abrir_formulario": return { titulo: "Abrir nova demanda", detalhe: "" };
  }
}

/** O que o Jotinha fala para pedir a confirmação por voz ("Vou criar a tarefa…"). */
export function falaDaAcao(a: AcaoJorginho): string {
  switch (a.tipo) {
    case "criar_tarefa":
      return `criar a tarefa "${a.titulo}" ${a.quadroNome ? `no quadro ${a.quadroNome}` : "no seu quadro"}${a.responsavelNome ? `, com ${primeiro(a.responsavelNome)} de responsável` : ""}${a.protocolo ? ", vinculada à demanda" : ""}${a.prazo ? `, com prazo para ${dataFalada(a.prazo)}` : ""}`;
    case "mudar_responsavel": return `passar ${a.demandas.length === 1 ? `a demanda ${a.demandas[0].titulo}` : `${a.demandas.length} demandas`} para ${primeiro(a.pessoaNome)}`;
    case "mudar_prazo": return `colocar o prazo da demanda ${a.titulo} para ${dataFalada(a.prazo)}`;
    case "alterar_demanda": return `mudar ${a.demandas.length === 1 ? `a demanda ${a.demandas[0].titulo}` : `${a.demandas.length} demandas`} para ${mudancas(a)}`;
    case "comentar": return `registrar ${ATIVIDADE_DEMANDA[a.atividade || "comentario"] || "um comentário"} na demanda ${a.titulo}`;
    case "registrar_prontuario": return `registrar ${ATIVIDADE_PRONTUARIO[a.atividade] || "um registro"} no prontuário de ${primeiro(a.municipeNome)}`;
    case "criar_municipe": return `cadastrar ${a.nome} como munícipe novo${a.bairro ? `, do ${a.bairro}` : ""}`;
    case "criar_compromisso": return `marcar "${a.titulo}" na ${a.agenda === "mandato" ? "agenda do mandato" : "sua agenda"}, ${quandoFalado(a.inicio)}`;
    case "navegar": return `abrir ${a.rotulo}`;
    case "abrir_formulario": return "abrir o formulário de nova demanda";
  }
}

async function registrar(demandaId: string, uid: string, titulo: string, descricao: string) {
  await (supabase.from("demanda_atividades") as any).insert({ demanda_id: demandaId, created_by: uid, tipo_atividade: "atualizacao", titulo, descricao });
}

export async function executarAcao(a: AcaoJorginho, quem: { uid: string; nome?: string | null }): Promise<{ mensagem: string; link?: string }> {
  const porQuem = `Feito pelo Jotinha, a pedido de ${quem.nome || "alguém da equipe"}.`;
  switch (a.tipo) {
    case "criar_tarefa": {
      const boardId = a.boardId || await garantirQuadroPessoal(quem.uid, quem.nome);
      const { data: col, error: e1 } = await supabase.from("kanban_board_colunas").select("id").eq("board_id", boardId).eq("arquivada", false).order("ordem").limit(1).maybeSingle();
      if (e1 || !col) throw e1 || new Error("O quadro não tem etapas");
      const { data: novo, error } = await supabase.from("kanban_board_cards").insert({
        board_id: boardId, coluna_id: col.id, titulo: a.titulo, descricao: a.descricao || null, responsavel_id: a.responsavelId || quem.uid, created_by: quem.uid,
        data_prazo: a.prazo || null, prioridade: "media", cor: "#3b82f6", ordem: 0,
      }).select("id").single();
      if (error) throw error;
      if (a.demandaId) {
        const { error: eV } = await supabase.from("kanban_board_card_demandas").insert({ card_id: novo.id, demanda_id: a.demandaId });
        if (eV) throw new Error("A tarefa foi criada, mas não consegui vincular a demanda: " + eV.message);
      }
      return { mensagem: `Tarefa criada ${a.quadroNome ? `no quadro ${a.quadroNome}` : "no Meu quadro"}${a.demandaId ? ", vinculada à demanda" : ""} ✅`, link: `/quadros/${boardId}?cartao=${novo.id}` };
    }
    case "mudar_responsavel": {
      const ids = a.demandas.map((d) => d.id);
      const { data, error } = await supabase.from("demandas").update({ responsavel_id: a.pessoaId }).in("id", ids).select("id");
      if (error) throw error;
      await Promise.all((data ?? []).map((d: any) => registrar(d.id, quem.uid, `Responsável: ${a.pessoaNome}`, porQuem)));
      const n = data?.length ?? 0;
      return { mensagem: n === ids.length ? `${n === 1 ? "Demanda passada" : `${n} demandas passadas`} para ${a.pessoaNome} ✅` : `${n} de ${ids.length} alteradas (as outras você não pode editar).` };
    }
    case "mudar_prazo": {
      const { data, error } = await supabase.from("demandas").update({ data_prazo: a.prazo }).eq("id", a.demandaId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não pode editar esta demanda.");
      await registrar(a.demandaId, quem.uid, `Prazo: ${new Date(a.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`, porQuem);
      return { mensagem: "Prazo definido ✅", link: `/demandas?protocolo=${encodeURIComponent(a.protocolo)}` };
    }
    case "alterar_demanda": {
      const ids = a.demandas.map((d) => d.id);
      const patch: Record<string, unknown> = {};
      if (a.status) patch.status = a.status.slug;
      if (a.prioridade) patch.prioridade = a.prioridade;
      if (a.area) patch.area_id = a.area.id;
      const { data, error } = await supabase.from("demandas").update(patch).in("id", ids).select("id");
      if (error) throw error;
      await Promise.all((data ?? []).map((d: any) => registrar(d.id, quem.uid, `Alterado: ${mudancas(a)}`, porQuem)));
      const n = data?.length ?? 0;
      if (!n) throw new Error("Você não pode editar estas demandas.");
      return { mensagem: `${n === 1 ? "Demanda atualizada" : `${n} demandas atualizadas`} ✅`, link: a.demandas.length === 1 ? `/demandas?protocolo=${encodeURIComponent(a.demandas[0].protocolo)}` : undefined };
    }
    case "comentar": {
      const tipo = a.atividade || "comentario";
      const titulo = tipo === "visita" ? "Visita técnica" : tipo === "atualizacao" ? "Atualização" : "Comentário";
      const { error } = await (supabase.from("demanda_atividades") as any).insert({ demanda_id: a.demandaId, created_by: quem.uid, tipo_atividade: tipo, titulo, descricao: a.texto });
      if (error) throw error;
      return { mensagem: `${titulo} registrado na demanda ✅`, link: `/demandas?protocolo=${encodeURIComponent(a.protocolo)}` };
    }
    case "registrar_prontuario": {
      const { error } = await (supabase.from("municipe_atividades") as any).insert({
        municipe_id: a.municipeId, created_by: quem.uid, tipo_atividade: a.atividade, titulo: a.titulo, descricao: a.texto, data_atividade: new Date().toISOString(),
      });
      if (error) throw error;
      return { mensagem: `Registrado no prontuário de ${primeiro(a.municipeNome)} ✅`, link: `/municipes?abrir=${a.municipeId}&aba=prontuario` };
    }
    case "criar_municipe": {
      const { data, error } = await supabase.from("municipes").insert({ nome: a.nome, bairro: a.bairro || null }).select("id").single();
      if (error) throw error;
      return { mensagem: `${a.nome} cadastrado como munícipe ✅`, link: `/municipes?abrir=${data.id}` };
    }
    case "criar_compromisso": {
      const { data: st, error: e1 } = await supabase.functions.invoke("google-agenda", { body: { acao: "status" } });
      if (e1) throw new Error("Não consegui falar com a agenda.");
      const conta = a.agenda === "mandato" ? st?.mandato : st?.pessoal;
      if (!conta) throw new Error(a.agenda === "mandato" ? "A agenda do mandato não está conectada." : "Sua agenda Google não está conectada (conecte em Agenda).");
      if (a.agenda === "mandato" && !st?.souEditorMandato) throw new Error("Só os editores podem marcar na agenda do mandato — use \"Pedir horário\" na Agenda.");
      const cal = (conta.calendarios || []).find((c: any) => c.papel === "owner" || c.papel === "writer");
      if (!cal) throw new Error("A agenda conectada não permite criar eventos.");
      const { error } = await supabase.functions.invoke("google-agenda", {
        body: { acao: "criar", origem: a.agenda, calendarId: cal.id, evento: { titulo: a.titulo, inicio: a.inicio, fim: a.fim, local: a.local || "", descricao: "Marcado pelo Jotinha.", vinculos: a.demandaId ? { demandaId: a.demandaId } : undefined } },
      });
      if (error) {
        let msg = "Não consegui marcar.";
        try { msg = (await (error as any).context.json())?.error || msg; } catch { /* sem corpo */ }
        throw new Error(msg);
      }
      return { mensagem: "Compromisso marcado na agenda ✅", link: `/agenda?dia=${a.inicio.slice(0, 10)}` };
    }
    case "navegar":
      return { mensagem: `Abri ${a.rotulo}.`, link: a.link };
    case "abrir_formulario":
      return { mensagem: "Abri o formulário." };
  }
}
