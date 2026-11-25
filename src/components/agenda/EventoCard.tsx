import { AlertTriangle, Lock, MapPin, Users, Video } from "lucide-react";
import { ROTULO_ORIGEM, type EventoGoogle } from "@/hooks/useGoogleAgenda";
import { agruparPorHorario, faixaHorario, textoSimples } from "./agendaUtil";
import { cn } from "@/lib/utils";

/**
 * Cartão de evento nas visões da Agenda. Mostra o essencial sem precisar
 * clicar: horário de início e fim, título, local, de qual agenda é, se tem
 * videochamada, convidados e se é convite ou reservado.
 *  - "compacto": colunas da semana
 *  - "completo": dia e lista (com prévia da descrição e respostas)
 */
export function EventoCard({ e, onAbrir, compacto }: { e: EventoGoogle; onAbrir: (e: EventoGoogle) => void; compacto?: boolean }) {
  const convite = e.minhaResposta === "needsAction";
  const recusado = e.minhaResposta === "declined";
  const vao = e.convidados.filter((c) => c.resposta === "accepted").length;
  const descricao = !compacto && e.descricao ? textoSimples(e.descricao) : "";
  return (
    <button type="button" onClick={() => onAbrir(e)}
      className={cn("block w-full min-w-0 overflow-hidden text-left rounded-lg border border-l-[4px] bg-card hover:shadow-suave hover:border-primary/40 transition-all",
        compacto ? "px-2 py-1.5" : "px-3 py-2.5", recusado && "opacity-50", e.oculto && "bg-muted/50")}
      style={{ borderLeftColor: e.cor }}
      aria-label={`${e.titulo}, ${faixaHorario(e)}`}>
      <div className={cn("flex items-center gap-1.5 tabular-nums text-muted-foreground", compacto ? "text-[10.5px]" : "text-xs")}>
        <span className={cn("font-semibold text-foreground/80", recusado && "line-through")}>{faixaHorario(e)}</span>
        <span className="flex-1" />
        {e.reservado && <Lock className="h-3 w-3" aria-label="reservado" />}
        {e.meet && <Video className="h-3 w-3" aria-label="videochamada" />}
        {e.convidados.length > 0 && (
          <span className="inline-flex items-center gap-0.5" title={`${vao} de ${e.convidados.length} confirmaram`}><Users className="h-3 w-3" />{e.convidados.length}</span>
        )}
      </div>
      <p className={cn("font-medium leading-snug [overflow-wrap:anywhere]", compacto ? "text-[12px] line-clamp-2" : "text-sm line-clamp-2", convite && "italic", recusado && "line-through")}>
        {e.titulo}
      </p>
      {e.local && (
        <p className={cn("flex items-center gap-1 text-muted-foreground", compacto ? "text-[10.5px]" : "text-xs")}>
          <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{e.local}</span>
        </p>
      )}
      {descricao && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">{descricao}</p>}
      <div className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5", compacto ? "text-[10px]" : "text-[11px]")}>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.cor }} />
          {e.origem === "mandato" ? (compacto ? "Mandato" : ROTULO_ORIGEM.mandato) : (compacto ? "Minha" : ROTULO_ORIGEM.pessoal)}
        </span>
        {convite && <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 font-medium">convite</span>}
        {!compacto && e.convidados.length > 0 && <span className="text-muted-foreground">{vao} de {e.convidados.length} confirmaram</span>}
      </div>
    </button>
  );
}

/**
 * Eventos de um dia, em ordem de horário (visão Lista). Os que acontecem AO
 * MESMO TEMPO ficam lado a lado sob "Ao mesmo tempo · N compromissos",
 * para não parecer que um vem depois do outro.
 */
export function EventosDoDia({ eventos, onAbrir, compacto, vazio }: {
  eventos: EventoGoogle[]; onAbrir: (e: EventoGoogle) => void; compacto?: boolean; vazio?: string;
}) {
  const { diaInteiro, blocos } = agruparPorHorario(eventos);
  if (eventos.length === 0) return vazio ? <p className="px-1 text-[11px] text-muted-foreground">{vazio}</p> : null;
  return (
    <div className="space-y-1.5">
      {diaInteiro.map((e) => <EventoCard key={e.id + e.calendarId} e={e} onAbrir={onAbrir} compacto={compacto} />)}
      {blocos.map((b) => b.length === 1 ? (
        <EventoCard key={b[0].id + b[0].calendarId} e={b[0]} onAbrir={onAbrir} compacto={compacto} />
      ) : (
        <div key={b.map((e) => e.id).join("-")} className="space-y-1">
          <p className={cn("flex items-center gap-1 text-muted-foreground", compacto ? "text-[10px]" : "text-[11px]")}>
            <AlertTriangle className="h-3 w-3 text-amber-600" /> Ao mesmo tempo · {b.length} compromissos
          </p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(b.length, compacto ? 1 : 3)}, minmax(0, 1fr))` }}>
            {b.map((e) => <EventoCard key={e.id + e.calendarId} e={e} onAbrir={onAbrir} compacto={compacto} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
