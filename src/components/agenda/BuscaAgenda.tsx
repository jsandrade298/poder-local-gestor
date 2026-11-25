import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useBuscaAgenda, type EventoGoogle, type OrigemAgenda } from "@/hooks/useGoogleAgenda";
import { EventoCard } from "./EventoCard";

/** Campo de busca da Agenda (espera a pessoa parar de digitar). */
export function CampoBuscaAgenda({ valor, onBuscar }: { valor: string; onBuscar: (t: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  useEffect(() => {
    const t = setTimeout(() => { if (texto.trim() !== valor.trim()) onBuscar(texto); }, 350);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar na agenda" aria-label="Buscar na agenda"
        onKeyDown={(e) => { if (e.key === "Enter") onBuscar(texto); if (e.key === "Escape") { setTexto(""); onBuscar(""); } }}
        className="h-8 pl-8 pr-8 text-sm" />
      {texto && (
        <button type="button" onClick={() => { setTexto(""); onBuscar(""); }} aria-label="Limpar busca"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const dataDe = (e: EventoGoogle) => new Date(e.diaInteiro ? e.inicio.slice(0, 10) + "T12:00:00" : e.inicio);

/**
 * Resultados da busca: um ano para trás e um para frente, separados em
 * "Próximos" e "Já aconteceram". Clicar abre o evento; "Ver no dia" leva até ele.
 */
export function ResultadosBusca({ termo, mostrar, onAbrir, onVerDia, onLimpar }: {
  termo: string;
  mostrar: Record<OrigemAgenda, boolean>;
  onAbrir: (e: EventoGoogle) => void;
  onVerDia: (d: Date) => void;
  onLimpar: () => void;
}) {
  const busca = useBuscaAgenda(termo);
  const t = termo.trim();
  if (t.length < 2) return <p className="py-6 text-center text-sm text-muted-foreground">Digite pelo menos 2 letras para buscar.</p>;
  if (busca.isLoading) return <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (busca.isError) return <ErrorState what="a busca" onRetry={() => busca.refetch()} />;

  const lista = (busca.data?.eventos ?? []).filter((e) => mostrar[e.origem]);
  const agora = Date.now();
  const proximos = lista.filter((e) => new Date(e.fim).getTime() >= agora);
  const passados = lista.filter((e) => new Date(e.fim).getTime() < agora).reverse();

  const Grupo = ({ titulo, itens }: { titulo: string; itens: EventoGoogle[] }) => itens.length === 0 ? null : (
    <section className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo} · {itens.length}</p>
      {itens.map((e) => {
        const d = dataDe(e);
        return (
          <div key={e.id + e.calendarId} className="grid gap-1.5 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-3">
            <div className="flex items-center gap-2 md:block md:pt-2">
              <p className="text-sm font-semibold first-letter:uppercase">
                {d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                {d.getFullYear() !== new Date().getFullYear() && <span className="font-normal text-muted-foreground"> {d.getFullYear()}</span>}
              </p>
              <button type="button" onClick={() => onVerDia(d)} className="text-xs text-primary hover:underline">Ver no dia</button>
            </div>
            <EventoCard e={e} onAbrir={onAbrir} />
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {lista.length === 0 ? "Nada encontrado" : lista.length === 1 ? "1 compromisso encontrado" : `${lista.length} compromissos encontrados`} para <strong className="text-foreground">“{t}”</strong>
        </span>
        {busca.isFetching && <span className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="buscando" />}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7" onClick={onLimpar}>Voltar para a agenda</Button>
      </div>
      {lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Procuramos no título, local, descrição e convidados, de um ano atrás até um ano à frente.</p>
      ) : (
        <>
          <Grupo titulo="Próximos" itens={proximos} />
          <Grupo titulo="Já aconteceram" itens={passados} />
        </>
      )}
      {(busca.data?.avisos ?? []).map((a) => <p key={a.origem} className="text-xs text-amber-800 dark:text-amber-300">{a.mensagem}</p>)}
    </div>
  );
}
