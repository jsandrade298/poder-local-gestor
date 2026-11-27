import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { conversarComJorginho, ErroJorginho, type AcaoJorginho } from "@/hooks/useJorginho";
import { abrirFormularioComJotinha } from "./formulario";

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
const ouvintes = new Set<() => void>();
const chave = () => `jorginho-conversa:${uid}`;

function definir(p: Partial<Estado>) {
  estado = { ...estado, ...p };
  try { sessionStorage.setItem(chave(), JSON.stringify(estado.mensagens.slice(-30))); } catch { /* sem storage */ }
  ouvintes.forEach((f) => f());
}

/** Liga a conversa à pessoa logada (carrega o que ela já conversou nesta aba). */
export function usarConversaDe(id: string, cliente: QueryClient) {
  qc = cliente;
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
    // "Abrir formulário" não precisa de confirmação: ele abre e preenche junto (nada é salvo sem a pessoa)
    const abrir = r.acoes?.find((a) => a.tipo === "abrir_formulario") as Extract<AcaoJorginho, { tipo: "abrir_formulario" }> | undefined;
    const outras = (r.acoes ?? []).filter((a) => a.tipo !== "abrir_formulario");
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
