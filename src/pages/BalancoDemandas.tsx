import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, TrendingUp, Clock, AlertTriangle, Smile, Target,
  Download, ArrowLeft, Printer, Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { useBalancoData, BalancoFilters } from "@/hooks/useBalancoData";

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#2563eb",
];

export default function BalancoDemandas() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<BalancoFilters>({
    dateFrom: "",
    dateTo: "",
    areaId: "all",
    responsavelId: "all",
    cidadeFilter: "all",
  });

  const {
    isLoading, areas, responsaveis, cidades, statusList,
    getStatusLabel, getStatusColor,
    kpis, origemData, evolucaoData, bairroData, areaStatusData,
    responsavelData, prioridadeData, prioridadeStatusData,
    humorEvolucaoData, humorAreaData, atrasoDistribuicao,
    atrasoPorArea, funilData, topMunicipes, humorOrigemData,
    csvData, demandas,
  } = useBalancoData(filters);

  // ===== Export CSV =====
  const exportCSV = () => {
    if (csvData.length === 0) return;
    const headers = Object.keys(csvData[0]);
    const rows = csvData.map((row: any) =>
      headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balanco-demandas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Export PDF (print) =====
  const exportPDF = () => {
    window.print();
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", areaId: "all", responsavelId: "all", cidadeFilter: "all" });
  };

  // ===== Custom Tooltip =====
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{d.name}</p>
        <p style={{ color: d.payload.fill || d.payload.color }}>
          {d.value} ({((d.value / (d.payload.total || kpis.total)) * 100).toFixed(1)}%)
        </p>
      </div>
    );
  };

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
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #balanco-print, #balanco-print * { visibility: visible; }
          #balanco-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          @page { margin: 1cm; size: A4 landscape; }
        }
      `}</style>

      <div id="balanco-print" ref={printRef} className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/demandas")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Balanço de Demandas</h1>
              <p className="text-sm text-muted-foreground">
                Análise completa • {demandas.length} demandas
                {filters.dateFrom && ` • De ${new Date(filters.dateFrom).toLocaleDateString("pt-BR")}`}
                {filters.dateTo && ` até ${new Date(filters.dateTo).toLocaleDateString("pt-BR")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Printer className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">Balanço de Demandas</h1>
          <p className="text-sm text-gray-500">
            {demandas.length} demandas • Gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* ===== FILTROS GLOBAIS ===== */}
        <Card className="no-print border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros Globais
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    <SelectItem value="all">Todas as áreas</SelectItem>
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

        {/* ===== KPIs ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold">{kpis.total}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Conclusão</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{kpis.taxaConclusao}%</p>
              <p className="text-xs text-muted-foreground">{kpis.atendidas} atendidas</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-cyan-500" />
                <span className="text-xs font-medium text-muted-foreground">Tempo Médio</span>
              </div>
              <p className="text-2xl font-bold">{kpis.tempoMedio}d</p>
              <p className="text-xs text-muted-foreground">resolução</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Em Atraso</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{kpis.emAtraso}</p>
              <p className="text-xs text-muted-foreground">{kpis.percAtraso}% do total</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Smile className="h-4 w-4 text-yellow-500" />
                <span className="text-xs font-medium text-muted-foreground">Humor</span>
              </div>
              <p className="text-2xl font-bold">{kpis.humorEmoji} {kpis.humorMedio || "—"}</p>
              <p className="text-xs text-muted-foreground">{kpis.totalComHumor} avaliações</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-muted-foreground">Top Origem</span>
              </div>
              <p className="text-lg font-bold truncate">{kpis.origemMaisFreq}</p>
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 1: Origem + Evolução ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Origem (donut) */}
          <Card className="xl:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📊 Distribuição por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              {origemData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum dado de origem</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={220}>
                    <PieChart>
                      <Pie data={origemData} dataKey="value" cx="50%" cy="50%"
                        innerRadius={50} outerRadius={90} paddingAngle={2} strokeWidth={0}>
                        {origemData.map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 max-h-[220px] overflow-y-auto">
                    {origemData.map((item: any, i: number) => (
                      <div key={item.slug} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-semibold ml-2">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evolução temporal */}
          <Card className="xl:col-span-3 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📈 Evolução Temporal (mensal)</CardTitle>
            </CardHeader>
            <CardContent>
              {evolucaoData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados temporais</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={evolucaoData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={35} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    {statusList.map((s, i) => (
                      <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a"
                        fill={s.cor} radius={i === statusList.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 2: Bairro + Área ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Bairro */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">🗺️ Top 15 Bairros</CardTitle>
            </CardHeader>
            <CardContent>
              {bairroData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de bairro</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, bairroData.length * 28)}>
                  <BarChart data={bairroData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Demandas" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Área × Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">🏢 Demandas por Área × Status</CardTitle>
            </CardHeader>
            <CardContent>
              {areaStatusData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, areaStatusData.length * 32)}>
                  <BarChart data={areaStatusData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    {statusList.map((s) => (
                      <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 3: Responsável + Prioridade ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-break">
          {/* Responsável */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">👥 Desempenho por Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              {responsavelData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {responsavelData.map((r: any) => (
                    <div key={r.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[180px]">{r.name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{r.total} total</span>
                          <span className="text-green-600">{r.atendidas} atendidas</span>
                          <Badge variant="outline" className="text-xs">{r.taxa}%</Badge>
                          {r.tempoMedio > 0 && <span>{r.tempoMedio}d médio</span>}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${r.taxa}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prioridade × Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">⚡ Prioridade × Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donut prioridade */}
                <div>
                  {prioridadeData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">Sem dados</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={prioridadeData} dataKey="value" cx="50%" cy="50%"
                            innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                            {prioridadeData.map((entry: any) => (
                              <Cell key={entry.slug} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-4 mt-2">
                        {prioridadeData.map((p: any) => (
                          <div key={p.slug} className="flex items-center gap-1 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{p.name}: {p.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Stacked bars */}
                <div>
                  {prioridadeStatusData.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={prioridadeStatusData} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} width={30} />
                        <Tooltip content={<CustomTooltip />} />
                        {statusList.map((s) => (
                          <Bar key={s.slug} dataKey={s.slug} name={s.nome} stackId="a" fill={s.cor} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 4: Humor ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Humor evolução */}
          <Card className="xl:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">😊 Evolução do Humor ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              {humorEvolucaoData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de humor</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={humorEvolucaoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} width={30} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left" type="monotone" dataKey="media" name="Humor Médio"
                      stroke="#eab308" strokeWidth={2.5} dot={{ fill: "#eab308", r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="avaliacoes" name="Nº Avaliações"
                      stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 5"
                      dot={{ fill: "#8b5cf6", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Humor × Área */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">😊 Humor por Área</CardTitle>
            </CardHeader>
            <CardContent>
              {humorAreaData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-2.5">
                  {humorAreaData.map((item: any) => {
                    const emoji = item.media <= 1.5 ? "😡" : item.media <= 2.5 ? "😞" : item.media <= 3.5 ? "😐" : item.media <= 4.5 ? "😊" : "😍";
                    return (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[140px]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${(item.media / 5) * 100}%`,
                                backgroundColor: item.media <= 2 ? "#ef4444" : item.media <= 3 ? "#eab308" : "#22c55e"
                              }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{item.media}</span>
                          <span>{emoji}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 5: Atrasos ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-break">
          {/* Distribuição de atraso */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">⏱️ Distribuição de Atrasos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={atrasoDistribuicao} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Demandas" radius={[4, 4, 0, 0]}>
                    {atrasoDistribuicao.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Atraso por área */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">⏱️ Atrasos por Área</CardTitle>
            </CardHeader>
            <CardContent>
              {atrasoPorArea.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum atraso por área</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, atrasoPorArea.length * 30)}>
                  <BarChart data={atrasoPorArea} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Em atraso" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 6: Funil + Top Munícipes ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Funil de Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">🔄 Funil de Status</CardTitle>
            </CardHeader>
            <CardContent>
              {funilData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const maxVal = Math.max(...funilData.map((f: any) => f.value), 1);
                    return funilData.map((item: any, i: number) => (
                      <div key={item.slug} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{item.value}</span>
                            <span className="text-xs text-muted-foreground">
                              ({kpis.total > 0 ? Math.round((item.value / kpis.total) * 100) : 0}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-6 bg-muted/50 rounded overflow-hidden"
                          style={{ width: `${Math.max((item.value / maxVal) * 100, 2)}%` }}>
                          <div className="h-full rounded transition-all"
                            style={{ backgroundColor: item.color, width: "100%", opacity: 0.8 }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Munícipes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📋 Top 10 Munícipes</CardTitle>
            </CardHeader>
            <CardContent>
              {topMunicipes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {topMunicipes.map((m: any, i: number) => {
                    const emoji = m.humorMedio === null ? "" :
                      m.humorMedio <= 1.5 ? "😡" : m.humorMedio <= 2.5 ? "😞" :
                      m.humorMedio <= 3.5 ? "😐" : m.humorMedio <= 4.5 ? "😊" : "😍";
                    return (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="font-medium truncate max-w-[200px]">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">{m.total} demandas</Badge>
                          {emoji && <span title={`Humor: ${m.humorMedio}`}>{emoji}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 7: Humor × Origem ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">😊 Humor × Origem</CardTitle>
            </CardHeader>
            <CardContent>
              {humorOrigemData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, humorOrigemData.length * 32)}>
                  <BarChart data={humorOrigemData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="media" name="Humor Médio" radius={[0, 4, 4, 0]}>
                      {humorOrigemData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.media <= 2 ? "#ef4444" : entry.media <= 3 ? "#eab308" : "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Resumo textual */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📊 Resumo do Balanço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="font-medium text-blue-800 dark:text-blue-300">Volume</p>
                  <p className="text-blue-700 dark:text-blue-400">
                    {kpis.total} demandas no período, com {kpis.atendidas} atendidas ({kpis.taxaConclusao}% de conclusão).
                  </p>
                </div>
                {kpis.emAtraso > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="font-medium text-red-800 dark:text-red-300">Atenção</p>
                    <p className="text-red-700 dark:text-red-400">
                      {kpis.emAtraso} demandas em atraso ({kpis.percAtraso}% do total).
                      {atrasoPorArea.length > 0 && ` A área "${atrasoPorArea[0]?.name}" concentra mais atrasos.`}
                    </p>
                  </div>
                )}
                {kpis.tempoMedio > 0 && (
                  <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg">
                    <p className="font-medium text-cyan-800 dark:text-cyan-300">Eficiência</p>
                    <p className="text-cyan-700 dark:text-cyan-400">
                      Tempo médio de resolução: {kpis.tempoMedio} dias.
                      {responsavelData.length > 0 && ` O responsável mais eficiente é "${responsavelData.reduce((a: any, b: any) => (a.tempoMedio > 0 && a.tempoMedio < (b.tempoMedio || Infinity)) ? a : b)?.name}".`}
                    </p>
                  </div>
                )}
                {kpis.totalComHumor > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">Satisfação</p>
                    <p className="text-yellow-700 dark:text-yellow-400">
                      Humor médio: {kpis.humorEmoji} {kpis.humorMedio}/5 com base em {kpis.totalComHumor} avaliações.
                      Principal canal: {kpis.origemMaisFreq}.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
