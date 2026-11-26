import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarPlus, Check, ChevronLeft, ChevronRight, HelpCircle, Inbox, Plus, Settings2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConexoesAgenda, EscolherCalendariosDialog } from "@/components/agenda/ConexoesAgenda";
import { EventoFormDialog } from "@/components/agenda/EventoFormDialog";
import { EventoDetalheDialog } from "@/components/agenda/EventoDetalheDialog";
import { EventosDoDia } from "@/components/agenda/EventoCard";
import { GradeHorarios } from "@/components/agenda/GradeHorarios";
import { CriacaoRapida } from "@/components/agenda/CriacaoRapida";
import { CampoBuscaAgenda, ResultadosBusca } from "@/components/agenda/BuscaAgenda";
import { HorariosLivres } from "@/components/agenda/HorariosLivres";
import { agruparPorHorario } from "@/components/agenda/agendaUtil";
import { PedirHorarioDialog } from "@/components/agenda/PedirHorarioDialog";
import { PedidosAgendaSheet } from "@/components/agenda/PedidosAgendaSheet";
import { CompartilharSemanaDialog } from "@/components/agenda/CompartilharSemanaDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROTULO_ORIGEM, diaISO, eventoNoDia, horaCurta, inicioDaSemana, inicioDoDia, somarDias, useAcoesGoogle,
  useEventosGoogle, usePedidosAgenda, useStatusGoogle, type EventoGoogle, type OrigemAgenda,
} from "@/hooks/useGoogleAgenda";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Agenda — o Google Agenda dentro do Jorgeus:
 *   - Agenda do mandato (a do vereador): toda a equipe vê; editores mexem.
 *     Eventos "reservados" aparecem para os outros só como "Ocupado".
 *   - Minha agenda: a conta Google de cada pessoa; convites com Sim/Talvez/Não.
 * Visões: dia, semana, mês, lista (30 dias) e livres (livre/ocupado).
 * Dia e Semana: grade de horas (estilo Google); simultâneos lado a lado.
 * Clicar num horário vazio abre a criação rápida (ou o pedido de horário).
 * A busca procura em um ano para trás e um para frente.
 */

type Visao = "dia" | "semana" | "mes" | "lista" | "livres";
const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const VISOES: [Visao, string][] = [["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["lista", "Lista"], ["livres", "Livres"]];

function periodo(visao: Visao, ref: Date, celular = false) {
  if (visao === "dia") { const de = inicioDoDia(ref); return { de, ate: somarDias(de, 1), dias: 1 }; }
  // No celular a semana vira 3 dias (como no Google), para os blocos caberem
  if (visao === "semana" && celular) { const de = inicioDoDia(ref); return { de, ate: somarDias(de, 3), dias: 3 }; }
  if (visao === "semana" || visao === "livres") { const de = inicioDaSemana(ref); return { de, ate: somarDias(de, 7), dias: 7 }; }
  if (visao === "lista") { const de = inicioDoDia(ref); return { de, ate: somarDias(de, 30), dias: 30 }; }
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const de = inicioDaSemana(primeiro);
  return { de, ate: somarDias(de, 42), dias: 42 };
}

function rotuloPeriodo(visao: Visao, ref: Date, celular = false) {
  if (visao === "semana" && celular) {
    const ate = somarDias(ref, 2);
    return `${ref.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} a ${ate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  }
  if (visao === "dia") return ref.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  if (visao === "mes") return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (visao === "lista") return `próximos 30 dias a partir de ${ref.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  const de = inicioDaSemana(ref), ate = somarDias(de, 6);
  const mesmoMes = de.getMonth() === ate.getMonth();
  return `${de.getDate()}${mesmoMes ? "" : " de " + de.toLocaleDateString("pt-BR", { month: "short" })} a ${ate.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`;
}

export default function Agenda() {
  const [params, setParams] = useSearchParams();
  const celular = useIsMobile();
  // /agenda?dia=AAAA-MM-DD (vindo da Minha semana) abre direto aquele dia
  const diaDaUrl = /^\d{4}-\d{2}-\d{2}$/.test(params.get("dia") || "") ? params.get("dia")! : null;
  const [visao, setVisao] = useState<Visao>(() => {
    if (diaDaUrl) return "dia";
    try { const v = localStorage.getItem("agenda-visao") as Visao; return VISOES.some(([x]) => x === v) ? v : "semana"; } catch { return "semana"; }
  });
  const [ref, setRef] = useState(() => (diaDaUrl ? new Date(`${diaDaUrl}T12:00:00`) : new Date()));
  useEffect(() => {
    if (!diaDaUrl) return;
    const p = new URLSearchParams(params); p.delete("dia"); setParams(p, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mostrar, setMostrar] = useState<Record<OrigemAgenda, boolean>>({ mandato: true, pessoal: true });
  const [aberto, setAberto] = useState<EventoGoogle | null>(null);
  const [editando, setEditando] = useState<EventoGoogle | null>(null);
  const [criando, setCriando] = useState<{ dia: Date; inicio?: Date; fim?: Date; titulo?: string; destino?: string } | null>(null);
  const [rapido, setRapido] = useState<{ inicio: Date; fim: Date } | null>(null);
  const [busca, setBusca] = useState("");
  const buscando = busca.trim().length > 0;
  const [conexoes, setConexoes] = useState(false);
  const [escolherApos, setEscolherApos] = useState<OrigemAgenda | null>(null);
  const status = useStatusGoogle();
  const { responder } = useAcoesGoogle();
  const { user } = useAuth();
  const [pedindo, setPedindo] = useState<{ inicio?: Date; fim?: Date } | null>(null);
  const [pedidosAberto, setPedidosAberto] = useState(() => params.get("pedidos") === "1");
  const [compartilhar, setCompartilhar] = useState(false);
  const pedidos = usePedidosAgenda(!!status.data?.mandato);
  const editor = !!status.data?.souEditorMandato;
  const nPedidos = (pedidos.data ?? []).filter((p) => editor ? p.status === "pendente" : p.solicitante_id === user?.id && (p.status === "pendente" || p.status === "contraproposta")).length;
  useEffect(() => {
    if (params.get("pedidos") !== "1") return;
    setPedidosAberto(true);
    const p = new URLSearchParams(params); p.delete("pedidos"); setParams(p, { replace: true });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarVisao = (v: Visao) => { setVisao(v); try { localStorage.setItem("agenda-visao", v); } catch { /* sem storage */ } };
  const { de, ate, dias: nDias } = useMemo(() => periodo(visao, ref, celular), [visao, ref, celular]);
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

  const andar = (n: number) => setRef((r) => {
    if (visao === "dia") return somarDias(r, n);
    if (visao === "semana" && celular) return somarDias(r, 3 * n);
    if (visao === "semana" || visao === "livres") return somarDias(r, 7 * n);
    if (visao === "lista") return somarDias(r, 30 * n);
    return new Date(r.getFullYear(), r.getMonth() + n, 1);
  });
  const dias = useMemo(() => Array.from({ length: nDias }, (_, i) => somarDias(de, i)), [de, nDias]);
  const hojeISO = diaISO(new Date());
  const simultaneosNoPeriodo = useMemo(() => dias.reduce((n, d) => n + agruparPorHorario(lista.filter((e) => eventoNoDia(e, d))).blocos.filter((b) => b.length > 1).length, 0), [dias, lista]);
  const origensAtivas = (["mandato", "pessoal"] as OrigemAgenda[]).filter((o) => mostrar[o] && (o === "mandato" ? status.data?.mandato : status.data?.pessoal));

  const corDe = (o: OrigemAgenda) => (o === "mandato" ? status.data?.mandato?.calendarios[0]?.cor : status.data?.pessoal?.calendarios[0]?.cor) || "#888";

  return (
    <div className="space-y-4 md:container md:mx-auto md:px-4 max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Agenda</h1>
          <p className="text-sm text-muted-foreground">A agenda do mandato e a sua, ligadas ao Google Agenda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.data?.mandato && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPedidosAberto(true)}>
                <Inbox className="h-4 w-4" /> Pedidos{nPedidos > 0 && <span className="rounded-full bg-primary text-primary-foreground px-1.5 text-[10px] font-semibold tabular-nums">{nPedidos}</span>}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPedindo({})}><CalendarPlus className="h-4 w-4" /> Pedir horário</Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setCompartilhar(true)}><Share2 className="h-4 w-4" /> Compartilhar semana</Button>
            </>
          )}
          {!status.data?.mandato && <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><Link to="/solicitar-agenda"><Inbox className="h-4 w-4" /> Pedidos antigos</Link></Button>}
          {algumConectado && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConexoes(true)}><Settings2 className="h-4 w-4" /> Conexões e cores</Button>}
          {podeCriar && <Button size="sm" className="gap-1.5" onClick={() => setCriando({ dia: visao === "dia" ? ref : new Date() })}><Plus className="h-4 w-4" /> Novo evento</Button>}
        </div>
      </div>

      {status.isLoading && !status.data ? (
        <Skeleton className="h-40" />
      ) : status.isError && !status.data ? (
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
                        {!e.diaInteiro && ` · ${horaCurta(e.inicio)}–${horaCurta(e.fim)}`}{e.organizador ? ` · de ${e.organizador}` : ""}
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
              {VISOES.map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={visao === v} onClick={() => trocarVisao(v)}
                  className={cn("px-2.5 sm:px-3 py-1 text-xs rounded-md", visao === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andar(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setRef(new Date())}>Hoje</Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andar(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <span className="text-sm font-semibold first-letter:uppercase">{rotuloPeriodo(visao, ref, celular)}</span>
            {eventos.isFetching && <span className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="atualizando" />}
            <span className="flex-1" />
            <CampoBuscaAgenda valor={busca} onBuscar={setBusca} />
            <div className="flex flex-wrap gap-1.5">
              {(["mandato", "pessoal"] as OrigemAgenda[]).filter((o) => (o === "mandato" ? status.data?.mandato : status.data?.pessoal)).map((o) => (
                <button key={o} type="button" aria-pressed={mostrar[o]} onClick={() => setMostrar((m) => ({ ...m, [o]: !m[o] }))}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", mostrar[o] ? "bg-card" : "opacity-50")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: corDe(o) }} />
                  {ROTULO_ORIGEM[o]}
                </button>
              ))}
            </div>
          </div>

          {simultaneosNoPeriodo > 0 && visao !== "livres" && !buscando && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {simultaneosNoPeriodo === 1 ? "1 horário com compromissos ao mesmo tempo" : `${simultaneosNoPeriodo} horários com compromissos ao mesmo tempo`} neste período (aparecem lado a lado).
            </p>
          )}

          {/* Visões */}
          {buscando ? (
            <ResultadosBusca termo={busca} mostrar={mostrar} onAbrir={setAberto} onLimpar={() => setBusca("")}
              onVerDia={(d) => { setRef(d); trocarVisao("dia"); setBusca(""); }} />
          ) : eventos.isLoading && !eventos.data ? <Skeleton className="h-80" /> : eventos.isError && !eventos.data ? (
            <ErrorState what="os eventos" onRetry={() => eventos.refetch()} />
          ) : visao === "livres" ? (
            <HorariosLivres dias={dias} eventos={eventos.data?.eventos ?? []} origens={origensAtivas.length ? origensAtivas : ["mandato"]}
              onEscolher={podeCriar ? (inicio, fim) => setCriando({ dia: inicio, inicio, fim }) : status.data?.mandato ? (inicio, fim) => setPedindo({ inicio, fim }) : undefined} />
          ) : visao === "mes" ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {DIAS_SEMANA.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-medium uppercase text-muted-foreground">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((d) => {
                  const doDia = lista.filter((e) => eventoNoDia(e, d));
                  const simult = agruparPorHorario(doDia).blocos.some((b) => b.length > 1);
                  const foraDoMes = d.getMonth() !== ref.getMonth();
                  const ehHoje = diaISO(d) === hojeISO;
                  return (
                    <div key={d.toISOString()} className={cn("min-h-[86px] md:min-h-[112px] border-b border-r p-1 flex flex-col gap-0.5", foraDoMes && "bg-muted/20")}>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => { setRef(d); trocarVisao("dia"); }}
                          className={cn("rounded-full px-1.5 text-xs tabular-nums hover:bg-muted", ehHoje && "bg-primary text-primary-foreground hover:bg-primary", foraDoMes && "text-muted-foreground")}>
                          {d.getDate()}
                        </button>
                        {simult && <AlertTriangle className="h-3 w-3 text-amber-600" aria-label="compromissos ao mesmo tempo" />}
                      </div>
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
          ) : visao === "lista" ? (
            <div className="space-y-4">
              {dias.filter((d) => lista.some((e) => eventoNoDia(e, d))).length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Nada marcado nos próximos 30 dias.</p>
              )}
              {dias.map((d) => {
                const doDia = lista.filter((e) => eventoNoDia(e, d));
                if (doDia.length === 0) return null;
                const ehHoje = diaISO(d) === hojeISO;
                return (
                  <section key={d.toISOString()} className="grid gap-2 md:grid-cols-[9rem_1fr]">
                    <p className={cn("text-sm font-semibold first-letter:uppercase md:pt-2", ehHoje && "text-primary")}>
                      {ehHoje ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "long" })}
                      <span className="block text-xs font-normal text-muted-foreground">{d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}</span>
                    </p>
                    <EventosDoDia eventos={doDia} onAbrir={setAberto} />
                  </section>
                );
              })}
            </div>
          ) : (
            /* Dia e Semana: grade de horários no modelo do Google */
            <GradeHorarios
              dias={dias}
              eventos={lista}
              onAbrir={setAberto}
              onDia={(d) => { setRef(d); trocarVisao("dia"); }}
              onHorario={podeCriar ? (inicio, fim) => setRapido({ inicio, fim })
                : status.data?.mandato ? (inicio, fim) => setPedindo({ inicio, fim }) : undefined}
              onFecharRascunho={() => setRapido(null)}
              rascunho={rapido && status.data ? {
                ...rapido,
                painel: (
                  <CriacaoRapida key={rapido.inicio.toISOString()} inicio={rapido.inicio} fim={rapido.fim} status={status.data} eventos={lista}
                    onMudarFim={(fim) => setRapido((r) => (r ? { ...r, fim } : r))}
                    onFechar={() => setRapido(null)}
                    onMaisOpcoes={({ titulo, destino }) => { setCriando({ dia: rapido.inicio, inicio: rapido.inicio, fim: rapido.fim, titulo, destino }); setRapido(null); }} />
                ),
              } : null}
            />
          )}
        </>
      )}

      {/* Conexões */}
      <Sheet open={conexoes} onOpenChange={setConexoes}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>Conexões e cores</SheetTitle>
            <SheetDescription>Escolha quais agendas aparecem e a cor de cada uma, reconecte ou desconecte.</SheetDescription>
          </SheetHeader>
          {status.data && <ConexoesAgenda status={status.data} compacto />}
        </SheetContent>
      </Sheet>

      {/* Logo depois de conectar: escolher as agendas */}
      <EscolherCalendariosDialog tipo={escolherApos} onClose={() => setEscolherApos(null)}
        somenteLeitura={escolherApos === "mandato" && !status.data?.souEditorMandato} />

      <PedirHorarioDialog aberto={!!pedindo} onClose={() => setPedindo(null)} inicial={pedindo ?? undefined} />
      <PedidosAgendaSheet aberto={pedidosAberto} onAbertoChange={setPedidosAberto} />
      <CompartilharSemanaDialog aberto={compartilhar} onClose={() => setCompartilhar(false)} referencia={visao === "semana" || visao === "livres" ? ref : new Date()} />

      <EventoDetalheDialog evento={aberto} onClose={() => setAberto(null)} onEditar={(e) => { setAberto(null); setEditando(e); }} />
      {status.data && (
        <EventoFormDialog
          aberto={!!editando || !!criando}
          onClose={() => { setEditando(null); setCriando(null); }}
          status={status.data}
          evento={editando}
          diaInicial={criando?.dia}
          horarioInicial={criando?.inicio && criando?.fim ? { inicio: criando.inicio, fim: criando.fim } : undefined}
          tituloInicial={criando?.titulo}
          destinoInicial={criando?.destino}
        />
      )}
    </div>
  );
}
