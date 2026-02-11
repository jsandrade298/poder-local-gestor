import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  MapPin,
} from "lucide-react";
import { formatDateTime, formatDateOnly } from "@/lib/dateUtils";
import { logError } from "@/lib/errorUtils";

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
}

interface ItemHistorico {
  item_id: string;
  item_tipo: "demanda" | "tarefa" | "rota";
  item_titulo: string;
  posicao_final: string | null; // null = removido
  removido: boolean;
  movimentos: HistoricoRecord[];
  primeira_entrada: string; // timestamp
  ultima_atividade: string; // timestamp
}

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const statusColumns = [
  { id: "a_fazer", title: "A Fazer", color: "hsl(var(--chart-1))" },
  { id: "em_progresso", title: "Em Progresso", color: "hsl(var(--chart-2))" },
  { id: "feito", title: "Feito", color: "hsl(var(--chart-4))" },
];

// ── Helpers de período ──
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
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
}

function getWeekLabel(date: Date): string {
  const { start, end } = getWeekRange(date);
  const formatDay = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${formatDay(start)} — ${formatDay(end)}`;
}

function getMonthLabel(date: Date): string {
  return `${MESES_PT[date.getMonth()]} ${date.getFullYear()}`;
}

function navigatePeriod(
  currentDate: Date,
  tipo: PeriodoTipo,
  direction: number
): Date {
  const d = new Date(currentDate);
  if (tipo === "semana") {
    d.setDate(d.getDate() + 7 * direction);
  } else {
    d.setMonth(d.getMonth() + direction);
  }
  return d;
}

// ── Component ──
export function HistoricoView({
  selectedUser,
  responsaveis,
}: HistoricoViewProps) {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calcular range do período
  const { start: periodoStart, end: periodoEnd } = useMemo(() => {
    return periodoTipo === "semana"
      ? getWeekRange(currentDate)
      : getMonthRange(currentDate);
  }, [currentDate, periodoTipo]);

  // Buscar registros do período
  const { data: registros = [], isLoading } = useQuery({
    queryKey: [
      "kanban-historico",
      selectedUser,
      periodoStart.toISOString(),
      periodoEnd.toISOString(),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_historico")
        .select("*")
        .eq("kanban_type", selectedUser)
        .gte("created_at", periodoStart.toISOString())
        .lte("created_at", periodoEnd.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        logError("Erro ao buscar histórico:", error);
        throw error;
      }
      return (data || []) as HistoricoRecord[];
    },
  });

  // Buscar snapshot: último registro de cada item ANTES do período
  // (para saber quais items já estavam no board quando o período começou)
  const { data: snapshotAnterior = [] } = useQuery({
    queryKey: [
      "kanban-historico-snapshot",
      selectedUser,
      periodoStart.toISOString(),
    ],
    queryFn: async () => {
      // Pegar todos os registros anteriores ao período para este kanban
      const { data, error } = await supabase
        .from("kanban_historico")
        .select("*")
        .eq("kanban_type", selectedUser)
        .lt("created_at", periodoStart.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        logError("Erro ao buscar snapshot:", error);
        throw error;
      }
      return (data || []) as HistoricoRecord[];
    },
  });

  // Processar dados: reconstruir estado do board no período
  const itensHistorico = useMemo(() => {
    const itemMap = new Map<string, ItemHistorico>();

    // 1. Processar snapshot anterior — encontrar último estado de cada item
    for (const reg of snapshotAnterior) {
      const key = `${reg.item_id}-${reg.item_tipo}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          item_id: reg.item_id,
          item_tipo: reg.item_tipo,
          item_titulo: reg.item_titulo,
          posicao_final: null,
          removido: false,
          movimentos: [],
          primeira_entrada: reg.created_at,
          ultima_atividade: reg.created_at,
        });
      }
      const item = itemMap.get(key)!;
      // Atualizar posição com base na última ação pré-período
      if (reg.acao === "removido") {
        item.posicao_final = null;
        item.removido = true;
      } else {
        item.posicao_final = reg.posicao_nova;
        item.removido = false;
      }
      item.ultima_atividade = reg.created_at;
      if (reg.item_titulo) item.item_titulo = reg.item_titulo;
    }

    // Remover itens que estavam removidos antes do período começar
    for (const [key, item] of itemMap.entries()) {
      if (item.removido) {
        itemMap.delete(key);
      }
    }

    // 2. Processar registros do período
    for (const reg of registros) {
      const key = `${reg.item_id}-${reg.item_tipo}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          item_id: reg.item_id,
          item_tipo: reg.item_tipo,
          item_titulo: reg.item_titulo,
          posicao_final: null,
          removido: false,
          movimentos: [],
          primeira_entrada: reg.created_at,
          ultima_atividade: reg.created_at,
        });
      }
      const item = itemMap.get(key)!;
      item.movimentos.push(reg);
      item.ultima_atividade = reg.created_at;
      if (reg.item_titulo) item.item_titulo = reg.item_titulo;

      // Atualizar estado
      if (reg.acao === "removido") {
        item.posicao_final = reg.posicao_anterior;
        item.removido = true;
      } else {
        item.posicao_final = reg.posicao_nova;
        item.removido = false;
      }
    }

    return Array.from(itemMap.values());
  }, [registros, snapshotAnterior]);

  // Agrupar itens por coluna
  const itensPorColuna = useMemo(() => {
    const result: Record<string, ItemHistorico[]> = {
      a_fazer: [],
      em_progresso: [],
      feito: [],
      removido: [],
    };

    for (const item of itensHistorico) {
      if (item.removido) {
        result.removido.push(item);
      } else if (item.posicao_final && result[item.posicao_final]) {
        result[item.posicao_final].push(item);
      }
    }

    return result;
  }, [itensHistorico]);

  const totalItems =
    itensPorColuna.a_fazer.length +
    itensPorColuna.em_progresso.length +
    itensPorColuna.feito.length;
  const totalRemovidos = itensPorColuna.removido.length;
  const totalMovimentos = registros.length;

  // Helpers
  const getMovidoPorNome = (userId: string | null) => {
    if (!userId) return "";
    const resp = responsaveis.find((r) => r.id === userId);
    return resp?.nome || "";
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "demanda":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >
            <FileText className="h-2.5 w-2.5 mr-0.5" />
            Demanda
          </Badge>
        );
      case "tarefa":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          >
            <CheckSquare className="h-2.5 w-2.5 mr-0.5" />
            Tarefa
          </Badge>
        );
      case "rota":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <Route className="h-2.5 w-2.5 mr-0.5" />
            Rota
          </Badge>
        );
      default:
        return null;
    }
  };

  const getAcaoIcon = (acao: string) => {
    switch (acao) {
      case "adicionado":
        return <Plus className="h-3 w-3 text-emerald-500" />;
      case "movido":
        return <MoveHorizontal className="h-3 w-3 text-blue-500" />;
      case "removido":
        return <Minus className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getPosicaoLabel = (posicao: string | null) => {
    switch (posicao) {
      case "a_fazer":
        return "A Fazer";
      case "em_progresso":
        return "Em Progresso";
      case "feito":
        return "Feito";
      default:
        return posicao || "—";
    }
  };

  const periodoLabel =
    periodoTipo === "semana"
      ? getWeekLabel(currentDate)
      : getMonthLabel(currentDate);

  return (
    <div className="space-y-6">
      {/* ── Controles de período ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Toggle Semana/Mês */}
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            <button
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                periodoTipo === "semana"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPeriodoTipo("semana")}
            >
              Semana
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                periodoTipo === "mes"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPeriodoTipo("mes")}
            >
              Mês
            </button>
          </div>

          {/* Navegação ← Período → */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() =>
                setCurrentDate(navigatePeriod(currentDate, periodoTipo, -1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-[200px] justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{periodoLabel}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() =>
                setCurrentDate(navigatePeriod(currentDate, periodoTipo, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Botão Hoje */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="text-xs"
          >
            Hoje
          </Button>
        </div>

        {/* Resumo */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {totalItems} item(s) no board
          </span>
          {totalRemovidos > 0 && (
            <span className="text-orange-500">
              {totalRemovidos} removido(s)
            </span>
          )}
          <span>{totalMovimentos} movimentação(ões)</span>
        </div>
      </div>

      {/* ── Colunas históricas ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              Carregando histórico...
            </p>
          </div>
        </div>
      ) : totalItems === 0 && totalRemovidos === 0 ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">
              Nenhuma atividade neste período
            </p>
            <p className="text-sm mt-1">
              Movimente itens no board para gerar histórico.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statusColumns.map((column) => {
            const items = itensPorColuna[column.id] || [];

            return (
              <div key={column.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    {column.title}
                    <Badge variant="secondary" className="ml-2">
                      {items.length}
                    </Badge>
                  </h2>
                </div>

                <div className="min-h-[200px] space-y-3 p-3 rounded-lg border border-muted-foreground/20 bg-muted/5">
                  {items.map((item) => (
                    <HistoricoCard
                      key={`${item.item_id}-${item.item_tipo}`}
                      item={item}
                      getTipoBadge={getTipoBadge}
                      getAcaoIcon={getAcaoIcon}
                      getPosicaoLabel={getPosicaoLabel}
                      getMovidoPorNome={getMovidoPorNome}
                    />
                  ))}

                  {items.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum item nesta coluna
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Seção de removidos ── */}
      {totalRemovidos > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Minus className="h-4 w-4 text-orange-500" />
            Removidos no período
            <Badge
              variant="secondary"
              className="ml-2 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
            >
              {totalRemovidos}
            </Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {itensPorColuna.removido.map((item) => (
              <HistoricoCard
                key={`${item.item_id}-${item.item_tipo}`}
                item={item}
                getTipoBadge={getTipoBadge}
                getAcaoIcon={getAcaoIcon}
                getPosicaoLabel={getPosicaoLabel}
                getMovidoPorNome={getMovidoPorNome}
                isRemovido
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card do histórico ──
function HistoricoCard({
  item,
  getTipoBadge,
  getAcaoIcon,
  getPosicaoLabel,
  getMovidoPorNome,
  isRemovido = false,
}: {
  item: ItemHistorico;
  getTipoBadge: (tipo: string) => React.ReactNode;
  getAcaoIcon: (acao: string) => React.ReactNode;
  getPosicaoLabel: (posicao: string | null) => string;
  getMovidoPorNome: (userId: string | null) => string;
  isRemovido?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-sm cursor-pointer border-l-4 ${
        isRemovido
          ? "border-l-orange-400 opacity-75"
          : item.item_tipo === "rota"
          ? "border-l-emerald-500"
          : item.item_tipo === "tarefa"
          ? "border-l-violet-500"
          : "border-l-blue-500"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium leading-tight">
            {item.item_titulo || "Item sem título"}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {getTipoBadge(item.item_tipo)}
            {isRemovido && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600"
              >
                Removido
              </Badge>
            )}
            {item.movimentos.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {item.movimentos.length} movimentação(ões)
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 pb-3">
        {/* Timestamps resumidos */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Desde{" "}
            {new Date(item.primeira_entrada).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
          {item.movimentos.length > 0 && (
            <>
              <ArrowRight className="h-3 w-3" />
              <span>
                Última atividade{" "}
                {new Date(item.ultima_atividade).toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                )}
              </span>
            </>
          )}
        </div>

        {/* Timeline expandida */}
        {expanded && item.movimentos.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Movimentações no período:
            </p>
            {item.movimentos.map((mov) => (
              <div
                key={mov.id}
                className="flex items-start gap-2 text-xs"
              >
                {getAcaoIcon(mov.acao)}
                <div className="flex-1">
                  <span className="text-muted-foreground">
                    {mov.acao === "adicionado" && (
                      <>
                        Adicionado em{" "}
                        <span className="font-medium text-foreground">
                          {getPosicaoLabel(mov.posicao_nova)}
                        </span>
                      </>
                    )}
                    {mov.acao === "movido" && (
                      <>
                        <span className="font-medium text-foreground">
                          {getPosicaoLabel(mov.posicao_anterior)}
                        </span>
                        {" → "}
                        <span className="font-medium text-foreground">
                          {getPosicaoLabel(mov.posicao_nova)}
                        </span>
                      </>
                    )}
                    {mov.acao === "removido" && (
                      <>
                        Removido de{" "}
                        <span className="font-medium text-foreground">
                          {getPosicaoLabel(mov.posicao_anterior)}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="ml-2 text-muted-foreground/60">
                    {new Date(mov.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {getMovidoPorNome(mov.movido_por) && (
                    <span className="ml-1 text-muted-foreground/60">
                      por {getMovidoPorNome(mov.movido_por)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Indicador de expandir */}
        {item.movimentos.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
            {expanded ? "Clique para recolher" : "Clique para ver movimentações"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
