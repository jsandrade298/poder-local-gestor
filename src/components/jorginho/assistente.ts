import { useSyncExternalStore } from "react";
import { pedirPreenchimento } from "@/hooks/useJorginho";
import { acoesPendentes, confirmarAcao, enviarNaConversa } from "./conversa";
import { falaDaAcao } from "./acoes";
import { formularioAtual, ouvirFormulario } from "./formulario";
import { falar, mensagemErroVoz, ouvir, ondeOuve, pararFala, podeOuvir, prepararReconhecimento, type Escuta } from "./voz";

/**
 * A ligação com o Jotinha (um motor só, fora das telas — continua viva com a
 * ligação minimizada e a pessoa navegando pelo sistema).
 *  - modo "conversa": pergunta e resposta por voz (a conversa do painel).
 *  - modo "formulario": ele pergunta, a pessoa responde e o formulário vai se
 *    preenchendo na frente dela.
 * Pedir para cadastrar uma demanda no meio da conversa abre o formulário e a
 * ligação segue lá; depois de salvar, volta para a conversa.
 * Fases: falando → ouvindo → pensando → falando… ("parado" = esperando um toque).
 */

export type Fase = "parado" | "falando" | "ouvindo" | "pensando";
export interface EstadoAssistente {
  ativo: boolean;
  modo: "conversa" | "formulario";
  voz: boolean;
  /** Microfone desligado no meio da ligação (ela continua) */
  mudo: boolean;
  /** Ligação minimizada: segue ativa numa pílula no canto da tela */
  minimizada: boolean;
  /** Quando a ligação começou (o cronômetro não zera ao minimizar/trocar de modo) */
  inicio: number;
  /** A transcrição está acontecendo no próprio computador */
  noAparelho: boolean;
  fase: Fase;
  /** O que o Jotinha disse por último (não aparece na tela da ligação; só para leitor de tela) */
  legenda: string;
  /** O que a pessoa está dizendo (ao vivo) ou disse por último */
  ouvido: string;
  erro: string | null;
}

const INICIAL: EstadoAssistente = { ativo: false, modo: "conversa", voz: false, mudo: false, minimizada: false, inicio: 0, noAparelho: false, fase: "parado", legenda: "", ouvido: "", erro: null };
let estado: EstadoAssistente = INICIAL;
const ouvintes = new Set<() => void>();
const definir = (p: Partial<EstadoAssistente>) => { estado = { ...estado, ...p }; ouvintes.forEach((f) => f()); };
export const estadoLigacao = () => estado;

export function useAssistente() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => estado, () => INICIAL);
}

let historico: { role: "user" | "assistant"; content: string }[] = [];
let geracao = 0;
let escuta: Escuta | null = null;
let silencios = 0;
let despedindo = false;
/** Campos que a pessoa preferiu pular neste formulário (o sistema não pergunta de novo) */
let pulados: string[] = [];

const ABERTURAS = [
  "Bora cadastrar juntos! Me conta: qual é o problema e quem está pedindo?",
  "Vamos lá! O que aconteceu e quem é o munícipe que pediu?",
  "Partiu! Me conta a demanda: o que está acontecendo e quem pediu?",
];
const ENCHIMENTOS = ["Anotado…", "Hum, deixa eu ver…", "Certo…", "Só um instante…", "Entendi…"];
const sortear = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Mostra `texto` e fala `voz` (quando o que se lê não soa bem em voz alta, ex.: protocolo). */
async function dizer(texto: string, g: number, voz = texto) {
  if (g !== geracao) return;
  definir({ fase: "falando", legenda: texto });
  if (estado.voz) await falar(voz);
  else await new Promise((r) => setTimeout(r, 350));
}

function esperarResposta(g: number) {
  if (g !== geracao || !estado.ativo) return;
  if (!estado.voz || estado.mudo) { definir({ fase: "parado" }); return; }
  definir({ fase: "ouvindo", ouvido: "", erro: null });
  // Espera saber se dá para ouvir no próprio aparelho (normalmente já resolvido)
  prepararReconhecimento().then(() => {
    if (g !== geracao || estado.fase !== "ouvindo") return;
    definir({ noAparelho: ondeOuve() === "aparelho" });
    const e = ouvir((t) => { if (g === geracao) definir({ ouvido: t }); });
    escuta = e;
    e.resultado.then((t) => {
      if (g !== geracao || escuta !== e) return;
      escuta = null;
      if (!t) {
        silencios += 1;
        // Duas vezes sem ouvir nada: espera um toque no Jotinha
        if (silencios >= 2) { definir({ fase: "parado" }); return; }
        esperarResposta(g);
        return;
      }
      silencios = 0;
      turno(t, g);
    }).catch((err) => {
      if (g !== geracao) return;
      escuta = null;
      const codigo = err?.message || "";
      definir({ fase: "parado", erro: mensagemErroVoz(codigo), voz: codigo === "sem_permissao" || codigo === "sem_reconhecimento" || codigo === "sem_microfone" ? false : estado.voz });
    });
  });
}

const turno = (texto: string, g: number, mostrar = true) =>
  estado.modo === "conversa" ? turnoConversa(texto, g) : turnoFormulario(texto, g, mostrar);

/** Se a IA demorar, ele "pensa alto" para a ligação não ficar muda. */
function pensarAlto(g: number) {
  let enchimento: Promise<void> = Promise.resolve();
  const timer = window.setTimeout(() => { if (g === geracao && estado.voz && !estado.mudo) enchimento = falar(sortear(ENCHIMENTOS)); }, 2200);
  return async () => { window.clearTimeout(timer); await enchimento; };
}

/** Ações que o Jotinha propôs na ligação e esperam um "sim" falado */
let aguardando: { msgId: string; idx: number[] } | null = null;
const normalizarFala = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
function sinal(t: string): "sim" | "nao" | null {
  const n = normalizarFala(t);
  if (/^(nao|cancela|cancelar|espera|deixa|deixa pra la|para|negativo|nem|muda|errado)\b/.test(n)) return "nao";
  if (/^(sim|pode|confirma|confirmo|isso|manda|ok|okay|claro|beleza|fechado|positivo|perfeito|certo|com certeza|faz|faca|bora|vai|correto|exato|show|uhum|aham)\b/.test(n)) return "sim";
  return null;
}

async function turnoConversa(texto: string, g: number) {
  // Resposta a uma confirmação por voz
  if (aguardando) {
    const p = aguardando;
    aguardando = null;
    const s = sinal(texto);
    if (s) {
      definir({ fase: "pensando", ouvido: texto, erro: null });
      const res: string[] = [];
      for (const i of p.idx) res.push((await confirmarAcao(p.msgId, i, s === "sim")).mensagem);
      if (g !== geracao) return;
      await dizer(s === "sim" ? `${res.filter(Boolean).join(" ")} Mais alguma coisa?` : "Beleza, deixei pra lá. Quer mudar alguma coisa?", g);
      esperarResposta(g);
      return;
    }
    // Falou outra coisa: a proposta fica para trás e a conversa segue
    for (const i of p.idx) await confirmarAcao(p.msgId, i, false);
  }
  definir({ fase: "pensando", ouvido: texto, erro: null });
  const acabar = pensarAlto(g);
  const r = await enviarNaConversa(texto, { voz: true });
  await acabar();
  if (g !== geracao) return;
  if (!r) { esperarResposta(g); return; }
  // Pediu para cadastrar: o formulário abre e a ligação continua lá (iniciarAssistente assume)
  if (r.abriuFormulario) { definir({ legenda: r.content, fase: "pensando" }); return; }
  // Propôs algo: repete o que vai fazer e pede o "sim" por voz (na ligação não há botão)
  const pend = acoesPendentes();
  if (pend) {
    aguardando = { msgId: pend.msgId, idx: pend.idx };
    await dizer(`Vou ${pend.acoes.map(falaDaAcao).join("; e também ")}. Posso confirmar?`, g);
    esperarResposta(g);
    return;
  }
  await dizer(r.content, g);
  esperarResposta(g);
}

async function turnoFormulario(texto: string, g: number, mostrar = true) {
  const f = formularioAtual();
  if (!f || g !== geracao) return;
  historico.push({ role: "user", content: texto });
  definir({ fase: "pensando", ouvido: mostrar ? texto : estado.ouvido, erro: null });
  const acabar = pensarAlto(g);
  let r: Awaited<ReturnType<typeof pedirPreenchimento>>;
  try {
    r = await pedirPreenchimento(historico.slice(-16), { id: f.id, titulo: f.titulo, campos: f.campos(), valores: f.valores(), pulados });
  } catch (e: any) {
    await acabar();
    if (g !== geracao) return;
    historico.pop();
    definir({ fase: "parado", erro: e?.message || "Não consegui entender agora. Tenta de novo?" });
    return;
  }
  await acabar();
  if (g !== geracao) return;
  if (r.pulados) pulados = r.pulados;
  // Servidor antigo (só "fala") continua funcionando
  const confirmacao = r.confirmacao ?? (r.pergunta === undefined ? r.fala : "");
  const pergunta = r.pergunta ?? "";

  // Fala o que anotou ENQUANTO os campos se preenchem (é aqui que a mágica aparece).
  // Na hora de salvar, quem confirma é o sistema — a fala da IA ("salvei!") ficaria adiantada.
  const preenchendo = Object.keys(r.preencher || {}).length ? f.preencher(r.preencher) : Promise.resolve({ aplicados: [], avisos: [] });
  const [, res] = await Promise.all([
    r.enviar ? dizer("Salvando…", g, "Salvando!") : confirmacao ? dizer(confirmacao, g) : Promise.resolve(),
    preenchendo,
  ]);
  if (g !== geracao) return;
  // Depois, a pergunta — ou o aviso do sistema (ex.: "achei 3 munícipes com esse nome"), que vem antes de tudo
  const seguinte = res.avisos.length ? res.avisos.join(" ") : pergunta;
  historico.push({ role: "assistant", content: [confirmacao, seguinte].filter(Boolean).join(" ") || r.fala });
  if (seguinte && (res.avisos.length || !r.enviar)) await dizer(seguinte, g);
  if (r.enviar && !res.avisos.length) {
    const faltando = formularioAtual()?.enviar() ?? [];
    if (faltando.length) {
      const aviso = `Antes de salvar, falta ${faltando.join(", ")}.`;
      historico.push({ role: "assistant", content: aviso });
      await dizer(aviso, g);
    } else {
      definir({ fase: "pensando", legenda: "Salvando a demanda…" });
      despedindo = true;
      return; // segue no aviso de "salvo"
    }
  }
  if (r.encerrar) { despedindo = true; encerrarAssistente(); return; }
  esperarResposta(g);
}

/** Começa (ou assume) a ligação dentro de um formulário aberto. */
export async function iniciarAssistente(opcoes: { voz: boolean; relato?: string }) {
  const f = formularioAtual();
  if (!f) return;
  const continuando = estado.ativo; // vinha de uma ligação na conversa
  pararTudo();
  geracao += 1;
  const g = geracao;
  historico = [];
  pulados = [];
  silencios = 0;
  despedindo = false;
  const voz = (opcoes.voz || (continuando && estado.voz)) && podeOuvir();
  if (voz) prepararReconhecimento();
  definir({
    ativo: true, modo: "formulario", voz, minimizada: false, inicio: continuando ? estado.inicio : Date.now(),
    fase: "pensando", legenda: "", ouvido: "", erro: opcoes.voz && !podeOuvir() ? mensagemErroVoz("sem_reconhecimento") : null,
  });
  // A pessoa já contou o caso no pedido ("cadastra a demanda do buraco na rua X…"): vira a primeira resposta
  const relato = (opcoes.relato || "").trim();
  if (relato.split(/\s+/).length >= 7) { await turnoFormulario(relato, g); return; }
  // Só o que a pessoa já contou conta (status/prioridade vêm preenchidos por padrão)
  const v = f.valores();
  const jaContou = ["titulo", "descricao", "municipe"].some((k) => (v[k] || "").trim());
  if (!jaContou) {
    const fala = sortear(ABERTURAS);
    historico.push({ role: "assistant", content: fala });
    await dizer(fala, g);
    esperarResposta(g);
  } else {
    await turnoFormulario("[começar: o formulário já tem campos preenchidos; complete o título se faltar, confirme em uma frase curta o que já tem (sem citar status e prioridade padrão) e pergunte o próximo campo importante]", g, false);
  }
}

/** Liga para o Jotinha (conversa por voz). Chame no clique — é ele que libera o microfone e a voz. */
export async function ligarParaJotinha() {
  if (estado.ativo) { expandirLigacao(); return; }
  if (!podeOuvir()) { definir({ erro: mensagemErroVoz("sem_reconhecimento") }); return; }
  geracao += 1;
  const g = geracao;
  historico = [];
  silencios = 0;
  despedindo = false;
  aguardando = null;
  prepararReconhecimento();
  definir({ ...INICIAL, ativo: true, modo: "conversa", voz: true, inicio: Date.now(), fase: "falando" });
  await dizer("Oi! Tô na linha. Pode falar.", g);
  esperarResposta(g);
}

/** Resposta digitada (ou ditada por fora). */
export function responderAssistente(texto: string) {
  const t = texto.trim();
  if (!t || !estado.ativo || estado.fase === "pensando") return;
  escuta?.parar(); escuta = null;
  pararFala();
  geracao += 1; // o que estava ouvindo/falando fica para trás
  turno(t, geracao);
}

/** Toque no Jotinha: fala agora / termina de ouvir / interrompe. */
export function tocarMicrofone() {
  if (!estado.ativo) return;
  if (estado.fase === "ouvindo") { escuta?.parar(); return; }
  if (estado.fase === "falando") { pararFala(); return; }
  if (estado.fase === "parado") {
    if (!podeOuvir()) { definir({ erro: mensagemErroVoz("sem_reconhecimento") }); return; }
    silencios = 0;
    definir({ voz: true, mudo: false });
    esperarResposta(geracao);
  }
}

/** Mudo: para de ouvir sem encerrar a ligação (e volta a ouvir ao desmutar). */
export function alternarMudo() {
  if (!estado.ativo) return;
  if (estado.mudo) {
    definir({ mudo: false });
    if (estado.fase === "parado") { silencios = 0; esperarResposta(geracao); }
  } else {
    const ouvia = estado.fase === "ouvindo";
    escuta?.parar(); escuta = null; // descarta o que estava ouvindo
    definir({ mudo: true, ...(ouvia ? { fase: "parado" as Fase } : {}) });
  }
}

export function alternarVoz() {
  if (!estado.ativo) return;
  if (estado.voz) { pararTudo(); definir({ voz: false, fase: estado.fase === "pensando" ? "pensando" : "parado" }); }
  else tocarMicrofone();
}

export const minimizarLigacao = () => { if (estado.ativo) definir({ minimizada: true }); };
export const expandirLigacao = () => { if (estado.ativo) definir({ minimizada: false }); };

function pararTudo() { escuta?.parar(); escuta = null; pararFala(); }

export function encerrarAssistente() {
  geracao += 1;
  aguardando = null;
  pararTudo();
  definir({ ...INICIAL });
}

// Formulário salvo: comemora e volta para a conversa (numa ligação) ou encerra
if (typeof window !== "undefined") {
  window.addEventListener("jotinha:formulario-salvo", () => {
    if (!estado.ativo) return;
    const g = geracao;
    despedindo = true;
    (async () => {
      if (estado.voz) {
        await dizer("Prontinho! Demanda cadastrada. Quer mais alguma coisa?", g);
        if (g !== geracao) return;
        despedindo = false;
        definir({ modo: "conversa", minimizada: false });
        esperarResposta(g);
      } else {
        await dizer("Prontinho! Demanda cadastrada. Valeu pela parceria! 🎉", g);
        if (g === geracao) encerrarAssistente();
      }
    })();
  });
  // Não salvou: explica e volta a conversar
  window.addEventListener("jotinha:formulario-erro", (e) => {
    if (!estado.ativo || !despedindo) return;
    despedindo = false;
    const g = geracao;
    const msg = String((e as CustomEvent).detail?.mensagem || "").slice(0, 140);
    (async () => {
      const fala = `Ih, não consegui salvar${msg ? `: ${msg}` : ""}. Quer que eu tente de novo?`;
      historico.push({ role: "assistant", content: fala });
      await dizer(fala, g);
      esperarResposta(g);
    })();
  });
  // Fecharam o formulário no meio: encerra (menos quando é a despedida)
  ouvirFormulario(() => {
    if (!formularioAtual() && estado.ativo && estado.modo === "formulario" && !despedindo) encerrarAssistente();
  });
}
