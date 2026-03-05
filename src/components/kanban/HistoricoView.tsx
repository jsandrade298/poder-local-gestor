import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowRight,
  Plus,
  Minus,
  MoveHorizontal,
  Route,
  FileText,
  CheckSquare,
  Clock,
  User,
  MessageSquare,
  Users,
  AlertTriangle,
  Search,
  Archive,
} from "lucide-react";
import { logError } from "@/lib/errorUtils";
import { Linkify } from "@/components/ui/Linkify";

interface HistoricoViewProps {
  selectedUser: string;
  responsaveis: { id: string; nome: string }[];
}

type PeriodoTipo = "semana" | "mes";

interface HistoricoRecord {
  id: string;
  item_id: string;
  item_tipo: "demanda" | "tarefa" | "rota";
  item_titulo: string;
  kanban_type: string;
  posicao_anterior: string | null;
  posicao_nova: string | null;
  acao: "adicionado" | "movido" | "removido";
  movido_por: string | null;
  created_at: string;
  snapshot: any | null;
}

interface ItemArquivado {
  item_id: string;
  item_tipo: "demanda" | "tarefa" | "rota";
  item_titulo: string;
  removido_em: string;
  removido_por: string | null;
  ultima_posicao: string | null;
  snapshot: any | null;
  movimentos: HistoricoRecord[];
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getWeekLabel(date: Date): string {
  const { start, end } = getWeekRange(date);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} — ${fmt(end)}`;
}

function getMonthLabel(date: Date): string {
  return `${MESES_PT[date.getMonth()]} ${date.getFullYear()}`;
}

function navigatePeriod(cur: Date, tipo: PeriodoTipo, dir: number): Date {
  const d = new Date(cur);
  tipo === "semana" ? d.setDate(d.getDate() + 7 * dir) : d.setMonth(d.getMonth() + dir);
  return d;
}

function getPosicaoLabel(p: string | null): string {
  switch (p) {
    case "a_fazer": return "A Fazer";
    case "em_progresso": return "Em Progresso";
    case "feito": return "Feito";
    default: return p || "—";
  }
}

// ── Component principal ──
export function HistoricoView({ selectedUser, responsaveis }: HistoricoViewProps) {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tipoFilter, setTipoFilter] = useState<"todos" | "tarefa" | "demanda" | "rota">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const { start: periodoStart, end: periodoEnd } = useMemo(
    () => (periodoTipo === "semana" ? getWeekRange(currentDate) : getMonthRange(currentDate)),
    [currentDate, periodoTipo]
  );
  const periodoLabel = periodoTipo === "semana" ? getWeekLabel(currentDate) : getMonthLabel(currentDate);

  // ── Query: apenas registros de REMOÇÃO no período ──
  const { data: removidos = [], isLoading } = useQuery({
    queryKey: ["kanban-historico-removidos", selectedUser, periodoStart.toISOString(), periodoEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_historico")
        .select("*")
        .eq("kanban_type", selectedUser)
        .eq("acao", "removido")
        .gte("created_at", periodoStart.toISOString())
        .lte("created_at", periodoEnd.toISOString())
        .order("created_at", { ascending: false });
      if (error) { logError("Erro ao buscar histórico:", error); throw error; }
      return (data || []) as HistoricoRecord[];
    },
  });

  const removidoIds = useMemo(() => [...new Set(removidos.map((r) => r.item_id))], [removidos]);

  // ── Query: trajetória completa dos itens removidos ──
  const { data: trajetoria = [] } = useQuery({
    queryKey: ["kanban-historico-trajetoria", removidoIds],
    queryFn: async () => {
      if (removidoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kanban_historico")
        .select("*")
        .eq("kanban_type", selectedUser)
        .in("item_id", removidoIds)
        .order("created_at", { ascending: true });
      if (error) { logError("Erro ao buscar trajetória:", error); return []; }
      return (data || []) as HistoricoRecord[];
    },
    enabled: removidoIds.length > 0,
  });

  // ── Montar itens arquivados ──
  const itensArquivados = useMemo(() => {
    const map = new Map<string, ItemArquivado>();
    for (const reg of removidos) {
      const key = `${reg.item_id}-${reg.item_tipo}`;
      if (map.has(key)) continue;
      map.set(key, {
        item_id: reg.item_id,
        item_tipo: reg.item_tipo,
        item_titulo: reg.item_titulo || "Item sem título",
        removido_em: reg.created_at,
        removido_por: reg.movido_por,
        ultima_posicao: reg.posicao_anterior,
        snapshot: reg.snapshot,
        movimentos: trajetoria.filter((t) => t.item_id === reg.item_id && t.item_tipo === reg.item_tipo),
      });
    }
    return Array.from(map.values());
  }, [removidos, trajetoria]);

  // ── Filtrar ──
  const itensFiltrados = useMemo(() => {
    let items = itensArquivados;
    if (tipoFilter !== "todos") items = items.filter((i) => i.item_tipo === tipoFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter((i) => i.item_titulo.toLowerCase().includes(term));
    }
    return items;
  }, [itensArquivados, tipoFilter, searchTerm]);

  const countByTipo = useMemo(() => {
    const c = { todos: itensArquivados.length, tarefa: 0, demanda: 0, rota: 0 };
    for (const i of itensArquivados) c[i.item_tipo]++;
    return c;
  }, [itensArquivados]);

  const comSnapshot = itensArquivados.filter((i) => !!i.snapshot).length;

  const getMovidoPorNome = (userId: string | null) => {
    if (!userId) return "";
    return responsaveis.find((r) => r.id === userId)?.nome || "";
  };

  const getTipoBadge = (tipo: string) => {
    const styles: Record<string, string> = {
      demanda: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      tarefa: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
      rota: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
    const icons: Record<string, React.ReactNode> = {
      demanda: <FileText className="h-2.5 w-2.5 mr-0.5" />,
      tarefa: <CheckSquare className="h-2.5 w-2.5 mr-0.5" />,
      rota: <Route className="h-2.5 w-2.5 mr-0.5" />,
    };
    const labels: Record<string, string> = { demanda: "Demanda", tarefa: "Tarefa", rota: "Rota" };
    return (
      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${styles[tipo] || ""}`}>
        {icons[tipo]} {labels[tipo] || tipo}
      </Badge>
    );
  };

  const getAcaoIcon = (acao: string) => {
    if (acao === "adicionado") return <Plus className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />;
    if (acao === "movido") return <MoveHorizontal className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />;
    if (acao === "removido") return <Minus className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />;
    return null;
  };

  const tipoTabs: { id: typeof tipoFilter; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: countByTipo.todos },
    { id: "tarefa", label: "Tarefas", count: countByTipo.tarefa },
    { id: "demanda", label: "Demandas", count: countByTipo.demanda },
    { id: "rota", label: "Rotas", count: countByTipo.rota },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex rounded-lg bg-muted p-0.5 text-sm shrink-0">
            {(["semana", "mes"] as PeriodoTipo[]).map((t) => (
              <button key={t} onClick={() => setPeriodoTipo(t)}
                className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-md transition-colors ${
                  periodoTipo === t ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => setCurrentDate(navigatePeriod(currentDate, periodoTipo, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="flex items-center gap-2 min-w-0 md:min-w-[200px] justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs md:text-sm font-medium truncate">{periodoLabel}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => setCurrentDate(navigatePeriod(currentDate, periodoTipo, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs">Hoje</Button>
        </div>

        <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            <strong className="text-foreground">{itensArquivados.length}</strong> item(s) arquivado(s)
          </span>
          {comSnapshot > 0 && (
            <span className="text-violet-600 dark:text-violet-400">{comSnapshot} com dados preservados</span>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex rounded-lg bg-muted/50 p-1 gap-1">
          {tipoTabs.map((tab) => (
            <button key={tab.id} onClick={() => setTipoFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tipoFilter === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">{tab.count}</Badge>}
            </button>
          ))}
        </div>

        {itensArquivados.length > 3 && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título…" className="h-8 pl-8 text-xs" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-muted-foreground">Carregando histórico...</p>
          </div>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">
              {itensArquivados.length === 0 ? "Nenhum item arquivado neste período" : "Nenhum resultado para o filtro"}
            </p>
            <p className="text-sm mt-1">
              {itensArquivados.length === 0 ? "Itens removidos do board aparecerão aqui." : "Tente outro filtro ou período."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {itensFiltrados.map((item) => (
            <ArquivadoCard key={`${item.item_id}-${item.item_tipo}`} item={item}
              getTipoBadge={getTipoBadge} getAcaoIcon={getAcaoIcon} getMovidoPorNome={getMovidoPorNome} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de item arquivado ──
function ArquivadoCard({ item, getTipoBadge, getAcaoIcon, getMovidoPorNome }: {
  item: ItemArquivado;
  getTipoBadge: (tipo: string) => React.ReactNode;
  getAcaoIcon: (acao: string) => React.ReactNode;
  getMovidoPorNome: (userId: string | null) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const snap = item.snapshot;
  const hasSnapshot = !!snap;
  const hasMovimentos = item.movimentos.length > 0;
  const removidoPorNome = getMovidoPorNome(item.removido_por);

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md cursor-pointer border-l-4 ${
        item.item_tipo === "rota" ? "border-l-emerald-500"
        : item.item_tipo === "tarefa" ? "border-l-violet-500"
        : "border-l-blue-500"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="space-y-1.5">
          <CardTitle className="text-sm font-medium leading-tight">{item.item_titulo}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {getTipoBadge(item.item_tipo)}
            {hasSnapshot && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400">
                Dados preservados
              </Badge>
            )}
            {item.ultima_posicao && (
              <span className="text-[10px] text-muted-foreground">Saiu de: {getPosicaoLabel(item.ultima_posicao)}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            Removido em{" "}
            {new Date(item.removido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          {removidoPorNome && <span className="text-muted-foreground/60">por {removidoPorNome}</span>}
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {hasSnapshot && (
              <div className="space-y-3">
                {snap.descricao && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Descrição</p>
                    <p className="text-xs text-foreground bg-muted/50 rounded-md p-2 whitespace-pre-wrap"><Linkify>{snap.descricao}</Linkify></p>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {snap.prioridade && (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Prioridade: <span className="font-medium text-foreground capitalize">{snap.prioridade}</span>
                    </span>
                  )}
                  {snap.responsavel?.nome && (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{snap.responsavel.nome}</span>
                  )}
                  {snap.data_prazo && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Prazo: {new Date(snap.data_prazo + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {snap.completed && (
                    <span className="flex items-center gap-1 text-green-600"><CheckSquare className="h-3 w-3" />Concluída</span>
                  )}
                </div>
                {snap.colaboradores?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Users className="h-3 w-3" /> Colaboradores
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {snap.colaboradores.map((c: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{c.nome}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {snap.checklist?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Checklist ({snap.checklist.filter((c: any) => c.concluido).length}/{snap.checklist.length})
                    </p>
                    <div className="space-y-1 bg-muted/30 rounded-md p-2">
                      {snap.checklist.map((ci: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                            ci.concluido ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/40"
                          }`}>
                            {ci.concluido && <span className="text-[8px]">✓</span>}
                          </div>
                          <span className={ci.concluido ? "line-through text-muted-foreground" : "text-foreground"}>{ci.texto}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snap.comentarios?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Comentários ({snap.comentarios.length})
                    </p>
                    <div className="space-y-2 bg-muted/30 rounded-md p-2">
                      {snap.comentarios.map((c: any, i: number) => (
                        <div key={i} className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{c.autor_nome}</span>
                            <span className="text-muted-foreground/60">
                              {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap pl-0.5"><Linkify>{c.texto}</Linkify></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasMovimentos && (
              <div className="space-y-1.5">
                {hasSnapshot && <div className="border-t pt-2" />}
                <p className="text-xs font-medium text-muted-foreground mb-2">Trajetória completa:</p>
                {item.movimentos.map((mov) => (
                  <div key={mov.id} className="flex items-start gap-2 text-xs">
                    {getAcaoIcon(mov.acao)}
                    <div className="flex-1">
                      <span className="text-muted-foreground">
                        {mov.acao === "adicionado" && <>Adicionado em <span className="font-medium text-foreground">{getPosicaoLabel(mov.posicao_nova)}</span></>}
                        {mov.acao === "movido" && <><span className="font-medium text-foreground">{getPosicaoLabel(mov.posicao_anterior)}</span>{" → "}<span className="font-medium text-foreground">{getPosicaoLabel(mov.posicao_nova)}</span></>}
                        {mov.acao === "removido" && <>Removido de <span className="font-medium text-foreground">{getPosicaoLabel(mov.posicao_anterior)}</span></>}
                      </span>
                      <span className="ml-2 text-muted-foreground/60">
                        {new Date(mov.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {getMovidoPorNome(mov.movido_por) && (
                        <span className="ml-1 text-muted-foreground/60">por {getMovidoPorNome(mov.movido_por)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          {expanded ? "Clique para recolher"
            : hasSnapshot ? "Clique para ver detalhes completos"
            : hasMovimentos ? "Clique para ver trajetória" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
