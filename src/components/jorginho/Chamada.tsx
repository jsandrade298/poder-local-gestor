import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Keyboard, Maximize2, Mic, MicOff, PhoneOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { JorginhoAvatar, type Expressao } from "./JorginhoAvatar";
import { expressaoDaFase, type Fase } from "./ui";

/**
 * Ligação com o Jotinha, como no telefone: o mascote, o tempo de ligação,
 * o estado (ouvindo / falando / pensando) e os botões — SEM transcrição na
 * tela (senão vira "microfone do teclado"). O que ele fala vai só para
 * leitores de tela (aria-live).
 *  - "cheia": ocupa o painel da conversa.
 *  - "compacta": fica no topo do formulário, para os campos se preenchendo
 *    continuarem à vista.
 */

const CSS_CHAMADA = `
@keyframes jt-barra { 0%, 100% { transform: scaleY(.3) } 50% { transform: scaleY(1) } }
.jt-barra { transform-origin: center; animation: jt-barra .9s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .jt-barra { animation: none } }
`;
if (typeof document !== "undefined") {
  const el = document.getElementById("jotinha-chamada-css") || Object.assign(document.createElement("style"), { id: "jotinha-chamada-css" });
  el.textContent = CSS_CHAMADA;
  if (!el.parentNode) document.head.appendChild(el);
}

/** Barrinhas de som: mexem quando alguém está falando */
function Barras({ ativo }: { ativo: boolean }) {
  return (
    <span className="inline-flex h-3.5 items-center gap-[3px]" aria-hidden>
      {[0, 0.15, 0.3, 0.1].map((d, i) => (
        <span key={i} className={cn("h-full w-[3px] rounded-full bg-current", ativo ? "jt-barra" : "scale-y-[0.3] opacity-60")} style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

function useCronometro(inicio: number) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((agora - inicio) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const statusChamada = (f: Fase, mudo: boolean) =>
  f === "falando" ? "Jotinha falando…" : f === "ouvindo" ? "Ouvindo você…" : f === "pensando" ? "Pensando…" : mudo ? "Microfone desligado" : "Toque no Jotinha para falar";

function BotaoChamada({ onClick, rotulo, ativo, perigo, grande, children, className }: {
  onClick: () => void; rotulo: string; ativo?: boolean; perigo?: boolean; grande?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo} aria-pressed={ativo}
      className={cn("grid shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70", className,
        grande ? "h-14 w-14" : "h-10 w-10",
        perigo ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600" : ativo ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20")}>
      {children}
    </button>
  );
}

export function Chamada({ variante, fase, mudo, erro, fala, inicio, noAparelho, onTocar, onMudo, onDesligar, onDigitar, onMinimizar, className }: {
  variante: "cheia" | "compacta"; fase: Fase; mudo: boolean; erro?: string | null;
  /** Quando a ligação começou (o cronômetro continua ao minimizar) */
  inicio: number;
  /** A voz está sendo transcrita no próprio computador */
  noAparelho?: boolean;
  /** Minimiza: a ligação segue numa pílula no canto, mesmo trocando de tela */
  onMinimizar?: () => void;
  /** O que o Jotinha acabou de dizer (só para leitor de tela) */
  fala?: string;
  onTocar: () => void; onMudo: () => void; onDesligar: () => void;
  /** Resposta digitada (o teclado fica escondido até a pessoa pedir) */
  onDigitar?: (texto: string) => void;
  className?: string;
}) {
  const tempo = useCronometro(inicio);
  const [teclado, setTeclado] = useState(false);
  const [texto, setTexto] = useState("");
  const vivo = fase === "falando" || fase === "ouvindo";
  const expr: Expressao = expressaoDaFase(fase, !!erro);
  const enviar = () => { const t = texto.trim(); if (!t || !onDigitar) return; onDigitar(t); setTexto(""); };

  const campoTexto = teclado && onDigitar ? (
    <div className="flex items-center gap-2">
      <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); enviar(); } }}
        placeholder="Digite para o Jotinha…" aria-label="Resposta para o Jotinha"
        className="h-9 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-3.5 text-sm text-white outline-none placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/40" />
      <button type="button" onClick={enviar} disabled={!texto.trim() || fase === "pensando"} aria-label="Enviar"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-900 disabled:opacity-40"><Send className="h-4 w-4" /></button>
    </div>
  ) : null;

  const avatar = (tam: string, anel: string) => (
    <button type="button" onClick={onTocar} disabled={fase === "pensando"}
      aria-label={fase === "falando" ? "Interromper o Jotinha" : fase === "ouvindo" ? "Terminei de falar" : "Falar"}
      className={cn("relative grid shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70", tam)}>
      {vivo && <span className={cn("absolute animate-ping rounded-full", anel, fase === "ouvindo" ? "bg-emerald-400/20" : "bg-primary/30")} />}
      <span className={cn("absolute inset-0 rounded-full ring-1 ring-white/15", fase === "ouvindo" ? "bg-emerald-400/10" : "bg-white/[0.06]")} />
      <JorginhoAvatar className="relative h-[88%] w-[78%]" expressao={expr} modo="escuro" />
    </button>
  );
  const brilho = (
    <>
      <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
    </>
  );
  const leitor = <span className="sr-only" aria-live="polite">{fala}</span>;
  const microfone = (grande?: boolean) => (
    <BotaoChamada onClick={onMudo} rotulo={mudo ? "Ligar o microfone" : "Desligar o microfone"} ativo={mudo} grande={grande}>
      {mudo ? <MicOff className={grande ? "h-5 w-5" : "h-4 w-4"} /> : <Mic className={grande ? "h-5 w-5" : "h-4 w-4"} />}
    </BotaoChamada>
  );

  if (variante === "compacta") {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl ring-1 ring-white/10", className)} data-jotinha-ligacao>
        {brilho}
        <div className="relative flex items-center gap-3 px-3 py-2.5">
          {avatar("h-14 w-14", "inset-1")}
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2 text-sm font-semibold">Jotinha <span className="text-xs font-normal tabular-nums text-white/55">{tempo}</span></p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-white/75"><Barras ativo={vivo} /> {statusChamada(fase, mudo)}</p>
            {erro && <p className="mt-1 text-[11px] leading-snug text-amber-300">{erro}</p>}
          </div>
          {microfone()}
          {onDigitar && <BotaoChamada onClick={() => setTeclado((v) => !v)} rotulo="Digitar" ativo={teclado}><Keyboard className="h-4 w-4" /></BotaoChamada>}
          {onMinimizar && <BotaoChamada onClick={onMinimizar} rotulo="Minimizar (a ligação continua)"><ChevronDown className="h-4 w-4" /></BotaoChamada>}
          <BotaoChamada onClick={onDesligar} rotulo="Desligar" perigo><PhoneOff className="h-4 w-4" /></BotaoChamada>
        </div>
        {campoTexto && <div className="relative border-t border-white/10 px-3 py-2">{campoTexto}</div>}
        {leitor}
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-1 flex-col items-center overflow-hidden bg-slate-950 px-6 pb-7 pt-9 text-white", className)} data-jotinha-ligacao>
      {brilho}
      {onMinimizar && (
        <button type="button" onClick={onMinimizar} aria-label="Minimizar (a ligação continua)" title="Minimizar — a ligação continua enquanto você usa o sistema"
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/20">
          <ChevronDown className="h-3.5 w-3.5" /> Minimizar
        </button>
      )}
      <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Ligação</p>
      <p className="relative mt-1 text-2xl font-bold tracking-tight">Jotinha</p>
      <p className="relative text-sm tabular-nums text-white/55">{tempo}</p>
      <div className="relative mt-8">{avatar("h-48 w-48", "-inset-3")}</div>
      <p className="relative mt-7 flex items-center gap-2 text-sm text-white/85"><Barras ativo={vivo} /> {statusChamada(fase, mudo)}</p>
      {erro && <p className="relative mt-2 max-w-xs text-center text-xs leading-snug text-amber-300">{erro}</p>}
      {noAparelho && <p className="relative mt-2 text-[10.5px] text-white/45">Voz entendida no próprio computador</p>}
      <div className="relative mt-auto w-full space-y-5 pt-6">
        {campoTexto}
        <div className="flex items-end justify-center gap-7">
          <div className="flex flex-col items-center gap-1.5">{microfone(true)}<span className="text-[11px] text-white/60">{mudo ? "Mudo" : "Microfone"}</span></div>
          <div className="flex flex-col items-center gap-1.5">
            <BotaoChamada onClick={onDesligar} rotulo="Desligar" perigo grande><PhoneOff className="h-6 w-6" /></BotaoChamada>
            <span className="text-[11px] text-white/60">Desligar</span>
          </div>
          {onDigitar && (
            <div className="flex flex-col items-center gap-1.5">
              <BotaoChamada onClick={() => setTeclado((v) => !v)} rotulo="Digitar" ativo={teclado} grande><Keyboard className="h-5 w-5" /></BotaoChamada>
              <span className="text-[11px] text-white/60">Teclado</span>
            </div>
          )}
        </div>
      </div>
      {leitor}
    </div>
  );
}

/**
 * Pílula da ligação minimizada: fica no canto da tela enquanto a pessoa usa o
 * sistema. Mostra o Jotinha, o tempo e o estado; mudo, voltar e desligar.
 */
export function PilulaLigacao({ fase, mudo, inicio, onExpandir, onMudo, onDesligar, className }: {
  fase: Fase; mudo: boolean; inicio: number; onExpandir: () => void; onMudo: () => void; onDesligar: () => void; className?: string;
}) {
  const tempo = useCronometro(inicio);
  const vivo = fase === "falando" || fase === "ouvindo";
  return (
    <div className={cn("relative flex w-full items-center gap-1.5 overflow-hidden rounded-full bg-slate-950 py-1.5 pl-1.5 pr-1.5 text-white shadow-2xl ring-1 ring-white/10 sm:w-auto sm:gap-2 sm:pr-2", className)} role="region" aria-label="Ligação com o Jotinha (minimizada)">
      <div className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-primary/40 blur-2xl" />
      <button type="button" onClick={onExpandir} className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="Voltar para a ligação">
        <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-white/15", fase === "ouvindo" ? "bg-emerald-400/15" : "bg-white/[0.07]")}>
          {vivo && <span className={cn("absolute inset-0 animate-ping rounded-full", fase === "ouvindo" ? "bg-emerald-400/20" : "bg-primary/30")} />}
          <JorginhoAvatar className="relative h-9 w-8" expressao={expressaoDaFase(fase)} modo="escuro" parado />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-semibold">Jotinha <span className="font-normal tabular-nums text-white/55">{tempo}</span></span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/70"><Barras ativo={vivo} /> <span className="truncate">{statusChamada(fase, mudo).replace("Toque no Jotinha para falar", "Toque para falar")}</span></span>
        </span>
      </button>
      <BotaoChamada onClick={onMudo} rotulo={mudo ? "Ligar o microfone" : "Desligar o microfone"} ativo={mudo}>
        {mudo ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </BotaoChamada>
      {/* No celular, tocar na pílula já volta para a ligação */}
      <BotaoChamada onClick={onExpandir} rotulo="Voltar para a ligação" className="hidden sm:grid"><Maximize2 className="h-4 w-4" /></BotaoChamada>
      <BotaoChamada onClick={onDesligar} rotulo="Desligar" perigo><PhoneOff className="h-4 w-4" /></BotaoChamada>
    </div>
  );
}
