import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, Clock, AlertTriangle, Smile, Target,
  Download, ArrowLeft, Printer, ChevronDown, ChevronUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import {
  useBalancoData, suggestGranularity,
  BalancoFilters, TemporalGranularity,
} from "@/hooks/useBalancoData";

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#2563eb",
];

const GRANULARITY_LABELS: Record<TemporalGranularity, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export default function BalancoDemandas() {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<BalancoFilters>({
    dateFrom: "", dateTo: "", areaId: "all", responsavelId: "all", cidadeFilter: "all",
  });
  const [granularity, setGranularity] = useState<TemporalGranularity>("mensal");
  const [granularityAutoSet, setGranularityAutoSet] = useState(false);
  const [showAllBairros, setShowAllBairros] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showAllResponsaveis, setShowAllResponsaveis] = useState(false);

  const {
    isLoading, areas, responsaveis, cidades, statusList,
    getStatusLabel, getStatusColor, kpis,
    evolucaoData, humorEvolucaoData,
    origemData, bairroDataFull, areaStatusDataFull,
    responsavelDataFull, prioridadeData, prioridadeStatusData,
    atrasoDistribuicao, atrasoPorArea,
    funilData, topMunicipes, humorAreaData, humorOrigemData,
    csvData, demandas,
  } = useBalancoData(filters, granularity);

  // Auto-suggest granularity on first load
  useEffect(() => {
    if (!granularityAutoSet && demandas.length > 0) {
      setGranularity(suggestGranularity(demandas));
      setGranularityAutoSet(true);
    }
  }, [demandas, granularityAutoSet]);

  // Sliced data for "Ver todos"
  const bairroData = useMemo(() => showAllBairros ? bairroDataFull : bairroDataFull.slice(0, 10), [bairroDataFull, showAllBairros]);
  const areaStatusData = useMemo(() => showAllAreas ? areaStatusDataFull : areaStatusDataFull.slice(0, 10), [areaStatusDataFull, showAllAreas]);
  const responsavelData = useMemo(() => showAllResponsaveis ? responsavelDataFull : responsavelDataFull.slice(0, 10), [responsavelDataFull, showAllResponsaveis]);

  const hasActiveFilter = filters.dateFrom || filters.dateTo || filters.areaId !== "all" || filters.responsavelId !== "all" || filters.cidadeFilter !== "all";

  // ===== Export =====
  const exportCSV = () => {
    if (csvData.length === 0) return;
    const headers = Object.keys(csvData[0]);
    const rows = csvData.map((row: any) => headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balanco-demandas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", areaId: "all", responsavelId: "all", cidadeFilter: "all" });
  };

  // ===== Shared Tooltips =====
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-sm max-w-xs">
        <p className="font-semibold mb-1.5 border-b pb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="flex justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const total = kpis.total || 1;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-sm">
        <p className="font-semibold">{d.name}</p>
        <p className="text-lg font-bold" style={{ color: d.payload.fill || d.payload.color }}>
          {d.value} <span className="text-xs font-normal text-muted-foreground">({((d.value / total) * 100).toFixed(1)}%)</span>
        </p>
      </div>
    );
  };

  // ===== Granularity Toggle =====
  const GranularityToggle = () => (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
      {(["mensal", "trimestral", "semestral", "anual"] as TemporalGranularity[]).map((g) => (
        <button key={g} onClick={() => setGranularity(g)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            granularity === g ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
          {GRANULARITY_LABELS[g]}
        </button>
      ))}
    </div>
  );

  // ===== Empty state =====
  const EmptyState = ({ msg }: { msg: string }) => (
    <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">{msg}</div>
  );

  // ===== Loading =====
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando dados do balanço...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #balanco-print, #balanco-print * { visibility: visible; }
          #balanco-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { margin: 1cm; size: A4 landscape; }
        }
      `}</style>

      <div id="balanco-print" className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/demandas")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Balanço de Demandas</h1>
              <p className="text-sm text-muted-foreground">
                {demandas.length} demandas
                {filters.dateFrom && ` • De ${new Date(filters.dateFrom).toLocaleDateString("pt-BR")}`}
                {filters.dateTo && ` até ${new Date(filters.dateTo).toLocaleDateString("pt-BR")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)}
              className={hasActiveFilter ? "border-primary text-primary" : ""}>
              {filtersOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              Filtros {hasActiveFilter && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-[10px]">!</Badge>}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" />PDF</Button>
          </div>
        </div>

        {/* ===== FILTROS (collapsible) ===== */}
        {filtersOpen && (
          <Card className="no-print border-0 shadow-sm animate-in slide-in-from-top-2 duration-200">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Período</label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={filters.dateFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                      max={filters.dateTo || undefined} className="flex-1" />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input type="date" value={filters.dateTo}
                      onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                      min={filters.dateFrom || undefined} className="flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Área</label>
                  <Select value={filters.areaId} onValueChange={(v) => setFilters((f) => ({ ...f, areaId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Responsável</label>
                  <Select value={filters.responsavelId} onValueChange={(v) => setFilters((f) => ({ ...f, responsavelId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {responsaveis.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cidade</label>
                  <Select value={filters.cidadeFilter} onValueChange={(v) => setFilters((f) => ({ ...f, cidadeFilter: v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full">Limpar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== KPIs (always visible) ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: <BarChart3 className="h-4 w-4 text-blue-500" />, label: "Total", value: kpis.total, sub: "" },
            { icon: <Target className="h-4 w-4 text-green-500" />, label: "Conclusão", value: `${kpis.taxaConclusao}%`, sub: `${kpis.atendidas} atendidas`, color: "text-green-600" },
            { icon: <Clock className="h-4 w-4 text-cyan-500" />, label: "Tempo Médio", value: `${kpis.tempoMedio}d`, sub: "resolução" },
            { icon: <AlertTriangle className="h-4 w-4 text-red-500" />, label: "Em Atraso", value: kpis.emAtraso, sub: `${kpis.percAtraso}% do total`, color: "text-red-600" },
            { icon: <Smile className="h-4 w-4 text-yellow-500" />, label: "Humor", value: `${kpis.humorEmoji} ${kpis.humorMedio || "—"}`, sub: `${kpis.totalComHumor} avaliações` },
            { icon: <TrendingUp className="h-4 w-4 text-purple-500" />, label: "Top Origem", value: kpis.origemMaisFreq, sub: "", isText: true },
          ].map((kpi, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {kpi.icon}
                  <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={`${kpi.isText ? "text-base" : "text-2xl"} font-bold ${kpi.color || ""} truncate`}>{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ===== TABS ===== */}
        <Tabs defaultValue="visao-geral" className="space-y-4">
          <TabsList className="no-print w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="visao-geral" className="text-xs sm:text-sm">📊 Visão Geral</TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs sm:text-sm">📈 Evolução</TabsTrigger>
            <TabsTrigger value="origem" className="text-xs sm:text-sm">📍 Origem</TabsTrigger>
            <TabsTrigger value="territorios" className="text-xs sm:text-sm">🗺️ Territórios</TabsTrigger>
            <TabsTrigger value="areas" className="text-xs sm:text-sm">🏢 Áreas</TabsTrigger>
            <TabsTrigger value="equipe" className="text-xs sm:text-sm">👥 Equipe</TabsTrigger>
            <TabsTrigger value="prioridades" className="text-xs sm:text-sm">⚡ Prioridades</TabsTrigger>
            <TabsTrigger value="satisfacao" className="text-xs sm:text-sm">😊 Satisfação</TabsTrigger>
          </TabsList>

          {/* ========== VISÃO GERAL ========== */}
          <TabsContent value="visao-geral" className="space-y-4">
            {/* Funil de Status */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Funil de Status — Estado Atual da Operação</CardTitle>
              </CardHeader>
              <CardContent>
                {funilData.length === 0 ? <EmptyState msg="Sem dados de status" /> : (
                  <div className="space-y-3">
                    {(() => {
                      const maxVal = Math.max(...funilData.map((f: any) => f.value), 1);
                      return funilData.map((item: any) => (
                        <div key={item.slug} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="font-semibold text-base">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold">{item.value}</span>
                              <span className="text-sm text-muted-foreground w-14 text-right">
                                {kpis.total > 0 ? Math.round((item.value / kpis.total) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                          <div className="h-8 bg-muted/40 rounded-lg overflow-hidden">
                            <div className="h-full rounded-lg transition-all duration-500"
                              style={{ width: `${Math.max((item.value / maxVal) * 100, 1)}%`, backgroundColor: item.color, opacity: 0.85 }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo textual */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Resumo Analítico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                    <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Volume</p>
                    <p className="text-blue-700 dark:text-blue-400">
                      {kpis.total} demandas no período, com {kpis.atendidas} atendidas ({kpis.taxaConclusao}% de conclusão).
                    </p>
                  </div>
                  {kpis.emAtraso > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl">
                      <p className="font-semibold text-red-800 dark:text-red-300 mb-1">Atenção</p>
                      <p className="text-red-700 dark:text-red-400">
                        {kpis.emAtraso} demandas em atraso ({kpis.percAtraso}%).
                        {atrasoPorArea.length > 0 && ` Área com mais atrasos: "${atrasoPorArea[0]?.name}".`}
                      </p>
                    </div>
                  )}
                  {kpis.tempoMedio > 0 && (
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl">
                      <p className="font-semibold text-cyan-800 dark:text-cyan-300 mb-1">Eficiência</p>
                      <p className="text-cyan-700 dark:text-cyan-400">
                        Tempo médio de resolução: {kpis.tempoMedio} dias. Principal canal: {kpis.origemMaisFreq}.
                      </p>
                    </div>
                  )}
                  {kpis.totalComHumor > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl">
                      <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Satisfação</p>
                      <p className="text-yellow-700 dark:text-yellow-400">
                        Humor médio: {kpis.humorEmoji} {kpis.humorMedio}/5 ({kpis.totalComHumor} avaliações).
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== EVOLUÇÃO ========== */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Evolução Temporal de Demandas</CardTitle>
                  <GranularityToggle />
                </div>
              </CardHeader>
              <CardContent>
                {evolucaoData.length === 0 ? <EmptyState msg="Sem dados temporais" /> : (
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={evolucaoData} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="periodo" tick={{ fontSize: 12 }} interval={0} angle={evolucaoData.length > 16 ? -45 : 0}
                        textAnchor={evolucaoData.length > 16 ? "end" : "middle"} height={evolucaoData.length > 16 ? 60 : 30} />
                      <YAxis tick={{ fontSize: 12 }} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 13 }} />
                      {statusList.map((s, i) => (
                        <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor}
                          radius={i === statusList.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ORIGEM & CANAIS ========== */}
          <TabsContent value="origem" className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Distribuição por Origem</CardTitle>
                </CardHeader>
                <CardContent>
                  {origemData.length === 0 ? <EmptyState msg="Nenhum dado de origem" /> : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie data={origemData} dataKey="value" cx="50%" cy="50%"
                            innerRadius={80} outerRadius={140} paddingAngle={2} strokeWidth={0}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={{ strokeWidth: 1 }}>
                            {origemData.map((_: any, i: number) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                        {origemData.map((item: any, i: number) => (
                          <div key={item.slug} className="flex items-center gap-1.5 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span>{item.name}: <strong>{item.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Humor Médio por Canal de Origem</CardTitle>
                </CardHeader>
                <CardContent>
                  {humorOrigemData.length === 0 ? <EmptyState msg="Sem dados de humor × origem" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(350, humorOrigemData.length * 50)}>
                      <BarChart data={humorOrigemData} layout="vertical" barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={160} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="media" name="Humor Médio" radius={[0, 6, 6, 0]} barSize={28}>
                          {humorOrigemData.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.media <= 2 ? "#ef4444" : entry.media <= 3 ? "#eab308" : "#22c55e"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========== TERRITÓRIOS ========== */}
          <TabsContent value="territorios" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Demandas por Bairro {!showAllBairros && bairroDataFull.length > 10 && `(Top 10 de ${bairroDataFull.length})`}
                  </CardTitle>
                  {bairroDataFull.length > 10 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllBairros(!showAllBairros)}>
                      {showAllBairros ? "Mostrar Top 10" : `Ver todos (${bairroDataFull.length})`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {bairroData.length === 0 ? <EmptyState msg="Sem dados de bairro" /> : (
                  <ResponsiveContainer width="100%" height={Math.max(350, bairroData.length * 40)}>
                    <BarChart data={bairroData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={160} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Demandas" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ÁREAS ========== */}
          <TabsContent value="areas" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Demandas por Área × Status {!showAllAreas && areaStatusDataFull.length > 10 && `(Top 10 de ${areaStatusDataFull.length})`}
                  </CardTitle>
                  {areaStatusDataFull.length > 10 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllAreas(!showAllAreas)}>
                      {showAllAreas ? "Mostrar Top 10" : `Ver todas (${areaStatusDataFull.length})`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {areaStatusData.length === 0 ? <EmptyState msg="Sem dados de áreas" /> : (
                  <ResponsiveContainer width="100%" height={Math.max(350, areaStatusData.length * 45)}>
                    <BarChart data={areaStatusData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={160} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 13 }} />
                      {statusList.map((s) => (
                        <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Atrasos por área */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Atrasos por Área</CardTitle>
              </CardHeader>
              <CardContent>
                {atrasoPorArea.length === 0 ? <EmptyState msg="Nenhum atraso registrado" /> : (
                  <ResponsiveContainer width="100%" height={Math.max(250, atrasoPorArea.length * 45)}>
                    <BarChart data={atrasoPorArea} layout="vertical" barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={160} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Em atraso" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== EQUIPE ========== */}
          <TabsContent value="equipe" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Desempenho por Responsável {!showAllResponsaveis && responsavelDataFull.length > 10 && `(Top 10 de ${responsavelDataFull.length})`}
                  </CardTitle>
                  {responsavelDataFull.length > 10 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllResponsaveis(!showAllResponsaveis)}>
                      {showAllResponsaveis ? "Mostrar Top 10" : `Ver todos (${responsavelDataFull.length})`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {responsavelData.length === 0 ? <EmptyState msg="Sem dados" /> : (
                  <div className="space-y-5">
                    {responsavelData.map((r: any) => (
                      <div key={r.name} className="space-y-2 p-4 rounded-xl bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-base">{r.name}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span><strong>{r.total}</strong> total</span>
                            <span className="text-green-600"><strong>{r.atendidas}</strong> atendidas</span>
                            <span><strong>{r.pendentes}</strong> pendentes</span>
                            {r.tempoMedio > 0 && <span className="text-muted-foreground">{r.tempoMedio}d médio</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${r.taxa}%` }} />
                          </div>
                          <Badge variant={r.taxa >= 70 ? "default" : r.taxa >= 40 ? "secondary" : "destructive"}
                            className="text-sm font-bold min-w-[52px] justify-center">{r.taxa}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Responsável × Status (bar chart) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição de Status por Responsável</CardTitle>
              </CardHeader>
              <CardContent>
                {responsavelData.length === 0 ? <EmptyState msg="Sem dados" /> : (
                  <ResponsiveContainer width="100%" height={Math.max(350, responsavelData.length * 45)}>
                    <BarChart data={responsavelData} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={160} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 13 }} />
                      {statusList.map((s) => (
                        <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== PRIORIDADES & PRAZOS ========== */}
          <TabsContent value="prioridades" className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Prioridade donut */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Distribuição por Prioridade</CardTitle>
                </CardHeader>
                <CardContent>
                  {prioridadeData.length === 0 ? <EmptyState msg="Sem dados" /> : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie data={prioridadeData} dataKey="value" cx="50%" cy="50%"
                            innerRadius={70} outerRadius={120} paddingAngle={3} strokeWidth={0}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={{ strokeWidth: 1 }}>
                            {prioridadeData.map((entry: any) => (
                              <Cell key={entry.slug} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-5 mt-2">
                        {prioridadeData.map((p: any) => (
                          <div key={p.slug} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{p.name}: <strong>{p.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Prioridade × Status */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Prioridade × Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {prioridadeStatusData.length === 0 ? <EmptyState msg="Sem dados" /> : (
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={prioridadeStatusData} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                        <YAxis tick={{ fontSize: 12 }} width={40} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 13 }} />
                        {statusList.map((s) => (
                          <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Distribuição de atrasos */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição de Atrasos por Faixa</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={atrasoDistribuicao} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 12 }} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Demandas" radius={[6, 6, 0, 0]} barSize={50}>
                      {atrasoDistribuicao.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== SATISFAÇÃO ========== */}
          <TabsContent value="satisfacao" className="space-y-4">
            {/* Humor ao longo do tempo */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Evolução do Humor ao Longo do Tempo</CardTitle>
                  <GranularityToggle />
                </div>
              </CardHeader>
              <CardContent>
                {humorEvolucaoData.length === 0 ? <EmptyState msg="Sem dados de humor" /> : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={humorEvolucaoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} width={35}
                        tickFormatter={(v) => ["", "😡", "😞", "😐", "😊", "😍"][v] || ""} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={35} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 13 }} />
                      <Line yAxisId="left" type="monotone" dataKey="media" name="Humor Médio"
                        stroke="#eab308" strokeWidth={3} dot={{ fill: "#eab308", r: 5 }} activeDot={{ r: 7 }} />
                      <Line yAxisId="right" type="monotone" dataKey="avaliacoes" name="Nº Avaliações"
                        stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#8b5cf6", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Humor × Área */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Humor Médio por Área</CardTitle>
                </CardHeader>
                <CardContent>
                  {humorAreaData.length === 0 ? <EmptyState msg="Sem dados" /> : (
                    <div className="space-y-4">
                      {humorAreaData.map((item: any) => {
                        const emoji = item.media <= 1.5 ? "😡" : item.media <= 2.5 ? "😞" : item.media <= 3.5 ? "😐" : item.media <= 4.5 ? "😊" : "😍";
                        return (
                          <div key={item.name} className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm min-w-[120px] truncate">{item.name}</span>
                            <div className="flex-1 flex items-center gap-3">
                              <div className="flex-1 h-3.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${(item.media / 5) * 100}%`,
                                    backgroundColor: item.media <= 2 ? "#ef4444" : item.media <= 3 ? "#eab308" : "#22c55e"
                                  }} />
                              </div>
                              <span className="text-sm font-bold w-8 text-right">{item.media}</span>
                              <span className="text-lg">{emoji}</span>
                              <span className="text-xs text-muted-foreground w-16 text-right">{item.avaliacoes} aval.</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Munícipes */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Top 15 Munícipes por Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {topMunicipes.length === 0 ? <EmptyState msg="Sem dados" /> : (
                    <div className="space-y-2.5">
                      {topMunicipes.map((m: any, i: number) => {
                        const emoji = m.humorMedio === null ? "" :
                          m.humorMedio <= 1.5 ? "😡" : m.humorMedio <= 2.5 ? "😞" :
                          m.humorMedio <= 3.5 ? "😐" : m.humorMedio <= 4.5 ? "😊" : "😍";
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="font-medium">{m.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="text-sm">{m.total} demandas</Badge>
                              {emoji && (
                                <span className="text-lg" title={`Humor: ${m.humorMedio}`}>{emoji}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
