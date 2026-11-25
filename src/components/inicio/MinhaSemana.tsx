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
 * Junta, por dia, os cartões comigo em qualquer quadro (equipe, pessoal,
 * projetos) e as minhas agendas. Concluir é um toque (vai para a etapa
 * final do quadro, com "desfazer"); criar uma tarefa também.
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

type Linha =
  | { tipo: "tarefa"; quando: string | null; t: ItemTarefa }
  | { tipo: "agenda"; quando: string; a: AgendaResumo };

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

  const grupos = useMemo(() => {
    const mapa = new Map<Grupo, Linha[]>();
    (tarefas.data || [])
      .filter((t) => !concluidos.has(t.id))
      .forEach((t) => {
        const g = grupoDe(t.data_prazo, hoje);
        mapa.set(g, [...(mapa.get(g) || []), { tipo: "tarefa", quando: t.data_prazo, t }]);
      });
    (agendas.data || []).forEach((a) => {
      const dia = diaLocal(a.data_hora_proposta);
      const g = grupoDe(dia, hoje);
      if (g === "atrasadas") return;
      mapa.set(g, [...(mapa.get(g) || []), { tipo: "agenda", quando: dia, a }]);
    });
    // Dentro do dia: agendas por horário antes das tarefas; depois por data
    mapa.forEach((linhas) => linhas.sort((x, y) => {
      const dx = x.quando ?? "9999", dy = y.quando ?? "9999";
      if (dx !== dy) return dx.localeCompare(dy);
      if (x.tipo !== y.tipo) return x.tipo === "agenda" ? -1 : 1;
      if (x.tipo === "agenda" && y.tipo === "agenda") return x.a.data_hora_proposta.localeCompare(y.a.data_hora_proposta);
      return 0;
    }));
    return (Object.keys(ROTULO) as Grupo[]).filter((g) => mapa.has(g)).map((g) => ({ g, linhas: mapa.get(g)! }));
  }, [tarefas.data, agendas.data, concluidos, hoje]);

  const contar = (g: Grupo) => grupos.find((x) => x.g === g)?.linhas.length ?? 0;
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

  const alternar = (setter: typeof setAbertos, g: Grupo) =>
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

        {tarefas.isError ? (
          <ErrorState what="suas tarefas" onRetry={() => tarefas.refetch()} className="py-6" />
        ) : tarefas.isLoading || agendas.isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nada com você nos quadros nem na agenda. Crie uma tarefa acima quando precisar.</p>
        ) : (
          <div className="space-y-3">
            {grupos.map(({ g, linhas }) => {
              const recolhido = RECOLHIDOS_DE_INICIO.includes(g) ? !abertos.has(g) : abertos.has(g);
              const visiveis = inteiros.has(g) ? linhas : linhas.slice(0, LIMITE_POR_GRUPO);
              return (
                <section key={g} aria-label={ROTULO[g]}>
                  <button type="button" onClick={() => alternar(setAbertos, g)} aria-expanded={!recolhido}
                    className="w-full flex items-center gap-1.5 text-xs font-semibold mb-1 hover:text-foreground text-muted-foreground">
                    {recolhido ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    <span className={cn(g === "atrasadas" && "text-destructive", g === "hoje" && "text-foreground")}>{ROTULO[g]}</span>
                    <span className="font-normal">({linhas.length})</span>
                  </button>
                  {!recolhido && (
                    <div className="divide-y">
                      {visiveis.map((l) => l.tipo === "agenda" ? (
                        <Link key={"a" + l.a.id} to={l.a.link ?? "/solicitar-agenda"} className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60">
                          <span className="h-5 w-5 grid place-items-center shrink-0"><CalendarClock className="h-4 w-4 text-primary" style={l.a.cor ? { color: l.a.cor } : undefined} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{l.a.titulo || l.a.descricao_objetivo || "Agenda"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {g === "semana" || g === "depois" ? `${diaCurto(l.quando)} · ` : ""}
                              {l.a.diaInteiro ? "dia inteiro" : new Date(l.a.data_hora_proposta).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              {!l.a.diaInteiro && l.a.fim ? `–${new Date(l.a.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                              {l.a.local_endereco ? ` · ${l.a.local_endereco}` : ""}
                            </p>
                          </div>
                          {l.a.selo ? (
                            <span className={cn("flex items-center gap-1 text-[11px] shrink-0 max-w-[45%] truncate",
                              l.a.convite ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: l.a.cor || "currentColor" }} />
                              <span className="truncate">{l.a.selo}</span>
                            </span>
                          ) : (
                            <span className={cn("text-[11px] shrink-0 rounded px-1.5 py-0.5",
                              l.a.status === "confirmado" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
                              {l.a.status === "confirmado" ? "agenda confirmada" : "agenda pendente"}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <div key={l.t.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 group">
                          <button type="button" onClick={() => concluir(l.t)} aria-label={`Concluir ${l.t.titulo}`} title="Concluir"
                            className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40 grid place-items-center hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                            <Check className="h-3 w-3 text-emerald-600 opacity-0 group-hover:opacity-100 dark:text-emerald-400" />
                          </button>
                          <Link to={l.t.link} className="min-w-0 flex-1 py-0.5">
                            <p className="text-sm truncate">{l.t.titulo}</p>
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                              <span className="truncate">{l.t.origem}{!l.t.souResponsavel ? " · colaborando" : ""}</span>
                              {l.t.protocolos.slice(0, 1).map((p) => (
                                <span key={p} className="inline-flex items-center gap-0.5 text-primary shrink-0"><Link2 className="h-3 w-3" />#{p}</span>
                              ))}
                            </p>
                          </Link>
                          {l.quando && (
                            <span className={cn("text-[11px] shrink-0",
                              g === "atrasadas" ? "text-destructive" : g === "hoje" || g === "amanha" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                              {g === "atrasadas" ? `${-diasAte(l.quando, hoje)}d de atraso` : g === "hoje" ? "hoje" : g === "amanha" ? "amanhã" : diaCurto(l.quando)}
                            </span>
                          )}
                        </div>
                      ))}
                      {linhas.length > LIMITE_POR_GRUPO && (
                        <button type="button" onClick={() => alternar(setInteiros, g)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5">
                          {inteiros.has(g) ? "Mostrar menos" : `Ver todas (${linhas.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
        {totalTarefas > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Tudo o que está com você (responsável ou colaborando) em qualquer quadro. O círculo conclui: o cartão vai para a etapa final do quadro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
