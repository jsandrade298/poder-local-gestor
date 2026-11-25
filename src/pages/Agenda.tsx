import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, HelpCircle, Inbox, Plus, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConexoesAgenda, EscolherCalendariosDialog } from "@/components/agenda/ConexoesAgenda";
import { EventoFormDialog } from "@/components/agenda/EventoFormDialog";
import { EventoDetalheDialog } from "@/components/agenda/EventoDetalheDialog";
import {
  ROTULO_ORIGEM, diaISO, eventoNoDia, horaCurta, inicioDaSemana, inicioDoDia, somarDias, useAcoesGoogle,
  useEventosGoogle, useStatusGoogle, type EventoGoogle, type OrigemAgenda,
} from "@/hooks/useGoogleAgenda";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Agenda — o Google Agenda dentro do Jorgeus:
 *   - Agenda do mandato (a do vereador): toda a equipe vê; editores mexem.
 *   - Minha agenda: a conta Google de cada pessoa; convites com Sim/Talvez/Não.
 * Visões de dia, semana e mês. Os pedidos de agenda antigos continuam em
 * /solicitar-agenda até virarem o agendamento por horários livres.
 */

type Visao = "dia" | "semana" | "mes";
const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function periodo(visao: Visao, ref: Date) {
  if (visao === "dia") { const de = inicioDoDia(ref); return { de, ate: somarDias(de, 1) }; }
  if (visao === "semana") { const de = inicioDaSemana(ref); return { de, ate: somarDias(de, 7) }; }
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const de = inicioDaSemana(primeiro);
  return { de, ate: somarDias(de, 42) };
}

function rotuloPeriodo(visao: Visao, ref: Date) {
  if (visao === "dia") return ref.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  if (visao === "mes") return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const de = inicioDaSemana(ref), ate = somarDias(de, 6);
  const mesmoMes = de.getMonth() === ate.getMonth();
  return `${de.getDate()}${mesmoMes ? "" : " de " + de.toLocaleDateString("pt-BR", { month: "short" })} a ${ate.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`;
}

function LinhaEvento({ e, onAbrir, compacta }: { e: EventoGoogle; onAbrir: (e: EventoGoogle) => void; compacta?: boolean }) {
  const pendente = e.minhaResposta === "needsAction";
  const recusado = e.minhaResposta === "declined";
  return (
    <button type="button" onClick={() => onAbrir(e)}
      className={cn("w-full text-left flex items-start gap-2 rounded-md border-l-[3px] bg-card px-2 py-1.5 hover:bg-muted/60 transition-colors",
        compacta ? "text-[11px]" : "text-sm", recusado && "opacity-50 line-through")}
      style={{ borderLeftColor: e.cor }}>
      <span className={cn("shrink-0 tabular-nums text-muted-foreground", compacta ? "w-9" : "w-11")}>{e.diaInteiro ? "dia" : horaCurta(e.inicio)}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", pendente && "italic")}>{e.titulo}</span>
        {!compacta && e.local && <span className="block truncate text-xs text-muted-foreground">{e.local}</span>}
      </span>
      {pendente && <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 text-[10px] font-medium">convite</span>}
    </button>
  );
}

export default function Agenda() {
  const [params, setParams] = useSearchParams();
  const celular = useIsMobile();
  const [visao, setVisao] = useState<Visao>(() => { try { return (localStorage.getItem("agenda-visao") as Visao) || "semana"; } catch { return "semana"; } });
  const [ref, setRef] = useState(() => new Date());
  const [mostrar, setMostrar] = useState<Record<OrigemAgenda, boolean>>({ mandato: true, pessoal: true });
  const [aberto, setAberto] = useState<EventoGoogle | null>(null);
  const [editando, setEditando] = useState<EventoGoogle | null>(null);
  const [criandoEm, setCriandoEm] = useState<Date | null>(null);
  const [conexoes, setConexoes] = useState(false);
  const [escolherApos, setEscolherApos] = useState<OrigemAgenda | null>(null);
  const status = useStatusGoogle();
  const { responder } = useAcoesGoogle();

  const trocarVisao = (v: Visao) => { setVisao(v); try { localStorage.setItem("agenda-visao", v); } catch { /* sem storage */ } };
  const { de, ate } = useMemo(() => periodo(visao, ref), [visao, ref]);
  const eventos = useEventosGoogle(de, ate);
  // Convites pendentes nos próximos 60 dias (independe da visão)
  const hoje0 = useMemo(() => inicioDoDia(new Date()), []);
  const proximos = useEventosGoogle(hoje0, somarDias(hoje0, 60), !!status.data?.pessoal);
  const convites = (proximos.data?.eventos ?? []).filter((e) => e.minhaResposta === "needsAction");

  // Volta do Google
  useEffect(() => {
    const g = params.get("google");
    if (!g) return;
    const tipo = params.get("tipo") as OrigemAgenda | null;
    if (g === "conectado") {
      toast.success(tipo === "mandato" ? "Agenda do mandato conectada" : "Sua agenda Google foi conectada");
      status.refetch();
      if (tipo) setEscolherApos(tipo);
    } else if (g === "cancelado") toast("Conexão cancelada");
    else if (g === "sem_permissao") toast.error("Para funcionar, marque as permissões da agenda na tela do Google e tente de novo.");
    else toast.error("Não foi possível conectar com o Google. Tente de novo.");
    const p = new URLSearchParams(params); p.delete("google"); p.delete("tipo");
    setParams(p, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (eventos.data?.eventos ?? []).filter((e) => mostrar[e.origem]);
  const algumConectado = !!(status.data?.mandato || status.data?.pessoal);
  const podeCriar = !!status.data && (
    (status.data.souEditorMandato && (status.data.mandato?.calendarios || []).some((c) => c.papel === "owner" || c.papel === "writer")) ||
    (status.data.pessoal?.calendarios || []).some((c) => c.papel === "owner" || c.papel === "writer"));

  const andar = (n: number) => setRef((r) => visao === "dia" ? somarDias(r, n) : visao === "semana" ? somarDias(r, 7 * n) : new Date(r.getFullYear(), r.getMonth() + n, 1));
  const dias = useMemo(() => {
    const n = visao === "dia" ? 1 : visao === "semana" ? 7 : 42;
    return Array.from({ length: n }, (_, i) => somarDias(de, i));
  }, [de, visao]);
  const hojeISO = diaISO(new Date());

  return (
    <div className="space-y-4 md:container md:mx-auto md:px-4 max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Agenda</h1>
          <p className="text-sm text-muted-foreground">A agenda do mandato e a sua, ligadas ao Google Agenda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><Link to="/solicitar-agenda"><Inbox className="h-4 w-4" /> Pedidos de agenda</Link></Button>
          {algumConectado && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConexoes(true)}><Settings2 className="h-4 w-4" /> Conexões</Button>}
          {podeCriar && <Button size="sm" className="gap-1.5" onClick={() => setCriandoEm(visao === "dia" ? ref : new Date())}><Plus className="h-4 w-4" /> Novo evento</Button>}
        </div>
      </div>

      {status.isLoading ? (
        <Skeleton className="h-40" />
      ) : status.isError ? (
        <ErrorState what="a agenda" onRetry={() => status.refetch()} />
      ) : !algumConectado ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Conecte uma agenda do Google para ver e marcar compromissos aqui. Os eventos continuam no Google; o Jorgeus mostra e altera direto lá.</p>
          <ConexoesAgenda status={status.data!} />
        </div>
      ) : (
        <>
          {/* Avisos (ex.: conexão que precisa ser refeita) */}
          {(eventos.data?.avisos ?? []).map((a) => (
            <div key={a.origem} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800/60 dark:bg-amber-950/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="flex-1 min-w-[200px]">{ROTULO_ORIGEM[a.origem]}: {a.mensagem}</span>
              {a.codigo === "reconectar" && <Button size="sm" variant="outline" className="h-7" onClick={() => setConexoes(true)}>Reconectar</Button>}
            </div>
          ))}

          {/* Convites pendentes */}
          {convites.length > 0 && (
            <section className="rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <p className="text-sm font-semibold mb-2">Convites aguardando sua resposta ({convites.length})</p>
              <ul className="space-y-1.5">
                {convites.slice(0, 5).map((e) => (
                  <li key={e.id + e.calendarId} className="flex flex-wrap items-center gap-2 rounded-lg bg-card border px-3 py-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAberto(e)}>
                      <span className="block text-sm font-medium truncate">{e.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(e.inicio.length === 10 ? e.inicio + "T12:00:00" : e.inicio).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                        {!e.diaInteiro && ` · ${horaCurta(e.inicio)}`}{e.organizador ? ` · de ${e.organizador}` : ""}
                      </span>
                    </button>
                    <div className="flex gap-1">
                      {([["accepted", Check, "Sim"], ["tentative", HelpCircle, "Talvez"], ["declined", X, "Não"]] as const).map(([r, Ic, rot]) => (
                        <Button key={r} size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={responder.isPending}
                          onClick={() => responder.mutate({ calendarId: e.calendarId, eventId: e.id, resposta: r })}>
                          <Ic className="h-3 w-3" /> {rot}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Barra: visão, navegação e filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Visão">
              {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={visao === v} onClick={() => trocarVisao(v)}
                  className={cn("px-3 py-1 text-xs rounded-md", visao === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andar(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setRef(new Date())}>Hoje</Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andar(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <span className="text-sm font-semibold first-letter:uppercase">{rotuloPeriodo(visao, ref)}</span>
            <span className="flex-1" />
            <div className="flex flex-wrap gap-1.5">
              {(["mandato", "pessoal"] as OrigemAgenda[]).filter((o) => (o === "mandato" ? status.data?.mandato : status.data?.pessoal)).map((o) => (
                <button key={o} type="button" aria-pressed={mostrar[o]} onClick={() => setMostrar((m) => ({ ...m, [o]: !m[o] }))}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", mostrar[o] ? "bg-card" : "opacity-50")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: (o === "mandato" ? status.data?.mandato?.calendarios[0]?.cor : status.data?.pessoal?.calendarios[0]?.cor) || "#888" }} />
                  {ROTULO_ORIGEM[o]}
                </button>
              ))}
            </div>
          </div>

          {/* Visões */}
          {eventos.isLoading ? <Skeleton className="h-80" /> : eventos.isError ? (
            <ErrorState what="os eventos" onRetry={() => eventos.refetch()} />
          ) : visao === "mes" ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {DIAS_SEMANA.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-medium uppercase text-muted-foreground">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((d) => {
                  const doDia = lista.filter((e) => eventoNoDia(e, d));
                  const foraDoMes = d.getMonth() !== ref.getMonth();
                  const ehHoje = diaISO(d) === hojeISO;
                  return (
                    <div key={d.toISOString()} className={cn("min-h-[86px] md:min-h-[108px] border-b border-r p-1 flex flex-col gap-0.5", foraDoMes && "bg-muted/20")}>
                      <button type="button" onClick={() => { setRef(d); trocarVisao("dia"); }}
                        className={cn("self-start rounded-full px-1.5 text-xs tabular-nums hover:bg-muted", ehHoje && "bg-primary text-primary-foreground hover:bg-primary", foraDoMes && "text-muted-foreground")}>
                        {d.getDate()}
                      </button>
                      {celular ? (
                        doDia.length > 0 && (
                          <button type="button" onClick={() => { setRef(d); trocarVisao("dia"); }} className="flex flex-wrap gap-0.5 px-0.5" aria-label={`${doDia.length} eventos`}>
                            {doDia.slice(0, 4).map((e) => <span key={e.id + e.calendarId} className="h-1.5 w-1.5 rounded-full" style={{ background: e.cor }} />)}
                            {doDia.length > 4 && <span className="text-[9px] text-muted-foreground">+{doDia.length - 4}</span>}
                          </button>
                        )
                      ) : (
                        <>
                          {doDia.slice(0, 3).map((e) => (
                            <button key={e.id + e.calendarId} type="button" onClick={() => setAberto(e)}
                              className="truncate rounded px-1 text-left text-[11px] text-white hover:opacity-90" style={{ background: e.cor }}>
                              {!e.diaInteiro && <span className="opacity-80">{horaCurta(e.inicio)} </span>}{e.titulo}
                            </button>
                          ))}
                          {doDia.length > 3 && (
                            <button type="button" onClick={() => { setRef(d); trocarVisao("dia"); }} className="text-left px-1 text-[11px] text-muted-foreground hover:underline">
                              +{doDia.length - 3} mais
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={cn(visao === "semana" && !celular ? "grid grid-cols-7 gap-2" : "space-y-3")}>
              {dias.map((d) => {
                const doDia = lista.filter((e) => eventoNoDia(e, d));
                const ehHoje = diaISO(d) === hojeISO;
                return (
                  <section key={d.toISOString()} className={cn("rounded-xl border bg-muted/20 p-2 min-w-0", ehHoje && "border-primary/40 bg-primary/[0.03]", visao === "semana" && !celular && "min-h-[220px]")}>
                    <div className="flex items-center justify-between gap-1 px-1 pb-1.5">
                      <button type="button" onClick={() => { setRef(d); trocarVisao("dia"); }} className="text-left">
                        <span className="text-[11px] uppercase text-muted-foreground">{DIAS_SEMANA[(d.getDay() + 6) % 7]}</span>{" "}
                        <span className={cn("text-sm font-semibold tabular-nums", ehHoje && "text-primary")}>{d.getDate()}</span>
                      </button>
                      {podeCriar && (
                        <button type="button" onClick={() => setCriandoEm(d)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Novo evento neste dia">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {doDia.length === 0 ? (
                        <p className="px-1 text-[11px] text-muted-foreground">{visao === "dia" ? "Nada marcado." : "—"}</p>
                      ) : doDia.map((e) => <LinhaEvento key={e.id + e.calendarId} e={e} onAbrir={setAberto} compacta={visao === "semana" && !celular} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Conexões */}
      <Sheet open={conexoes} onOpenChange={setConexoes}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>Conexões com o Google</SheetTitle>
            <SheetDescription>Escolha quais agendas aparecem, reconecte ou desconecte.</SheetDescription>
          </SheetHeader>
          {status.data && <ConexoesAgenda status={status.data} compacto />}
        </SheetContent>
      </Sheet>

      {/* Logo depois de conectar: escolher as agendas */}
      <EscolherCalendariosDialog tipo={escolherApos} onClose={() => setEscolherApos(null)}
        somenteLeitura={escolherApos === "mandato" && !status.data?.souEditorMandato} />

      <EventoDetalheDialog evento={aberto} onClose={() => setAberto(null)} onEditar={(e) => { setAberto(null); setEditando(e); }} />
      {status.data && (
        <EventoFormDialog
          aberto={!!editando || !!criandoEm}
          onClose={() => { setEditando(null); setCriandoEm(null); }}
          status={status.data}
          evento={editando}
          diaInicial={criandoEm ?? undefined}
        />
      )}
    </div>
  );
}
