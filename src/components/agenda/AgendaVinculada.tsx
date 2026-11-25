import { useState } from "react";
import { CalendarPlus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventosVinculados, useStatusGoogle, type EventoGoogle } from "@/hooks/useGoogleAgenda";
import { useAuth } from "@/contexts/AuthContext";
import { PedirHorarioDialog } from "./PedirHorarioDialog";
import { EventoDetalheDialog } from "./EventoDetalheDialog";
import { EventoFormDialog } from "./EventoFormDialog";
import { faixaHorario } from "./agendaUtil";

/**
 * Agenda dentro de uma demanda ou de um munícipe: os compromissos ligados a
 * eles (passados e próximos) e o botão "Agendar", que abre o pedido de
 * horário já vinculado. Só aparece se a agenda do mandato estiver conectada.
 */
export function AgendaVinculada({ demandaId, municipeId, sugestao }: {
  demandaId?: string | null;
  municipeId?: string | null;
  sugestao?: { titulo?: string; local?: string; descricao?: string };
}) {
  const { roleNoTenant } = useAuth();
  const usa = roleNoTenant !== "representante"; // representantes não usam a agenda
  const status = useStatusGoogle(usa);
  const vinculados = useEventosVinculados({ demandaId, municipeId }, usa);
  const [pedindo, setPedindo] = useState(false);
  const [aberto, setAberto] = useState<EventoGoogle | null>(null);
  const [editando, setEditando] = useState<EventoGoogle | null>(null);
  if (!usa || !status.data?.mandato) return null;

  const eventos = vinculados.data?.eventos ?? [];
  const agora = Date.now();
  const proximos = eventos.filter((e) => new Date(e.fim).getTime() >= agora);
  const passados = eventos.filter((e) => new Date(e.fim).getTime() < agora).reverse();

  const Linha = ({ e }: { e: EventoGoogle }) => (
    <button type="button" onClick={() => setAberto(e)} className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.cor }} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{e.titulo}</span>
        <span className="block text-[11px] text-muted-foreground">
          {new Date(e.inicio.length === 10 ? e.inicio + "T12:00:00" : e.inicio).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })} · {faixaHorario(e)}
        </span>
      </span>
    </button>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="titulo-compacto text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Agenda</CardTitle>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setPedindo(true)}><CalendarPlus className="h-3.5 w-3.5" /> Agendar</Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {vinculados.isLoading ? <p className="text-xs text-muted-foreground">Buscando compromissos…</p> : eventos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum compromisso ligado ainda. Use "Agendar" para pedir um horário na agenda do mandato.</p>
          ) : (
            <>
              {proximos.length > 0 && <div><p className="text-[11px] font-medium text-muted-foreground mb-0.5">Próximos</p>{proximos.map((e) => <Linha key={e.id + e.calendarId} e={e} />)}</div>}
              {passados.length > 0 && <div><p className="text-[11px] font-medium text-muted-foreground mb-0.5">Já aconteceram</p>{passados.slice(0, 5).map((e) => <Linha key={e.id + e.calendarId} e={e} />)}</div>}
            </>
          )}
        </CardContent>
      </Card>

      <PedirHorarioDialog aberto={pedindo} onClose={() => setPedindo(false)} inicial={{ ...sugestao, demandaId, municipeId }} />
      <EventoDetalheDialog evento={aberto} onClose={() => setAberto(null)} onEditar={(e) => { setAberto(null); setEditando(e); }} />
      {status.data && <EventoFormDialog aberto={!!editando} onClose={() => setEditando(null)} status={status.data} evento={editando} />}
    </>
  );
}
