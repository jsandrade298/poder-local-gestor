import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { conversarComJorginho, ErroJorginho, type AcaoJorginho } from "@/hooks/useJorginho";
import { abrirFormularioComJotinha } from "./formulario";
import { executarAcao } from "./acoes";

/**
 * A conversa com o Jotinha fora do painel: as mensagens e o envio ficam aqui,
 * para a ligação continuar mesmo com o painel fechado ou a pessoa navegando
 * por outras telas. O painel só mostra o que está aqui.
 */

export interface Mensagem {
  id: string; role: "user" | "assistant"; content: string; erro?: boolean;
  acoes?: { acao: AcaoJorginho; estado: "pendente" | "feita" | "cancelada" | "erro"; resultado?: string; link?: string }[];
}
interface Estado { mensagens: Mensagem[]; pensando: boolean }

export const novoId = () => Math.random().toString(36).slice(2);
/** "Quero cadastrar uma demanda", "registra uma demanda…", "nova demanda" (não pega "abre a demanda #123") */
const QUER_CADASTRAR = /\b(cadastr\w*|registr\w*|cri[ae]r?|lan[cç]\w*|nova)\b[^.?!#]{0,30}\bdemanda\b/i;
const PERGUNTA = /^(quant|qual|quais|como|onde|quem|por ?que)/i;

let uid = "";
let estado: Estado = { mensagens: [], pensando: false };
let contexto: { tela?: string; protocolo?: string } = {};
let qc: QueryClient | null = null;
let nomeQuem: string | null = null;
const ouvintes = new Set<() => void>();
const chave = () => `jorginho-conversa:${uid}`;

function definir(p: Partial<Estado>) {
  estado = { ...estado, ...p };
  try { sessionStorage.setItem(chave(), JSON.stringify(estado.mensagens.slice(-30))); } catch { /* sem storage */ }
  ouvintes.forEach((f) => f());
}

/** Liga a conversa à pessoa logada (carrega o que ela já conversou nesta aba). */
export function usarConversaDe(id: string, cliente: QueryClient, nome?: string | null) {
  qc = cliente;
  nomeQuem = nome ?? nomeQuem;
  if (id === uid) return;
  uid = id;
  let msgs: Mensagem[] = [];
  try { msgs = JSON.parse(sessionStorage.getItem(chave()) || "[]"); } catch { msgs = []; }
  estado = { mensagens: msgs, pensando: false };
  ouvintes.forEach((f) => f());
}

/** Em que tela a pessoa está (e se está vendo uma demanda) — vai junto com as perguntas. */
export function definirContextoConversa(c: { tela?: string; protocolo?: string }) { contexto = { ...contexto, ...c }; }

export function useConversa() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => estado, () => estado);
}

export const mudarMensagens = (f: (m: Mensagem[]) => Mensagem[]) => definir({ mensagens: f(estado.mensagens) });
export const limparConversa = () => definir({ mensagens: [] });

/**
 * Manda uma mensagem ao Jotinha. `voz`: resposta curta, para ser falada.
 * Pedido de cadastro abre o formulário na hora (o que já contou vira a 1ª resposta).
 */
export async function enviarNaConversa(pergunta: string, opcoes: { voz?: boolean } = {}): Promise<{ content: string; abriuFormulario: boolean } | null> {
  const t = pergunta.trim();
  if (!t || estado.pensando) return null;
  const historico = [...estado.mensagens, { id: novoId(), role: "user" as const, content: t }];
  definir({ mensagens: historico });

  if (QUER_CADASTRAR.test(t) && !PERGUNTA.test(t)) {
    const resposta = "Abri o formulário de nova demanda — vamos preencher juntos! 📝";
    definir({ mensagens: [...estado.mensagens, { id: novoId(), role: "assistant", content: resposta }] });
    window.setTimeout(() => abrirFormularioComJotinha("nova_demanda", { relato: t, voz: opcoes.voz }), 300);
    return { content: resposta, abriuFormulario: true };
  }

  definir({ pensando: true });
  try {
    const r = await conversarComJorginho(
      historico.filter((m) => !m.erro).map((m) => ({ role: m.role, content: m.content })),
      { ...contexto, voz: !!opcoes.voz },
    );
    // "Abrir formulário" e "abrir tela" não mudam nada: executam na hora. As outras esperam a confirmação.
    const abrir = r.acoes?.find((a) => a.tipo === "abrir_formulario") as Extract<AcaoJorginho, { tipo: "abrir_formulario" }> | undefined;
    const navegar = r.acoes?.find((a) => a.tipo === "navegar") as Extract<AcaoJorginho, { tipo: "navegar" }> | undefined;
    const outras = (r.acoes ?? []).filter((a) => a.tipo !== "abrir_formulario" && a.tipo !== "navegar")
      // Responsável é quem está falando: "com você de responsável", não o próprio nome
      .map((a) => (a.tipo === "criar_tarefa" && a.responsavelId && a.responsavelId === uid ? { ...a, responsavelNome: "você" } : a));
    if (navegar) window.dispatchEvent(new CustomEvent("jotinha:navegar", { detail: { link: navegar.link } }));
    definir({ mensagens: [...estado.mensagens, { id: novoId(), role: "assistant", content: r.resposta, acoes: outras.length ? outras.map((acao) => ({ acao, estado: "pendente" as const })) : undefined }] });
    if (r.uso) qc?.setQueryData(["jorginho-status"], (s: any) => (s ? { ...s, usadasHoje: r.uso!.hoje } : s));
    if (abrir) window.setTimeout(() => abrirFormularioComJotinha("nova_demanda", { valores: abrir.valores, voz: opcoes.voz }), 300);
    return { content: r.resposta, abriuFormulario: !!abrir };
  } catch (e: any) {
    const codigo = e instanceof ErroJorginho ? e.codigo : undefined;
    const msg = codigo === "sem_chave" ? "Ainda estou sendo ligado! 🔌 Assim que a chave da IA for configurada no servidor, eu respondo tudo." : e?.message || "Tive um soluço aqui. Tenta de novo?";
    definir({ mensagens: [...estado.mensagens, { id: novoId(), role: "assistant", content: msg, erro: true }] });
    return { content: msg, abriuFormulario: false };
  } finally {
    definir({ pensando: false });
  }
}

/** Ações que ainda esperam confirmação na última resposta do Jotinha. */
export function acoesPendentes() {
  const m = [...estado.mensagens].reverse().find((x) => x.role === "assistant");
  if (!m?.acoes) return null;
  const idx = m.acoes.map((a, i) => (a.estado === "pendente" ? i : -1)).filter((i) => i >= 0);
  return idx.length ? { msgId: m.id, idx, acoes: idx.map((i) => m.acoes![i].acao) } : null;
}

/** Confirma (ou não) uma ação proposta — no botão ou falando, na ligação. */
export async function confirmarAcao(msgId: string, i: number, sim: boolean): Promise<{ ok: boolean; mensagem: string }> {
  const alvo = estado.mensagens.find((m) => m.id === msgId)?.acoes?.[i];
  if (!alvo || alvo.estado !== "pendente") return { ok: false, mensagem: "" };
  const atualizar = (st: "feita" | "cancelada" | "erro", resultado?: string, link?: string) =>
    mudarMensagens((ms) => ms.map((m) => (m.id !== msgId ? m : { ...m, acoes: m.acoes!.map((a, j) => (j === i ? { ...a, estado: st, resultado, link } : a)) })));
  if (!sim) { atualizar("cancelada", "Deixei pra lá 👍"); return { ok: true, mensagem: "Deixei pra lá." }; }
  try {
    const r = await executarAcao(alvo.acao, { uid, nome: nomeQuem });
    atualizar("feita", r.mensagem, r.link);
    ["demandas", "inicio-minhas-tarefas", "kanban-board-cards", "quadro-extras", "inicio-minhas-demandas", "municipes", "google-agenda-eventos"].forEach((k) => qc?.invalidateQueries({ queryKey: [k] }));
    window.dispatchEvent(new CustomEvent("jorginho:reagir", { detail: { tipo: alvo.acao.tipo === "criar_tarefa" ? "tarefa" : "demanda" } }));
    return { ok: true, mensagem: r.mensagem.replace(/\s*✅/, "") };
  } catch (e: any) {
    const msg = "Não deu certo: " + (e?.message || "erro");
    atualizar("erro", msg);
    return { ok: false, mensagem: msg };
  }
}

// Demanda cadastrada pelo formulário: entra na conversa (para "cria uma tarefa vinculada a ela")
if (typeof window !== "undefined") {
  window.addEventListener("jotinha:formulario-salvo", (e) => {
    const { protocolo, titulo } = (e as CustomEvent).detail || {};
    if (!protocolo) return;
    definir({ mensagens: [...estado.mensagens, { id: novoId(), role: "assistant", content: `Demanda #${protocolo} cadastrada${titulo ? ` — "${titulo}"` : ""}. Se quiser, posso criar uma tarefa vinculada a ela.` }] });
  });
}
