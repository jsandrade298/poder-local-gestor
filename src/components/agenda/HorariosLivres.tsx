import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { diaISO, eventoNoDia, type EventoGoogle, type OrigemAgenda } from "@/hooks/useGoogleAgenda";
import { EXPEDIENTE_PADRAO, horaDe, horariosLivres, type Expediente } from "./agendaUtil";
import { cn } from "@/lib/utils";

/**
 * Livre/ocupado: para cada dia, a faixa do expediente com o que está
 * ocupado e os horários livres (com a duração escolhida). Tocar num horário
 * livre chama `onEscolher` (marcar evento ou, depois, pedir horário).
 * Reservados aparecem só como "ocupado".
 */

const CHAVE = "jorgeus-agenda-expediente";
function lerExp(): Expediente {
  try { const v = localStorage.getItem(CHAVE); if (v) return { ...EXPEDIENTE_PADRAO, ...JSON.parse(v) }; } catch { /* sem storage */ }
  return EXPEDIENTE_PADRAO;
}

export const rotuloDuracao = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`);

const HORAS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h..22h

export function HorariosLivres({ dias, eventos, origens, onEscolher }: {
  dias: Date[];
  eventos: EventoGoogle[];
  /** De quais agendas considerar a ocupação */
  origens: OrigemAgenda[];
  onEscolher?: (de: Date, ate: Date) => void;
}) {
  const [exp, setExpState] = useState<Expediente>(lerExp);
  const [duracao, setDuracao] = useState(60);
  const setExp = (e: Expediente) => { setExpState(e); try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* sem storage */ } };
  const considerados = useMemo(() => eventos.filter((e) => origens.includes(e.origem)), [eventos, origens]);
  const total = (exp.fim - exp.inicio) * 60;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2 text-xs">
        <label className="flex items-center gap-2">
          Duração
          <Select value={String(duracao)} onValueChange={(v) => setDuracao(Number(v))}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[30, 45, 60, 90, 120, 180].map((m) => <SelectItem key={m} value={String(m)}>{rotuloDuracao(m)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="flex items-center gap-2">
          Expediente
          <Select value={String(exp.inicio)} onValueChange={(v) => setExp({ ...exp, inicio: Math.min(Number(v), exp.fim - 1) })}>
            <SelectTrigger className="h-8 w-[76px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{HORAS.map((h) => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}</SelectContent>
          </Select>
          às
          <Select value={String(exp.fim)} onValueChange={(v) => setExp({ ...exp, fim: Math.max(Number(v), exp.inicio + 1) })}>
            <SelectTrigger className="h-8 w-[76px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{HORAS.map((h) => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="flex items-center gap-2"><Switch checked={exp.diasUteis} onCheckedChange={(v) => setExp({ ...exp, diasUteis: v })} /> Só dias úteis</label>
      </div>

      <div className="space-y-2">
        {dias.map((d) => {
          const doDia = considerados.filter((e) => eventoNoDia(e, d));
          const r = horariosLivres(d, doDia, exp, duracao);
          const passado = diaISO(d) < diaISO(new Date());
          const pos = (x: Date) => Math.max(0, Math.min(100, (((x.getHours() - exp.inicio) * 60 + x.getMinutes()) / total) * 100));
          return (
            <section key={d.toISOString()} className={cn("rounded-xl border bg-card p-3", (r.fechado || passado) && "opacity-60")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <p className="text-sm font-semibold first-letter:uppercase">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}</p>
                <p className="text-xs text-muted-foreground">
                  {r.fechado ? "fora do expediente" : passado ? "já passou" : r.livres.length === 0 ? "sem horário livre" : `${r.livres.length} horário${r.livres.length === 1 ? "" : "s"} livre${r.livres.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {!r.fechado && (
                <>
                  {/* Faixa do expediente */}
                  <div className="relative h-6 rounded-md bg-emerald-100/70 dark:bg-emerald-950/40 overflow-hidden" aria-hidden>
                    {r.ocupados.map((o, i) => (
                      <span key={i} className="absolute inset-y-0 rounded-sm opacity-90" title={`${o.e.titulo} · ${horaDe(o.de)}–${horaDe(o.ate)}`}
                        style={{ left: `${pos(o.de)}%`, width: `${Math.max(1, pos(o.ate) - pos(o.de))}%`, background: o.e.cor }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground mt-0.5">
                    <span>{exp.inicio}h</span><span>{Math.round((exp.inicio + exp.fim) / 2)}h</span><span>{exp.fim}h</span>
                  </div>
                  {!passado && r.livres.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.livres.map((l, i) => (
                        <button key={i} type="button" disabled={!onEscolher}
                          onClick={() => onEscolher?.(l.de, new Date(l.de.getTime() + duracao * 60000))}
                          className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs tabular-nums text-emerald-800 hover:bg-emerald-100 disabled:cursor-default dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          title={onEscolher ? "Usar este horário" : undefined}>
                          {horaDe(l.de)}–{horaDe(l.ate)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ocupado = compromissos com horário nas agendas consideradas (dia inteiro e eventos marcados como "disponível" no Google não bloqueiam).
        O expediente fica guardado neste aparelho.
      </p>
    </div>
  );
}
