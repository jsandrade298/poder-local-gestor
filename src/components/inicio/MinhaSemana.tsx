import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check, ChevronDown, ChevronRight, Link2, ListTodo, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { supabase } from "@/integrations/supabase/client";
import { garantirQuadroPessoal } from "@/hooks/useQuadros";
import type { ItemTarefa, AgendaResumo } from "@/hooks/useInicioData";
import { cn } from "@/lib/utils";

/**
 * "Minha semana" — o que é meu para fazer e onde preciso estar.
 * Duas colunas, para uma não empurrar a outra para fora da tela:
 *  - Tarefas: os cartões comigo em qualquer quadro, por prazo (atrasadas,
 *    hoje, amanhã…). Concluir é um toque (vai para a etapa final, com
 *    "desfazer"); criar uma tarefa também.
 *  - Próximos compromissos: a agenda dos próximos dias, por dia e compacta
 *    (hoje fica na faixa "Hoje na agenda", no topo do Início).
 */

type Grupo = "atrasadas" | "hoje" | "amanha" | "semana" | "depois" | "sem_prazo";

const ROTULO: Record<Grupo, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Próximos dias",
  depois: "Mais adiante",
  sem_prazo: "Sem prazo",
};
const RECOLHIDOS_DE_INICIO: Grupo[] = ["depois", "sem_prazo"];
const LIMITE_POR_GRUPO = 6;
/** Compromissos por dia antes do "+N neste dia" */
const LIMITE_POR_DIA = 3;
/** Dias de agenda mostrados antes do "Mostrar mais dias" */
const DIAS_DE_INICIO = 4;

function diasAte(iso: string, hoje: string) {
  return Math.round((new Date(iso + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime()) / 86400000);
}
function grupoDe(iso: string | null, hoje: string): Grupo {
  if (!iso) return "sem_prazo";
  const d = diasAte(iso, hoje);
  if (d < 0) return "atrasadas";
  if (d === 0) return "hoje";
  if (d === 1) return "amanha";
  if (d <= 7) return "semana";
  return "depois";
}
function diaLocal(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const diaCurto = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const rotuloDia = (iso: string, hoje: string) => {
  const d = diasAte(iso, hoje);
  if (d === 1) return "Amanhã";
  const d0 = new Date(iso + "T12:00:00");
  const sem = d0.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${sem.charAt(0).toUpperCase() + sem.slice(1)}, ${d0.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
};

export function MinhaSemana({
  uid, nome, hoje, tarefas, agendas,
}: {
  uid: string;
  nome?: string | null;
  hoje: string;
  tarefas: { data?: ItemTarefa[]; isLoading: boolean; isError: boolean; refetch: () => void };
  agendas: { data?: AgendaResumo[]; isLoading: boolean };
}) {
  const qc = useQueryClient();
  const [abertos, setAbertos] = useState<Set<Grupo>>(new Set());
  const [inteiros, setInteiros] = useState<Set<Grupo>>(new Set());
  const [diasInteiros, setDiasInteiros] = useState<Set<string>>(new Set());
  const [todosOsDias, setTodosOsDias] = useState(false);
  const [concluidos, setConcluidos] = useState<Set<string>>(new Set());
  const [novo, setNovo] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [criando, setCriando] = useState(false);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["inicio-minhas-tarefas"] });
    qc.invalidateQueries({ queryKey: ["inicio-meus-projetos"] });
    qc.invalidateQueries({ queryKey: ["kanban-board-cards"] });
    qc.invalidateQueries({ queryKey: ["quadros-resumos"] });
  };

  // Tarefas por prazo
  const grupos = useMemo(() => {
    const mapa = new Map<Grupo, ItemTarefa[]>();
    (tarefas.data || [])
      .filter((t) => !concluidos.has(t.id))
      .forEach((t) => {
        const g = grupoDe(t.data_prazo, hoje);
        mapa.set(g, [...(mapa.get(g) || []), t]);
      });
    mapa.forEach((l) => l.sort((x, y) => (x.data_prazo ?? "9999").localeCompare(y.data_prazo ?? "9999")));
    return (Object.keys(ROTULO) as Grupo[]).filter((g) => mapa.has(g)).map((g) => ({ g, tarefas: mapa.get(g)! }));
  }, [tarefas.data, concluidos, hoje]);

  // Compromissos por dia, dos próximos 7 dias
  const dias = useMemo(() => {
    const mapa = new Map<string, AgendaResumo[]>();
    (agendas.data || []).forEach((a) => {
      const dia = diaLocal(a.data_hora_proposta);
      const d = diasAte(dia, hoje);
      if (d < 1 || d > 7) return;
      mapa.set(dia, [...(mapa.get(dia) || []), a]);
    });
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, lista]) => ({ dia, lista: lista.sort((x, y) => Number(!x.diaInteiro) - Number(!y.diaInteiro) || x.data_hora_proposta.localeCompare(y.data_hora_proposta)) }));
  }, [agendas.data, hoje]);
  const totalCompromissos = dias.reduce((n, d) => n + d.lista.length, 0);

  const contar = (g: Grupo) => grupos.find((x) => x.g === g)?.tarefas.length ?? 0;
  const totalTarefas = (tarefas.data || []).filter((t) => !concluidos.has(t.id)).length;

  const concluir = async (t: ItemTarefa) => {
    if (!t.coluna_final_id) {
      toast.error(`O quadro "${t.origem}" não tem etapa de conclusão. Abra o cartão para mover.`);
      return;
    }
    setConcluidos((s) => new Set(s).add(t.id));
    const { error } = await (supabase.from("kanban_board_cards") as any)
      .update({ coluna_id: t.coluna_final_id, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (error) {
      setConcluidos((s) => { const n = new Set(s); n.delete(t.id); return n; });
      toast.error("Não foi possível concluir: " + error.message);
      return;
    }
    window.dispatchEvent(new CustomEvent("jorginho:reagir", { detail: { tipo: "tarefa" } }));
    toast.success(`Concluída: ${t.titulo}`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          await (supabase.from("kanban_board_cards") as any).update({ coluna_id: t.coluna_id }).eq("id", t.id);
          setConcluidos((s) => { const n = new Set(s); n.delete(t.id); return n; });
          recarregar();
        },
      },
    });
    recarregar();
  };

  const criar = async () => {
    const titulo = novo.trim();
    if (!titulo || criando) return;
    setCriando(true);
    try {
      const boardId = await garantirQuadroPessoal(uid, nome);
      const { data: col, error: e1 } = await supabase.from("kanban_board_colunas")
        .select("id").eq("board_id", boardId).eq("arquivada", false).order("ordem").limit(1).maybeSingle();
      if (e1 || !col) throw e1 || new Error("Seu quadro não tem etapas");
      const { error } = await supabase.from("kanban_board_cards").insert({
        board_id: boardId, coluna_id: col.id, titulo, responsavel_id: uid, created_by: uid,
        data_prazo: novoPrazo || null, prioridade: "media", cor: "#3b82f6", ordem: 0,
      });
      if (error) throw error;
      setNovo(""); setNovoPrazo("");
      toast.success("Tarefa criada no Meu quadro");
      recarregar();
      qc.invalidateQueries({ queryKey: ["kanban-boards"] });
    } catch (e: any) {
      toast.error("Não foi possível criar: " + (e?.message || "erro"));
    } finally {
      setCriando(false);
    }
  };

  const alternar = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, g: T) =>
    setter((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" /> Minha semana
        </CardTitle>
        <div className="flex items-center gap-1.5 text-[11px]">
          {contar("atrasadas") > 0 && <span className="rounded-full bg-destructive/10 text-destructive font-semibold px-2 py-0.5">{contar("atrasadas")} atrasada{contar("atrasadas") > 1 ? "s" : ""}</span>}
          {contar("hoje") > 0 && <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold px-2 py-0.5">{contar("hoje")} hoje</span>}
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
            <Link to="/quadros">Quadros <ChevronRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Criar rápido */}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); criar(); }}>
          <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova tarefa para mim…" className="h-9 flex-1 min-w-0" aria-label="Nova tarefa" />
          <Input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} className="h-9 w-[140px] shrink-0 hidden sm:block" aria-label="Prazo (opcional)" />
          <Button type="submit" size="sm" className="h-9 gap-1 shrink-0" disabled={!novo.trim() || criando}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Adicionar</span></Button>
        </form>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* ── Tarefas ── */}
          <section aria-label="Tarefas" className="min-w-0">
            <h3 className="titulo-compacto mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ListTodo className="h-3.5 w-3.5" /> Tarefas {totalTarefas > 0 && <span className="font-normal normal-case tracking-normal">· {totalTarefas}</span>}
            </h3>
            {tarefas.isError ? (
              <ErrorState what="suas tarefas" onRetry={() => tarefas.refetch()} className="py-6" />
            ) : tarefas.isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : grupos.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma tarefa com você nos quadros. Crie uma acima quando precisar.</p>
            ) : (
              <div className="space-y-3">
                {grupos.map(({ g, tarefas: lista }) => {
                  const recolhido = RECOLHIDOS_DE_INICIO.includes(g) ? !abertos.has(g) : abertos.has(g);
                  const visiveis = inteiros.has(g) ? lista : lista.slice(0, LIMITE_POR_GRUPO);
                  return (
                    <section key={g} aria-label={ROTULO[g]}>
                      <button type="button" onClick={() => alternar(setAbertos, g)} aria-expanded={!recolhido}
                        className="w-full flex items-center gap-1.5 text-xs font-semibold mb-1 hover:text-foreground text-muted-foreground">
                        {recolhido ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className={cn(g === "atrasadas" && "text-destructive", g === "hoje" && "text-foreground")}>{ROTULO[g]}</span>
                        <span className="font-normal">({lista.length})</span>
                      </button>
                      {!recolhido && (
                        <div className="divide-y">
                          {visiveis.map((t) => (
                            <div key={t.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 group">
                              <button type="button" onClick={() => concluir(t)} aria-label={`Concluir ${t.titulo}`} title="Concluir"
                                className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40 grid place-items-center hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                                <Check className="h-3 w-3 text-emerald-600 opacity-0 group-hover:opacity-100 dark:text-emerald-400" />
                              </button>
                              <Link to={t.link} className="min-w-0 flex-1 py-0.5">
                                <p className="text-sm truncate">{t.titulo}</p>
                                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                                  <span className="truncate">{t.origem}{!t.souResponsavel ? " · colaborando" : ""}</span>
                                  {t.protocolos.slice(0, 1).map((p) => (
                                    <span key={p} className="inline-flex items-center gap-0.5 text-primary shrink-0"><Link2 className="h-3 w-3" />#{p}</span>
                                  ))}
                                </p>
                              </Link>
                              {t.data_prazo && (
                                <span className={cn("text-[11px] shrink-0",
                                  g === "atrasadas" ? "text-destructive" : g === "hoje" || g === "amanha" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                  {g === "atrasadas" ? `${-diasAte(t.data_prazo, hoje)}d de atraso` : g === "hoje" ? "hoje" : g === "amanha" ? "amanhã" : diaCurto(t.data_prazo)}
                                </span>
                              )}
                            </div>
                          ))}
                          {lista.length > LIMITE_POR_GRUPO && (
                            <button type="button" onClick={() => alternar(setInteiros, g)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5">
                              {inteiros.has(g) ? "Mostrar menos" : `Ver todas (${lista.length})`}
                            </button>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Próximos compromissos ── */}
          <section aria-label="Próximos compromissos" className="min-w-0 md:border-l md:pl-5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="titulo-compacto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Compromissos {totalCompromissos > 0 && <span className="font-normal normal-case tracking-normal">· {totalCompromissos}</span>}
              </h3>
              <Link to="/agenda" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">Agenda <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {agendas.isLoading && dias.length === 0 ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : dias.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Nada marcado nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-3">
                {(todosOsDias ? dias : dias.slice(0, DIAS_DE_INICIO)).map(({ dia, lista }) => {
                  const inteiro = diasInteiros.has(dia);
                  const visiveis = inteiro ? lista : lista.slice(0, LIMITE_POR_DIA);
                  return (
                    <div key={dia}>
                      <p className="mb-1 flex items-baseline justify-between gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="whitespace-nowrap">{rotuloDia(dia, hoje)}</span>
                        <span className="whitespace-nowrap font-normal tabular-nums">{lista.length} {lista.length === 1 ? "compromisso" : "compromissos"}</span>
                      </p>
                      <ul className="space-y-1">
                        {visiveis.map((a) => (
                          <li key={a.id}>
                            <Link to={a.link === "/agenda" ? `/agenda?dia=${dia}` : a.link ?? "/solicitar-agenda"}
                              className="flex items-center gap-2 rounded-md border-l-[3px] bg-muted/40 px-2 py-1.5 hover:bg-muted"
                              style={{ borderLeftColor: a.cor || "hsl(var(--primary))" }}
                              title={`${a.titulo || "Compromisso"} · ${a.diaInteiro ? "dia inteiro" : `${horaDe(a.data_hora_proposta)}${a.fim ? `–${horaDe(a.fim)}` : ""}`}${a.local_endereco ? ` · ${a.local_endereco}` : ""}`}>
                              <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-foreground/80">
                                {a.diaInteiro ? "dia" : horaDe(a.data_hora_proposta)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={cn("block truncate text-[13px] font-medium", a.convite && "italic")}>{a.titulo || a.descricao_objetivo || "Compromisso"}</span>
                                {(a.local_endereco || a.convite || (!a.selo && a.status !== "confirmado")) && (
                                  <span className={cn("block truncate text-[11px]", a.convite || (!a.selo && a.status !== "confirmado") ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                                    {a.convite ? a.selo : !a.selo && a.status !== "confirmado" ? "aguardando confirmação" : a.local_endereco}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {lista.length > LIMITE_POR_DIA && (
                        <button type="button" onClick={() => alternar(setDiasInteiros, dia)} className="mt-1 w-full text-left text-[11px] text-muted-foreground hover:text-foreground">
                          {inteiro ? "Mostrar menos" : `+${lista.length - LIMITE_POR_DIA} ${lista.length - LIMITE_POR_DIA === 1 ? "compromisso" : "compromissos"} neste dia`}
                        </button>
                      )}
                    </div>
                  );
                })}
                {dias.length > DIAS_DE_INICIO && (
                  <button type="button" onClick={() => setTodosOsDias((v) => !v)} className="w-full rounded-md border border-dashed py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    {todosOsDias ? "Mostrar menos dias" : `Mostrar mais ${dias.length - DIAS_DE_INICIO} ${dias.length - DIAS_DE_INICIO === 1 ? "dia" : "dias"}`}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
        {totalTarefas > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Tudo o que está com você (responsável ou colaborando) em qualquer quadro. O círculo conclui: o cartão vai para a etapa final do quadro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
