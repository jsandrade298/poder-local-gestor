import type { ReactNode } from "react";
import { Keyboard, Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JorginhoAvatar, type Expressao } from "./JorginhoAvatar";

/**
 * Peças visuais do Jotinha, usadas em todos os lugares onde ele aparece
 * (balão, painel, ligação na conversa, ligação no formulário, widgets),
 * para tudo ter a mesma cara: superfície com borda na cor do gabinete,
 * faixa em degradê suave e o selo "JOTINHA · estado".
 */

/** Superfície padrão de qualquer cartão do Jotinha */
export const SUPERFICIE = "rounded-2xl border border-primary/20 bg-card shadow-lg shadow-primary/5";
/** Degradê suave do cabeçalho/faixa do Jotinha */
export const FAIXA = "bg-gradient-to-br from-primary/[0.12] via-primary/[0.04] to-transparent";

export type Fase = "parado" | "falando" | "ouvindo" | "pensando";

export const expressaoDaFase = (f: Fase, erro?: boolean): Expressao =>
  erro && f === "parado" ? "duvida" : f === "falando" ? "falando" : f === "ouvindo" ? "ouvindo" : f === "pensando" ? "ocupado" : "normal";

/** Selo "● JOTINHA · estado" (o ponto pulsa em vermelho quando está ouvindo) */
export function SeloJotinha({ estado, ouvindo, className }: { estado?: string; ouvindo?: boolean; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary", className)}>
      <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", ouvindo ? "animate-pulse bg-red-500" : "bg-emerald-500")} />
      Jotinha{estado ? <span className="font-medium normal-case tracking-normal text-muted-foreground">· {estado}</span> : null}
    </p>
  );
}

export const rotuloFase = (f: Fase, voz: boolean) =>
  f === "falando" ? "falando" : f === "ouvindo" ? "ouvindo você" : f === "pensando" ? "anotando" : voz ? "toque no microfone para falar" : "responda digitando";

/** Botão redondo do microfone: vermelho pulsando enquanto ouve */
export function BotaoMicrofone({ fase, onClick, tamanho = "md" }: { fase: Fase; onClick: () => void; tamanho?: "md" | "lg" }) {
  return (
    <button type="button" onClick={onClick} disabled={fase === "pensando"}
      aria-label={fase === "ouvindo" ? "Terminei de falar" : fase === "falando" ? "Interromper e falar" : "Falar"}
      className={cn("relative grid shrink-0 place-items-center rounded-full text-white shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        tamanho === "lg" ? "h-12 w-12" : "h-11 w-11", fase === "ouvindo" ? "bg-red-500" : "bg-primary")}>
      {fase === "ouvindo" && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
      {fase === "pensando" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="relative h-5 w-5" />}
    </button>
  );
}

/**
 * Faixa de "ligação" com o Jotinha: ele, o que disse, o que a pessoa está
 * falando e os controles. `children` vai embaixo (ex.: campo para digitar).
 */
export function FaixaLigacao({ fase, legenda, ouvido, erro, voz, temVoz, onMic, onAlternarVoz, onDesligar, children, className }: {
  fase: Fase; legenda?: string; ouvido?: string; erro?: string | null;
  voz: boolean; temVoz: boolean;
  onMic: () => void; onAlternarVoz?: () => void; onDesligar: () => void;
  children?: ReactNode; className?: string;
}) {
  return (
    <div className={cn(SUPERFICIE, "overflow-hidden", className)} data-jotinha-ligacao>
      <div className={cn("flex items-start gap-3 p-3", FAIXA)}>
        <JorginhoAvatar className="h-16 w-14 shrink-0 -my-1" expressao={expressaoDaFase(fase, !!erro)} />
        <div className="min-w-0 flex-1 space-y-1 pt-0.5">
          <SeloJotinha estado={rotuloFase(fase, voz)} ouvindo={fase === "ouvindo"} />
          {legenda && <p className="text-sm font-medium leading-snug" aria-live="polite">{legenda}</p>}
          {ouvido ? (
            <p className={cn("text-xs leading-snug [overflow-wrap:anywhere]", fase === "ouvindo" ? "text-foreground" : "text-muted-foreground")}>
              <span className="font-medium">Você: </span>“{ouvido}”
            </p>
          ) : fase === "ouvindo" ? <p className="text-xs text-muted-foreground">Pode falar…</p> : null}
          {erro && <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{erro}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          {temVoz && <BotaoMicrofone fase={fase} onClick={onMic} />}
          <div className="flex gap-0.5">
            {temVoz && onAlternarVoz && (
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onAlternarVoz}
                title={voz ? "Desligar a voz e digitar" : "Ligar a voz"} aria-label={voz ? "Desligar a voz" : "Ligar a voz"}>
                {voz ? <MicOff className="h-3.5 w-3.5" /> : <Keyboard className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDesligar} title="Encerrar" aria-label="Encerrar a conversa com o Jotinha">
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {children && <div className="border-t border-primary/10 bg-card px-3 py-2">{children}</div>}
    </div>
  );
}

/** Convite compacto: avatar + título + texto + ação (ex.: "Preencha conversando") */
export function ConviteJotinha({ titulo, texto, acao, expressao = "acenando", className }: {
  titulo: ReactNode; texto?: ReactNode; acao?: ReactNode; expressao?: Expressao; className?: string;
}) {
  return (
    <div className={cn(SUPERFICIE, FAIXA, "flex items-center gap-3 p-2.5 pr-3 shadow-sm", className)}>
      <JorginhoAvatar className="h-14 w-12 shrink-0 -my-1" expressao={expressao} />
      <div className="min-w-0 flex-1 text-sm leading-tight">
        <p className="font-semibold">{titulo}</p>
        {texto && <p className="mt-0.5 text-xs text-muted-foreground">{texto}</p>}
      </div>
      {acao}
    </div>
  );
}
