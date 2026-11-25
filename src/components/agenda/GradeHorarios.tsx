import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { Lock, MapPin, Users, Video } from "lucide-react";
import { diaISO, eventoNoDia, horaCurta, inicioDoDia, type EventoGoogle } from "@/hooks/useGoogleAgenda";
import { EXPEDIENTE_PADRAO, type Expediente } from "./agendaUtil";
import { cn } from "@/lib/utils";

/**
 * Grade de horários no modelo do Google Agenda (visões Dia e Semana):
 * horas na lateral, uma coluna por dia, cada evento com a altura da sua
 * duração. Eventos ao mesmo tempo dividem a largura, LADO A LADO.
 * Dia inteiro fica numa faixa no topo. Linha vermelha = agora.
 * Clicar num horário vazio chama `onHorario` (criar evento ou pedir horário).
 */

const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MIN_DIA = 24 * 60;

function lerExpediente(): Expediente {
  try { const v = localStorage.getItem("jorgeus-agenda-expediente"); if (v) return { ...EXPEDIENTE_PADRAO, ...JSON.parse(v) }; } catch { /* sem storage */ }
  return EXPEDIENTE_PADRAO;
}

interface Posicionado { e: EventoGoogle; ini: number; fim: number; col: number; cols: number }

/** Distribui os eventos de um dia em colunas: os que se sobrepõem ficam lado a lado. */
function distribuir(eventos: EventoGoogle[], dia: Date): Posicionado[] {
  const zero = inicioDoDia(dia).getTime();
  const itens = eventos
    .map((e) => ({
      e,
      ini: Math.max(0, (new Date(e.inicio).getTime() - zero) / 60000),
      fim: Math.min(MIN_DIA, (new Date(e.fim).getTime() - zero) / 60000),
    }))
    .filter((x) => x.fim > x.ini)
    .sort((a, b) => a.ini - b.ini || b.fim - a.fim);

  const saida: Posicionado[] = [];
  let grupo: (typeof itens[number] & { col: number })[] = [];
  let fimGrupo = -1;
  const fecharGrupo = () => {
    const cols = Math.max(1, ...grupo.map((g) => g.col + 1));
    grupo.forEach((g) => saida.push({ ...g, cols }));
    grupo = [];
  };
  for (const it of itens) {
    if (grupo.length && it.ini >= fimGrupo) { fecharGrupo(); fimGrupo = -1; }
    // primeira coluna livre neste grupo
    const ocupadas = grupo.filter((g) => g.fim > it.ini).map((g) => g.col);
    let col = 0;
    while (ocupadas.includes(col)) col++;
    grupo.push({ ...it, col });
    fimGrupo = Math.max(fimGrupo, it.fim);
  }
  if (grupo.length) fecharGrupo();
  return saida;
}

function BlocoEvento({ p, alturaHora, largo, onAbrir }: { p: Posicionado; alturaHora: number; largo: boolean; onAbrir: (e: EventoGoogle) => void }) {
  const { e } = p;
  const top = (p.ini / 60) * alturaHora;
  const altura = Math.max(20, ((p.fim - p.ini) / 60) * alturaHora - 2);
  const curto = altura < 38;
  const convite = e.minhaResposta === "needsAction";
  const recusado = e.minhaResposta === "declined";
  const esquerda = (p.col / p.cols) * 100;
  const largura = p.col === p.cols - 1 ? 100 / p.cols : Math.min(100 - esquerda, (100 / p.cols) * 1.7);
  return (
    <button type="button" onClick={(ev) => { ev.stopPropagation(); onAbrir(e); }}
      className={cn(
        "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-white shadow-sm ring-1 ring-background hover:!z-20 hover:shadow-media transition-shadow",
        convite && "border-2 border-dashed border-white/80", recusado && "opacity-45", e.livre && "opacity-70",
      )}
      style={{
        top, height: altura,
        // Como no Google: cada um começa mais à direita e avança um pouco por
        // cima do vizinho (o último fica inteiro), para o título caber.
        left: `calc(${esquerda}% + 1px)`,
        width: `calc(${largura}% - 3px)`,
        zIndex: 1 + p.col,
        background: e.oculto
          ? `repeating-linear-gradient(135deg, ${e.cor}, ${e.cor} 6px, color-mix(in srgb, ${e.cor} 75%, black) 6px, color-mix(in srgb, ${e.cor} 75%, black) 12px)`
          : convite ? `color-mix(in srgb, ${e.cor} 70%, white)` : e.cor,
      }}
      aria-label={`${e.titulo}, ${horaCurta(e.inicio)} a ${horaCurta(e.fim)}`}
      title={`${e.titulo}\n${horaCurta(e.inicio)}–${horaCurta(e.fim)}${e.local ? `\n${e.local}` : ""}`}>
      {curto ? (
        <span className={cn("block truncate text-[11px] leading-tight", recusado && "line-through")}>
          <span className="font-semibold">{e.titulo}</span> <span className="opacity-85">{horaCurta(e.inicio)}</span>
        </span>
      ) : (
        <>
          <span className={cn("block text-[11px] font-semibold leading-tight [overflow-wrap:anywhere]", recusado && "line-through", altura < 60 ? "line-clamp-1" : "line-clamp-2")}>
            {e.reservado && <Lock className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" />}{e.titulo}
          </span>
          <span className="block text-[10.5px] leading-tight opacity-90 tabular-nums">{horaCurta(e.inicio)}–{horaCurta(e.fim)}</span>
          {altura >= 62 && e.local && (
            <span className="flex items-center gap-0.5 text-[10.5px] leading-tight opacity-90"><MapPin className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{e.local}</span></span>
          )}
          {altura >= 80 && largo && (e.meet || e.convidados.length > 0) && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] opacity-90">
              {e.meet && <Video className="h-3 w-3" />}
              {e.convidados.length > 0 && <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{e.convidados.length}</span>}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export function GradeHorarios({ dias, eventos, onAbrir, onHorario, onDia, rascunho, onFecharRascunho }: {
  dias: Date[];
  eventos: EventoGoogle[];
  onAbrir: (e: EventoGoogle) => void;
  /** Clique num horário vazio */
  onHorario?: (inicio: Date, fim: Date) => void;
  /** Clique no cabeçalho do dia */
  onDia?: (d: Date) => void;
  /** Bloco provisório (criação rápida) com o balão ancorado nele */
  rascunho?: { inicio: Date; fim: Date; painel: ReactNode } | null;
  onFecharRascunho?: () => void;
}) {
  const largo = dias.length <= 3;
  const celular = useIsMobile();
  const alturaHora = largo ? 56 : 48;
  const rolagem = useRef<HTMLDivElement>(null);
  const exp = useMemo(lerExpediente, []);
  const hojeISO = diaISO(new Date());
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);

  const porDia = useMemo(() => dias.map((d) => {
    const doDia = eventos.filter((e) => eventoNoDia(e, d));
    return { d, diaInteiro: doDia.filter((e) => e.diaInteiro), posicionados: distribuir(doDia.filter((e) => !e.diaInteiro), d) };
  }), [dias, eventos]);

  // Começa mostrando a partir do primeiro compromisso (ou do expediente)
  useEffect(() => {
    const primeiros = porDia.flatMap((x) => x.posicionados.map((p) => p.ini));
    const inicioMin = Math.min(exp.inicio * 60, ...(primeiros.length ? primeiros : [exp.inicio * 60]));
    if (rolagem.current) rolagem.current.scrollTop = Math.max(0, (inicioMin / 60 - 0.5) * alturaHora);
  }, [dias.map((d) => d.toISOString()).join(), alturaHora]); // eslint-disable-line react-hooks/exhaustive-deps

  const colunas = `3rem repeat(${dias.length}, minmax(0, 1fr))`;
  const temDiaInteiro = porDia.some((x) => x.diaInteiro.length > 0);

  const clicarHorario = (d: Date, ev: React.MouseEvent<HTMLDivElement>) => {
    if (!onHorario) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const minutos = Math.floor(((ev.clientY - r.top) / alturaHora) * 60 / 30) * 30;
    const inicio = inicioDoDia(d); inicio.setMinutes(minutos);
    onHorario(inicio, new Date(inicio.getTime() + 60 * 60000));
  };

  return (
    <div ref={rolagem} className="rounded-xl border bg-card max-h-[72vh] overflow-y-auto overscroll-contain">
      {/* Cabeçalho dos dias + dia inteiro: ficam presos no topo e rolam junto
          com a grade (assim as colunas não desalinham com a barra de rolagem) */}
      <div className="sticky top-0 z-30 bg-card">
      <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: colunas }}>
        <div />
        {dias.map((d) => {
          const ehHoje = diaISO(d) === hojeISO;
          return (
            <button key={d.toISOString()} type="button" onClick={() => onDia?.(d)} className="flex flex-col items-center py-1.5 border-l hover:bg-muted/50">
              <span className={cn("text-[10.5px] uppercase", ehHoje ? "text-primary font-semibold" : "text-muted-foreground")}>{DIAS_SEMANA[(d.getDay() + 6) % 7]}</span>
              <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums", ehHoje && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Dia inteiro */}
      {temDiaInteiro && (
        <div className="grid border-b" style={{ gridTemplateColumns: colunas }}>
          <div className="px-1 py-1 text-[10px] text-muted-foreground text-right leading-tight">dia todo</div>
          {porDia.map(({ d, diaInteiro }) => (
            <div key={d.toISOString()} className="border-l p-0.5 space-y-0.5 min-w-0">
              {diaInteiro.slice(0, 3).map((e) => (
                <button key={e.id + e.calendarId} type="button" onClick={() => onAbrir(e)}
                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white" style={{ background: e.cor }} title={e.titulo}>
                  {e.titulo}
                </button>
              ))}
              {diaInteiro.length > 3 && <button type="button" onClick={() => onDia?.(d)} className="px-1 text-[10px] text-muted-foreground hover:underline">+{diaInteiro.length - 3}</button>}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Horas */}
        <div className="grid relative" style={{ gridTemplateColumns: colunas, height: 24 * alturaHora }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: h * alturaHora }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {porDia.map(({ d, posicionados }) => {
            const ehHoje = diaISO(d) === hojeISO;
            const fds = (d.getDay() + 6) % 7 >= 5;
            const minAgora = agora.getHours() * 60 + agora.getMinutes();
            return (
              <div key={d.toISOString()} className={cn("relative border-l min-w-0", onHorario && "cursor-pointer")}
                onClick={(ev) => clicarHorario(d, ev)}
                style={{
                  backgroundImage: `linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
                  backgroundSize: `100% ${alturaHora}px`,
                }}>
                {/* Fora do expediente, mais apagado */}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-muted/40" style={{ height: (exp.diasUteis && fds ? 24 : exp.inicio) * alturaHora }} />
                {!(exp.diasUteis && fds) && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-muted/40" style={{ height: (24 - exp.fim) * alturaHora }} />}
                {rascunho && diaISO(rascunho.inicio) === diaISO(d) && (() => {
                  const ini = (rascunho.inicio.getTime() - inicioDoDia(d).getTime()) / 60000;
                  const fim = Math.min(MIN_DIA, (rascunho.fim.getTime() - inicioDoDia(d).getTime()) / 60000);
                  return (
                    <Popover open onOpenChange={(v) => { if (!v) onFecharRascunho?.(); }}>
                      <PopoverPrimitive.Anchor asChild>
                        <div className="pointer-events-none absolute inset-x-0.5 z-[15] rounded-md bg-primary/85 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground shadow-media"
                          style={{ top: (ini / 60) * alturaHora, height: Math.max(20, ((fim - ini) / 60) * alturaHora - 2) }}>
                          (sem título) · {horaCurta(rascunho.inicio.toISOString())}
                        </div>
                      </PopoverPrimitive.Anchor>
                      <PopoverContent side={largo && !celular ? "right" : "bottom"} align="start" collisionPadding={12} className="w-[min(20rem,calc(100vw-24px))] p-3"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        // O React leva o clique do portal até a coluna do dia: sem isto, clicar no balão criaria outro rascunho
                        onClick={(e) => e.stopPropagation()}>
                        {rascunho.painel}
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                {posicionados.map((p) => <BlocoEvento key={p.e.id + p.e.calendarId} p={p} alturaHora={alturaHora} largo={largo} onAbrir={onAbrir} />)}
                {ehHoje && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (minAgora / 60) * alturaHora }} aria-hidden>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-red-500" /><span className="h-0.5 flex-1 bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
}
