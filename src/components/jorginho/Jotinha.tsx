import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, Check, EyeOff, Laugh, Loader2, MessageCircle, MoreVertical, Move, Phone, RotateCcw, Send, Sparkles, Volume2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { pedirPiada, pedirWidget, useStatusJorginho, ErroJorginho } from "@/hooks/useJorginho";
import { JorginhoAvatar, type Expressao } from "./JorginhoAvatar";
import { TextoJorginho } from "./TextoJorginho";
import { cumprimento, dicaDaTela, comemorar, gracinha } from "./falas";
import { descreverAcao, executarAcao } from "./acoes";
import { ConteudoWidget } from "./widgets/WidgetJorginho";
import type { ReceitaWidget } from "./widgets/receita";
import { FAIXA, SeloJotinha, SUPERFICIE } from "./ui";
import { Chamada, PilulaLigacao } from "./Chamada";
import { podeOuvir } from "./voz";
import { confirmarAcao, definirContextoConversa, enviarNaConversa, limparConversa, mudarMensagens, useConversa, usarConversaDe } from "./conversa";
import {
  alternarMudo, encerrarAssistente, estadoLigacao, expandirLigacao, ligarParaJotinha, minimizarLigacao, responderAssistente, tocarMicrofone, useAssistente,
} from "./assistente";
import { cn } from "@/lib/utils";

// Só carrega o formulário quando o Jotinha precisa abrir
const NovaDemandaDialog = lazy(() => import("@/components/forms/NovaDemandaDialog").then((m) => ({ default: m.NovaDemandaDialog })));

/**
 * Jotinha — o mascote do Jorgeus.
 *  - Presença: fica no canto, com expressões; cumprimenta, dá dicas da tela
 *    (no máximo uma por tela por dia) e comemora conquistas. Tem "modo foco"
 *    (sem gracinhas) e pode ser escondido.
 *  - Conversa: responde com dados reais do gabinete e propõe ações, que a
 *    pessoa confirma num botão.
 *  - Oficina: a pessoa descreve um widget e ele monta para fixar no Início.
 * Eventos: "jorginho:abrir" {protocolo?, aba?, pergunta?, widget?} abre o painel;
 * "jorginho:reagir" {tipo: "tarefa"|"demanda"|"cartao"} comemora;
 * "jorgeus:abrir-ajuda" (menu da conta) também abre.
 */

interface Prefs {
  foco: boolean; escondido: boolean; som: boolean;
  /** Onde a pessoa deixou o Jotinha (canto de cima à esquerda, em px); null = canto padrão */
  pos: { x: number; y: number } | null;
  diaCumprimento?: string; dicas: Record<string, string>;
  falas: { dia: string; n: number }; piadas: { dia: string; n: number };
}
const PREFS_PADRAO: Prefs = { foco: false, escondido: false, som: true, pos: null, dicas: {}, falas: { dia: "", n: 0 }, piadas: { dia: "", n: 0 } };
const MAX_FALAS_DIA = 6;
const COMEMORANDO: Expressao[] = ["feliz", "coracao", "animado"];
const INTERVALO_FALAS = 3 * 60_000;
/** Piadinhas por conta própria: a primeira entre 6 e 12 min de uso, depois a cada 30–60 min, até 8 por dia */
const MAX_PIADAS_DIA = 8;
const hoje = () => new Date().toLocaleDateString("en-CA");
const novoId = () => Math.random().toString(36).slice(2);
const minutos = (min: number, max: number) => (min + Math.random() * (max - min)) * 60_000;

function usePrefs(uid: string) {
  const chave = `jorginho:${uid}`;
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return { ...PREFS_PADRAO, ...JSON.parse(localStorage.getItem(chave) || "{}") }; } catch { return PREFS_PADRAO; }
  });
  const salvar = useCallback((p: Partial<Prefs> | ((x: Prefs) => Partial<Prefs>)) => setPrefs((atual) => {
    const novo = { ...atual, ...(typeof p === "function" ? p(atual) : p) };
    try { localStorage.setItem(chave, JSON.stringify(novo)); } catch { /* sem storage */ }
    return novo;
  }), [chave]);
  return [prefs, salvar] as const;
}

// ── Som das mensagens (gerado na hora; o navegador só deixa tocar depois do primeiro clique) ──
let audio: AudioContext | null = null;
function liberarSom() {
  try { audio = audio || new (window.AudioContext || (window as any).webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch { /* sem áudio */ }
}
function tocarSom() {
  if (!audio || audio.state !== "running") return;
  const t = audio.currentTime;
  // "plim-plom": duas notinhas curtas e suaves
  [[880, 0], [1318.5, 0.11]].forEach(([f, atraso]) => {
    const o = audio!.createOscillator(), g = audio!.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + atraso);
    g.gain.exponentialRampToValueAtTime(0.12, t + atraso + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atraso + 0.28);
    o.connect(g).connect(audio!.destination);
    o.start(t + atraso); o.stop(t + atraso + 0.3);
  });
}

function momentoDoDia() {
  const d = new Date(), h = d.getHours();
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${dia} ${h < 12 ? "de manhã" : h < 18 ? "à tarde" : "à noite"}`;
}

function sugestoes(caminho: string, protocolo?: string) {
  if (protocolo) return [`Resume a demanda #${protocolo} para mim`, `Escreve uma resposta para o munícipe da #${protocolo}`, `Tem alguma demanda parecida com a #${protocolo}?`];
  if (caminho.startsWith("/agenda")) return ["O que eu tenho amanhã?", "Como está a agenda desta semana?", "Me lembra de ligar para a associação sexta"];
  if (caminho.startsWith("/analises")) return ["Como foi este mês comparado ao anterior?", "Qual área tem mais atrasos?", "Quem da equipe está mais sobrecarregado?"];
  if (caminho.startsWith("/quadros")) return ["Quais são minhas tarefas?", "Cria uma tarefa para revisar o ofício amanhã", "O que está atrasado comigo?"];
  return ["Quero cadastrar uma demanda", "O que eu tenho hoje?", "Quantas demandas estão atrasadas?", "Me conta uma piada"];
}

interface Balao { texto: string; id: number; paraConversa?: boolean }

export function Jotinha() {
  const { user, profile } = useAuth();
  const uid = user?.id || "anon";
  const primeiro = (profile?.nome || "").split(" ")[0];
  const local = useLocation();
  const celular = useIsMobile();
  const [prefs, salvarPrefs] = usePrefs(uid);
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"conversa" | "oficina">("conversa");
  const [contexto, setContexto] = useState<{ protocolo?: string }>({});
  const [perguntaInicial, setPerguntaInicial] = useState<string | null>(null);
  const [widgetEditando, setWidgetEditando] = useState<any | null>(null);
  const [balao, setBalao] = useState<Balao | null>(null);
  const [injetar, setInjetar] = useState<{ id: string; texto: string } | null>(null);
  const [naoLida, setNaoLida] = useState<string | null>(null);
  const [expressao, setExpressao] = useState<Expressao>("normal");
  const [arrastando, setArrastando] = useState<{ x: number; y: number } | null>(null);
  /** Formulário que o Jotinha abriu para preencher junto (a chave recria o diálogo a cada pedido) */
  const [formJotinha, setFormJotinha] = useState<{ chave: number; assistente: { voz: boolean; valores?: Record<string, string>; relato?: string } } | null>(null);
  const ultimaFala = useRef(0);
  const nomeAtual = useRef(primeiro);
  nomeAtual.current = primeiro;
  const prefsRef = useRef(prefs); prefsRef.current = prefs;
  const abertoRef = useRef(aberto); abertoRef.current = aberto;
  const timerBalao = useRef<number>();
  const timerExpr = useRef<number>();
  const arraste = useRef<{ x0: number; y0: number; left: number; top: number; moveu: boolean } | null>(null);
  const arrastou = useRef(false);
  const caixa = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const lig = useAssistente();
  /** O formulário fechou porque salvou (não é "minimizar") */
  const salvouRef = useRef(false);

  // A conversa (e a ligação) vivem fora do painel: ligam-se à pessoa e sabem em que tela ela está
  useEffect(() => { usarConversaDe(uid, qc, profile?.nome); }, [uid, qc, profile?.nome]);
  // "Abre a demanda…": navega; numa ligação, minimiza para a pessoa ver a tela
  const irPara = useNavigate();
  useEffect(() => {
    const ir = (e: Event) => {
      const link = (e as CustomEvent).detail?.link as string | undefined;
      if (!link) return;
      if (estadoLigacao().ativo && estadoLigacao().modo === "conversa") { minimizarLigacao(); setAberto(false); }
      else if (celular) setAberto(false);
      irPara(link);
    };
    window.addEventListener("jotinha:navegar", ir);
    return () => window.removeEventListener("jotinha:navegar", ir);
  }, [irPara, celular]);
  useEffect(() => { definirContextoConversa({ tela: local.pathname }); }, [local.pathname]);
  // Ligação na conversa: o painel mostra a tela de telefone (e volta a abrir ao sair do minimizado)
  useEffect(() => { if (lig.ativo && lig.modo === "conversa" && !lig.minimizada) { setAba("conversa"); setAberto(true); } }, [lig.ativo, lig.modo, lig.minimizada]);
  /** Fechar o painel durante a ligação = minimizar (ela continua numa pílula no canto) */
  const mudarAberto = (v: boolean) => { if (!v && lig.ativo && lig.modo === "conversa") minimizarLigacao(); setAberto(v); };

  // O primeiro toque/clique na página libera o som
  useEffect(() => {
    const um = () => { liberarSom(); window.removeEventListener("pointerdown", um); window.removeEventListener("keydown", um); };
    window.addEventListener("pointerdown", um); window.addEventListener("keydown", um);
    return () => { window.removeEventListener("pointerdown", um); window.removeEventListener("keydown", um); };
  }, []);

  const expressar = useCallback((e: Expressao, ms = 2500) => {
    setExpressao(e);
    window.clearTimeout(timerExpr.current);
    timerExpr.current = window.setTimeout(() => setExpressao("normal"), ms);
  }, []);

  /** Mostra um balão (respeita modo foco e o limite do dia, exceto comemorações e piadas). */
  const falar = useCallback((texto: string, opcoes: { forcar?: boolean; expr?: Expressao; som?: boolean; paraConversa?: boolean; duracao?: number } = {}) => {
    if (abertoRef.current) return;
    const p = prefsRef.current;
    if (!opcoes.forcar) {
      if (p.foco || p.escondido) return;
      if (Date.now() - ultimaFala.current < INTERVALO_FALAS) return;
      const n = p.falas.dia === hoje() ? p.falas.n : 0;
      if (n >= MAX_FALAS_DIA) return;
      salvarPrefs({ falas: { dia: hoje(), n: n + 1 } });
    }
    ultimaFala.current = Date.now();
    setBalao({ texto, id: Date.now(), paraConversa: opcoes.paraConversa });
    if (opcoes.som && p.som) tocarSom();
    expressar(opcoes.expr || "falando", 2600);
    window.clearTimeout(timerBalao.current);
    timerBalao.current = window.setTimeout(() => setBalao(null), opcoes.duracao ?? 9000);
  }, [salvarPrefs, expressar]);

  /** Piadinha por conta própria: vem da IA (com reserva local), toca o som e fica guardada para a conversa. */
  const contarPiada = useCallback(async (forcar = false) => {
    const p = prefsRef.current;
    const n = p.piadas.dia === hoje() ? p.piadas.n : 0;
    if (!forcar && (p.foco || p.escondido || n >= MAX_PIADAS_DIA)) return false;
    expressar("pensando", 8000);
    let texto: string;
    try { texto = (await pedirPiada(momentoDoDia())).piada; } catch { texto = gracinha(); }
    salvarPrefs({ piadas: { dia: hoje(), n: n + 1 } });
    if (abertoRef.current) { setInjetar({ id: novoId(), texto }); expressar("piscando", 2500); return true; }
    setNaoLida(texto);
    // Em outra aba do navegador: o som avisa e o título ganha 💬 até a pessoa voltar
    if (document.visibilityState !== "visible" && !document.title.startsWith("💬")) document.title = `💬 ${document.title}`;
    falar(texto, { forcar: true, expr: "piscando", som: true, paraConversa: true, duracao: document.visibilityState === "visible" ? 25_000 : 120_000 });
    return true;
  }, [expressar, falar, salvarPrefs]);

  // Agenda das piadinhas (só com a aba visível e o painel fechado)
  useEffect(() => {
    if (!user) return;
    let t: number;
    const agendar = (ms: number) => { t = window.setTimeout(tentar, ms); };
    const tentar = async () => {
      const p = prefsRef.current;
      const n = p.piadas.dia === hoje() ? p.piadas.n : 0;
      if (n >= MAX_PIADAS_DIA) return; // por hoje chega
      if (abertoRef.current || p.foco || p.escondido || estadoLigacao().ativo) { agendar(minutos(3, 6)); return; }
      await contarPiada();
      agendar(minutos(30, 60));
    };
    agendar(minutos(6, 12));
    const voltou = () => { if (document.visibilityState === "visible" && document.title.startsWith("💬 ")) document.title = document.title.slice(3); };
    document.addEventListener("visibilitychange", voltou);
    const agora = () => { contarPiada(true); };
    window.addEventListener("jorginho:piada", agora);
    return () => { window.clearTimeout(t); window.removeEventListener("jorginho:piada", agora); document.removeEventListener("visibilitychange", voltou); };
  }, [user, contarPiada]);

  // Cumprimento: uma vez por dia (espera o perfil carregar para dizer o nome)
  useEffect(() => {
    if (!user || !profile || prefs.diaCumprimento === hoje()) return;
    const t = window.setTimeout(() => {
      salvarPrefs({ diaCumprimento: hoje() });
      falar(cumprimento(nomeAtual.current), { expr: "acenando" });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [user, !!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dica da tela: no máximo uma por tela por dia (e às vezes nem isso)
  useEffect(() => {
    if (!user) return;
    const rota = local.pathname.split("/").slice(0, 2).join("/") || "/";
    if (prefs.dicas[rota] === hoje()) return;
    const dica = dicaDaTela(local.pathname);
    if (!dica || Math.random() > 0.45) return;
    const t = window.setTimeout(() => {
      salvarPrefs((p) => ({ dicas: { ...p.dicas, [rota]: hoje() } }));
      falar(dica, { expr: "ideia" });
    }, 6000);
    return () => window.clearTimeout(t);
  }, [local.pathname, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Noite: cochila (só a expressão)
  const horaDeDormir = (() => { const h = new Date().getHours(); return h >= 23 || h < 5; })();

  const abrirPainel = useCallback((opcoes: { protocolo?: string; aba?: "conversa" | "oficina"; pergunta?: string | null; widget?: any } = {}) => {
    setContexto(opcoes.protocolo ? { protocolo: opcoes.protocolo } : {});
    definirContextoConversa({ protocolo: opcoes.protocolo });
    setAba(opcoes.aba === "oficina" ? "oficina" : "conversa");
    setPerguntaInicial(opcoes.pergunta || null);
    setWidgetEditando(opcoes.widget || null);
    // A piadinha que ele contou sozinho entra na conversa
    if (naoLida) { setInjetar({ id: novoId(), texto: naoLida }); setNaoLida(null); }
    setBalao(null);
    setAberto(true);
  }, [naoLida]);

  // Eventos do app
  useEffect(() => {
    const abrir = (e: Event) => abrirPainel((e as CustomEvent).detail || {});
    const ajuda = () => abrirPainel();
    const reagir = (e: Event) => {
      const tipo = (e as CustomEvent).detail?.tipo as "tarefa" | "demanda" | "cartao" | undefined;
      if (!tipo) return;
      if (prefsRef.current.foco || prefsRef.current.escondido) { expressar("feliz", 1800); return; }
      falar(comemorar(tipo), { forcar: true, expr: COMEMORANDO[Math.floor(Math.random() * COMEMORANDO.length)] });
    };
    const abrirFormulario = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.formulario !== "nova_demanda") return;
      setAberto(false);
      setFormJotinha({ chave: Date.now(), assistente: { voz: d.voz ?? podeOuvir(), valores: d.valores, relato: d.relato } });
    };
    window.addEventListener("jotinha:abrir-formulario", abrirFormulario);
    // Demanda salva pelo formulário: comemora com o protocolo no balão
    const salvo = (e: Event) => {
      salvouRef.current = true;
      const { protocolo } = (e as CustomEvent).detail || {};
      window.setTimeout(() => falar(`Prontinho! Demanda ${protocolo ? `#${protocolo} ` : ""}cadastrada 🎉`, { forcar: true, expr: "feliz", duracao: 12_000 }), 400);
    };
    window.addEventListener("jotinha:formulario-salvo", salvo);
    (window as any).__jorgeusAjuda = true;
    window.addEventListener("jorginho:abrir", abrir);
    window.addEventListener("jorgeus:abrir-ajuda", ajuda);
    window.addEventListener("jorginho:reagir", reagir);
    return () => {
      (window as any).__jorgeusAjuda = false;
      window.removeEventListener("jotinha:abrir-formulario", abrirFormulario);
      window.removeEventListener("jotinha:formulario-salvo", salvo);
      window.removeEventListener("jorginho:abrir", abrir);
      window.removeEventListener("jorgeus:abrir-ajuda", ajuda);
      window.removeEventListener("jorginho:reagir", reagir);
    };
  }, [abrirPainel, falar, expressar]);

  // ── Arrastar: a pessoa leva o Jotinha para onde ele não atrapalhe ──
  const tam = celular ? 48 : 62;
  const altura = celular ? 56 : 72; // o clipe é mais alto que largo (230 × 270)
  const limitar = useCallback((x: number, y: number) => ({
    x: Math.round(Math.min(Math.max(8, x), window.innerWidth - tam - 8)),
    y: Math.round(Math.min(Math.max(8, y), window.innerHeight - altura - 8)),
  }), [tam, altura]);
  useEffect(() => {
    if (!prefs.pos) return;
    const ajustar = () => { const p = limitar(prefsRef.current.pos!.x, prefsRef.current.pos!.y); if (p.x !== prefsRef.current.pos!.x || p.y !== prefsRef.current.pos!.y) salvarPrefs({ pos: p }); };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [!!prefs.pos, limitar]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoPressionar = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    arraste.current = { x0: e.clientX, y0: e.clientY, left: r.left, top: r.top, moveu: false };
    arrastou.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arraste.current;
    if (!a) return;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (!a.moveu && Math.hypot(dx, dy) < 6) return;
    a.moveu = true;
    setBalao(null);
    setArrastando(limitar(a.left + dx, a.top + dy));
  };
  const aoSoltar = () => {
    const a = arraste.current;
    arraste.current = null;
    if (a?.moveu && arrastando) { salvarPrefs({ pos: arrastando }); arrastou.current = true; }
    setArrastando(null);
  };

  if (!user) return null;

  const pos = arrastando || prefs.pos;
  const balaoADireita = pos ? pos.x + tam / 2 < window.innerWidth / 2 : false;
  const balaoEmbaixo = pos ? pos.y < 220 : false;
  const estiloCaixa: React.CSSProperties | undefined = pos ? { left: pos.x, top: pos.y } : undefined;

  return (
    <>
      {/* Ligação minimizada: segue ativa numa pílula, mesmo trocando de tela */}
      {lig.ativo && lig.minimizada && (
        <div className={cn("fixed z-40 animate-in fade-in slide-in-from-bottom-2", celular ? "bottom-[84px] left-3 right-3" : "bottom-5 right-5")}>
          <PilulaLigacao fase={lig.fase} mudo={lig.mudo} inicio={lig.inicio} onExpandir={expandirLigacao} onMudo={alternarMudo} onDesligar={encerrarAssistente} />
        </div>
      )}
      {lig.ativo ? null : prefs.escondido ? (
        <button type="button" onClick={() => salvarPrefs({ escondido: false })} title="Mostrar o Jotinha"
          className={cn("fixed z-40 grid place-items-center rounded-l-xl border border-r-0 bg-card p-1 shadow-md", celular ? "right-0 bottom-[96px]" : "right-0 bottom-8")}>
          <JorginhoAvatar className="h-9 w-8" expressao="normal" parado />
        </button>
      ) : (
        <div ref={caixa} style={estiloCaixa}
          className={cn("fixed z-40", !pos && (celular ? "right-3 bottom-[84px]" : "right-5 bottom-5"))}>
          {balao && !aberto && !arrastando && (
            <div key={balao.id} role="status"
              className={cn("absolute w-max max-w-[min(290px,calc(100vw-32px))] animate-in fade-in px-3.5 pb-2.5 pt-2 text-sm", SUPERFICIE, "shadow-xl",
                balaoEmbaixo ? "top-full mt-2 slide-in-from-top-2" : "bottom-full mb-2 slide-in-from-bottom-2",
                balaoADireita ? "left-0" : "right-0",
                balaoEmbaixo ? (balaoADireita ? "rounded-tl-sm" : "rounded-tr-sm") : (balaoADireita ? "rounded-bl-sm" : "rounded-br-sm"))}>
              <button type="button" onClick={() => setBalao(null)} className={cn("absolute -top-2 grid h-5 w-5 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground", balaoADireita ? "-right-2" : "-left-2")} aria-label="Fechar">
                <X className="h-3 w-3" />
              </button>
              <SeloJotinha className="mb-1" />
              <button type="button" className="text-left leading-snug" onClick={() => abrirPainel()}>{balao.texto}</button>
              {balao.paraConversa && <button type="button" onClick={() => abrirPainel()} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/15"><MessageCircle className="h-3 w-3" /> Responder ao Jotinha</button>}
            </div>
          )}
          <button type="button"
            onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
            onClick={() => { if (arrastou.current) { arrastou.current = false; return; } abrirPainel(); }}
            onDoubleClick={() => falar(gracinha(), { forcar: true, expr: "piscando" })}
            className={cn("group relative block touch-none rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              arrastando ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105", celular ? "h-14 w-12" : "h-[72px] w-[62px]")}
            aria-label="Falar com o Jotinha (arraste para mudar de lugar)" title="Falar com o Jotinha · arraste para mudar de lugar">
            <JorginhoAvatar className="pointer-events-none h-full w-full drop-shadow-[0_6px_10px_rgba(15,27,61,0.25)]" expressao={arrastando ? "animado" : aberto ? "coracao" : horaDeDormir && expressao === "normal" ? "dormindo" : expressao} />
            {naoLida && !balao && <span className="absolute right-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-red-500 shadow" aria-label="mensagem nova" />}
          </button>
        </div>
      )}

      <Sheet open={aberto} onOpenChange={mudarAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" data-sheet>
          <CabecalhoPainel aba={aba} setAba={setAba} prefs={prefs} salvarPrefs={salvarPrefs} onFechar={() => mudarAberto(false)}
            onPiada={() => contarPiada(true)} />
          {aba === "conversa" ? (
            <Conversa uid={uid} nome={profile?.nome} contexto={contexto} perguntaInicial={perguntaInicial} onPerguntaUsada={() => setPerguntaInicial(null)}
              injetar={injetar} onNavegar={() => celular && mudarAberto(false)} onAbrirOficina={() => setAba("oficina")} onMinimizar={() => mudarAberto(false)} />
          ) : (
            <Oficina editando={widgetEditando} onSalvo={() => { setWidgetEditando(null); setAberto(false); }} />
          )}
        </SheetContent>
      </Sheet>

      {formJotinha && (
        <Suspense fallback={null}>
          <NovaDemandaDialog key={formJotinha.chave}
            // Minimizado: o formulário some da tela, mas segue vivo e se preenchendo
            aberto={!(lig.ativo && lig.modo === "formulario" && lig.minimizada)}
            onAbertoChange={(v) => {
              if (v) return;
              if (salvouRef.current) { salvouRef.current = false; setFormJotinha(null); return; }
              // Fechar no meio de uma ligação por voz = minimizar (desligar é no botão vermelho)
              if (lig.ativo && lig.modo === "formulario" && lig.voz) { minimizarLigacao(); return; }
              setFormJotinha(null);
            }}
            assistente={formJotinha.assistente} />
        </Suspense>
      )}
    </>
  );
}

function CabecalhoPainel({ aba, setAba, prefs, salvarPrefs, onFechar, onPiada }: {
  aba: "conversa" | "oficina"; setAba: (a: "conversa" | "oficina") => void;
  prefs: Prefs; salvarPrefs: (p: Partial<Prefs>) => void; onFechar: () => void; onPiada: () => void;
}) {
  const status = useStatusJorginho();
  return (
    <div className={cn("border-b border-primary/10 px-4 pb-2 pt-3", FAIXA)}>
      <div className="flex items-center gap-3">
        <JorginhoAvatar className="h-16 w-14 shrink-0" expressao="acenando" />
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-base font-bold tracking-tight">Jotinha</SheetTitle>
          <SheetDescription className="text-xs">
            {status.data && !status.data.ia ? "A IA ainda não foi ligada no servidor"
              : status.data ? `Assessor-mascote · ${status.data.usadasHoje}${status.data.limiteDia ? `/${status.data.limiteDia}` : ""} ${status.data.usadasHoje === 1 ? "conversa" : "conversas"} hoje`
              : "Assessor-mascote do gabinete"}
          </SheetDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Opções do Jotinha"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => { setAba("conversa"); onPiada(); }}>
              <Laugh className="mr-2 h-4 w-4" /> Conta uma piada agora
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={prefs.som} onCheckedChange={(v) => salvarPrefs({ som: !!v })}>
              <Volume2 className="mr-2 h-4 w-4" /> Som das mensagens
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={prefs.foco} onCheckedChange={(v) => salvarPrefs({ foco: !!v })}>
              <BellOff className="mr-2 h-4 w-4" /> Modo foco (sem gracinhas)
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {prefs.pos && (
              <DropdownMenuItem onSelect={() => salvarPrefs({ pos: null })}>
                <Move className="mr-2 h-4 w-4" /> Voltar o Jotinha para o canto
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => { salvarPrefs({ escondido: true }); onFechar(); }}>
              <EyeOff className="mr-2 h-4 w-4" /> Esconder o Jotinha
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="w-6" aria-hidden />{/* espaço para o X da própria gaveta */}
      </div>
      <div className="mt-3 grid grid-cols-2 rounded-lg bg-muted/60 p-0.5" role="tablist">
        {([["conversa", "Conversa", MessageCircle], ["oficina", "Oficina", Wand2]] as const).map(([v, r, Ic]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
            className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs", aba === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Ic className="h-3.5 w-3.5" /> {r}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Conversa ─────────────────────────────────────────────────────

function Conversa({ uid, nome, contexto, perguntaInicial, onPerguntaUsada, injetar, onNavegar, onAbrirOficina, onMinimizar }: {
  uid: string; nome?: string | null; contexto: { protocolo?: string }; perguntaInicial: string | null; onPerguntaUsada: () => void;
  /** Piadinha que ele contou por conta própria: entra como mensagem dele */
  injetar: { id: string; texto: string } | null;
  onNavegar: () => void; onAbrirOficina: () => void;
  /** Minimiza a ligação (o painel fecha e ela segue numa pílula no canto) */
  onMinimizar: () => void;
}) {
  const local = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { mensagens: msgs, pensando } = useConversa();
  const lig = useAssistente();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, pensando]);
  useEffect(() => { const t = window.setTimeout(() => entrada.current?.focus(), 250); return () => window.clearTimeout(t); }, []);

  const enviar = (t: string) => { if (!t.trim()) return; setTexto(""); enviarNaConversa(t); };

  useEffect(() => {
    if (!injetar) return;
    mudarMensagens((m) => (m.some((x) => x.id === injetar.id) ? m : [...m, { id: injetar.id, role: "assistant", content: injetar.texto }]));
  }, [injetar]);

  // Pergunta vinda de outro lugar (ex.: botão na demanda)
  useEffect(() => { if (perguntaInicial) { onPerguntaUsada(); enviar(perguntaInicial); } }, [perguntaInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = (msgId: string, i: number, sim: boolean) => { confirmarAcao(msgId, i, sim); };

  // Em ligação: tela de telefone, sem as mensagens escritas (elas ficam na conversa para depois)
  if (lig.ativo && lig.modo === "conversa") {
    return (
      <Chamada variante="cheia" fase={lig.fase} mudo={lig.mudo} erro={lig.erro} fala={lig.legenda} inicio={lig.inicio} noAparelho={lig.noAparelho}
        onTocar={tocarMicrofone} onMudo={alternarMudo} onDesligar={encerrarAssistente} onDigitar={responderAssistente} onMinimizar={onMinimizar} />
    );
  }

  const vazia = msgs.length === 0;
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {vazia && (
          <div className="space-y-3">
            <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5 text-sm">
              {contexto.protocolo
                ? <>Oi! Vi que você está na demanda <strong>#{contexto.protocolo}</strong>. Posso resumir, rascunhar a resposta ao munícipe ou procurar parecidas.</>
                : <>Oi{nome ? `, ${nome.split(" ")[0]}` : ""}! Eu sou o Jotinha 👋 Pode me pedir para <strong>cadastrar uma demanda</strong> (e o munícipe, se for novo), <strong>criar uma tarefa</strong> em qualquer quadro, mudar status, prazo ou responsável, registrar uma visita ou um atendimento, abrir o <strong>prontuário</strong> de alguém ou marcar um compromisso — <strong>a gente faz junto</strong>: eu pergunto, você responde (pode ser falando 🎙️) e eu vou preenchendo. Também te conto como estão as demandas, a agenda e os números do gabinete.</>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {podeOuvir() && (
                <button type="button" onClick={() => ligarParaJotinha()} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:brightness-110"><Phone className="h-3 w-3" /> Falar por voz</button>
              )}
              {sugestoes(local.pathname, contexto.protocolo).map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">{s}</button>
              ))}
              <button type="button" onClick={onAbrirOficina} className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-primary hover:border-primary"><Wand2 className="h-3 w-3" /> Criar um widget</button>
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start gap-2")}>
            {m.role === "assistant" && <JorginhoAvatar className="mt-0.5 h-9 w-8 shrink-0" expressao={m.erro ? "erro" : "normal"} parado />}
            <div className={cn("max-w-[85%] space-y-2 text-sm", m.role === "user" ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground" : "min-w-0")}>
              {m.role === "user" ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p> : (
                <div className={cn("rounded-2xl rounded-tl-sm px-3.5 py-2.5", m.erro ? "border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30" : "bg-muted/60")}>
                  <TextoJorginho texto={m.content} onLink={onNavegar} />
                </div>
              )}
              {m.acoes?.map((a, i) => {
                const d = descreverAcao(a.acao);
                return (
                  <div key={i} className={cn(SUPERFICIE, "rounded-xl p-3 shadow-sm")}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" /> {d.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-4 [overflow-wrap:anywhere]">{d.detalhe}</p>
                    {a.estado === "pendente" ? (
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => confirmar(m.id, i, false)}>Agora não</Button>
                        <Button size="sm" className="h-7 gap-1" onClick={() => confirmar(m.id, i, true)}><Check className="h-3.5 w-3.5" /> Confirmar</Button>
                      </div>
                    ) : (
                      <p className={cn("mt-2 text-xs", a.estado === "erro" ? "text-destructive" : a.estado === "feita" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                        {a.resultado}{a.link && <> · <button type="button" onClick={() => { navigate(a.link!); onNavegar(); }} className="underline">abrir</button></>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><JorginhoAvatar className="h-9 w-8" expressao="ocupado" /> procurando no sistema…</div>
        )}
        <div ref={fim} />
      </div>
      <form className="border-t bg-card p-3" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
        <div className="flex items-end gap-2">
          <Textarea ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} placeholder="Pergunte ou peça algo ao Jotinha…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
            className="max-h-32 min-h-[40px] resize-none text-sm" aria-label="Mensagem para o Jotinha" />
          {podeOuvir() && !texto.trim() ? (
            <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => ligarParaJotinha()} disabled={pensando} aria-label="Falar por voz" title="Falar por voz (como numa ligação)">
              <Phone className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!texto.trim() || pensando} aria-label="Enviar">
              {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Ele só vê o que você já pode ver. Nada é salvo sem você confirmar.</span>
          {msgs.length > 0 && <button type="button" onClick={limparConversa} className="inline-flex items-center gap-0.5 hover:text-foreground"><RotateCcw className="h-3 w-3" /> nova conversa</button>}
        </div>
      </form>
    </>
  );
}

// ── Oficina ──────────────────────────────────────────────────────

const EXEMPLOS = [
  "Minhas demandas atrasadas",
  "Demandas de saúde por bairro neste mês",
  "Quantas concluímos nesta semana, com meta de 20",
  "Entradas por semana nos últimos 3 meses",
  "Demandas que vencem nos próximos 7 dias",
];

function Oficina({ editando, onSalvo }: { editando: any | null; onSalvo: () => void }) {
  const qc = useQueryClient();
  const [pedido, setPedido] = useState("");
  const [receita, setReceita] = useState<ReceitaWidget | null>(editando?.spec ?? null);
  const [compartilhar, setCompartilhar] = useState<boolean>(!!editando?.compartilhado);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async (texto: string) => {
    const t = texto.trim();
    if (!t || gerando) return;
    setGerando(true); setErro(null);
    try {
      const r = await pedirWidget(t, receita);
      setReceita(r.receita);
      setPedido("");
      if (r.uso) qc.setQueryData(["jorginho-status"], (s: any) => (s ? { ...s, usadasHoje: r.uso!.hoje } : s));
    } catch (e: any) {
      setErro(e instanceof ErroJorginho && e.codigo === "sem_chave" ? "Ainda estou sendo ligado! Assim que a chave da IA for configurada, eu monto widgets." : e?.message || "Não consegui montar agora.");
    } finally { setGerando(false); }
  };

  const salvar = async () => {
    if (!receita) return;
    setSalvando(true);
    try {
      if (editando?.id) {
        const { error } = await (supabase.from("jorginho_widgets") as any).update({ titulo: receita.titulo, spec: receita, compartilhado: compartilhar, updated_at: new Date().toISOString() }).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("jorginho_widgets") as any).insert({ titulo: receita.titulo, spec: receita, compartilhado: compartilhar, pedido: null });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["jorginho-widgets"] });
      toast.success(editando ? "Widget atualizado" : "Widget fixado no Início 🎉");
      onSalvo();
    } catch (e: any) {
      toast.error("Não foi possível salvar: " + (e?.message || "erro"));
    } finally { setSalvando(false); }
  };

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!receita ? (
          <div className="space-y-3">
            <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5 text-sm">
              Na Oficina você me diz o que quer acompanhar e eu monto um <strong>widget</strong> para o seu Início, com os números de verdade do gabinete. 🛠️
            </div>
            <p className="text-xs font-medium text-muted-foreground">Ideias para começar</p>
            <div className="flex flex-wrap gap-1.5">
              {EXEMPLOS.map((e) => <button key={e} type="button" onClick={() => gerar(e)} disabled={gerando} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50">{e}</button>)}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Prévia, com os números de agora</p>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <JorginhoAvatar className="h-9 w-8" expressao="ideia" parado />
                <p className="titulo-compacto text-sm font-semibold">{receita.titulo}</p>
              </div>
              <ConteudoWidget receita={receita} />
            </div>
            {receita.explicacao && <p className="text-xs text-muted-foreground">💬 {receita.explicacao}</p>}
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>Compartilhar com a equipe<span className="block text-[11px] text-muted-foreground">Aparece no Início de todos do gabinete.</span></span>
              <Switch checked={compartilhar} onCheckedChange={setCompartilhar} />
            </label>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setReceita(null); setErro(null); }}>Começar de novo</Button>
              <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Fixar no Início"}</Button>
            </div>
          </div>
        )}
        {gerando && <div className="flex items-center gap-2 text-xs text-muted-foreground"><JorginhoAvatar className="h-9 w-8" expressao="ocupado" /> montando o widget…</div>}
        {erro && <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/30">{erro}</p>}
      </div>
      <form className="border-t bg-card p-3" onSubmit={(e) => { e.preventDefault(); gerar(pedido); }}>
        <div className="flex items-end gap-2">
          <Textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={2}
            placeholder={receita ? "Quer ajustar? Ex.: \"só da área de saúde\", \"em barras por bairro\"" : "O que você quer ver no Início?"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gerar(pedido); } }}
            className="max-h-32 min-h-[56px] resize-none text-sm" aria-label="Pedido do widget" />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!pedido.trim() || gerando} aria-label="Montar">
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </>
  );
}
