import { Top5AreasChart } from "@/components/dashboard/Top5AreasChart";
import { ProjetosPlanilhasChart } from "@/components/dashboard/ProjetosPlanilhasChart";
import { HumorometroCard } from "@/components/dashboard/HumorometroCard";
import { OverdueList } from "@/components/dashboard/OverdueList";
import { FunilStatusChart } from "@/components/dashboard/FunilStatusChart";
import { KPICard } from "@/components/dashboard/KPICard";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import {
  FileText, Users, Clock, TrendingUp, AlertTriangle, ArrowRight,
  Cake, CalendarDays, Sparkles, Phone,
} from "lucide-react";
import { useDashboardData, type RecentesDias } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateOnly } from "@/lib/dateUtils";

export default function Dashboard() {
  const {
    kpis, humor, charts, overdue, recentes, aniversariantes,
    recentesDias, setRecentesDias,
    isLoading, getStatusLabel, getStatusColor,
  } = useDashboardData();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-[1400px]">

        {/* ─── Header ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Visão Geral do Gabinete
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Métricas e demandas em tempo real
            </p>
          </div>
          <div className="flex gap-2">
            <NovoMunicipeDialog />
            <NovaDemandaDialog />
          </div>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KPICard title="Total Demandas" value={kpis.totalDemandas} icon={FileText} description="Cadastradas" />
          <KPICard title="Abertas" value={kpis.demandasAbertas} icon={Clock} description="Aguardando resolução" />
          <KPICard
            title="Em Atraso" value={kpis.demandasEmAtraso} icon={AlertTriangle}
            description="Passaram do prazo"
            variant={kpis.demandasEmAtraso > 0 ? "destructive" : "default"}
          />
          <KPICard
            title="Taxa de Conclusão" value={`${kpis.taxaConclusao}%`} icon={TrendingUp}
            description="Demandas concluídas"
          />
          <KPICard title="Munícipes" value={kpis.totalMunicipes} icon={Users} description="Cadastrados" />
        </div>

        {/* ─── Row: Demandas Recentes + Aniversariantes ─── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

          {/* Demandas recentes */}
          <div className="xl:col-span-2">
            <Card className="border border-border/50 shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Demandas Recentes
                    {recentes.length > 0 && (
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {recentes.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {/* Seletor de período */}
                    {([7, 15, 30] as RecentesDias[]).map(dias => (
                      <button
                        key={dias}
                        onClick={() => setRecentesDias(dias)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                          recentesDias === dias
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {dias}d
                      </button>
                    ))}
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => navigate("/demandas")}
                      className="text-xs h-7 ml-1"
                    >
                      Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Área com scroll */}
              <CardContent className="flex-1 min-h-0 p-0">
                <div className="overflow-y-auto max-h-72 px-6 pb-4">
                  {recentes.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhuma demanda nos últimos {recentesDias} dias.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentes.map(demanda => (
                        <div
                          key={demanda.id}
                          onClick={() => navigate(`/demandas?protocolo=${demanda.protocolo}`)}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getStatusColor(demanda.status || "") }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                              {demanda.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {demanda.municipe} · {demanda.area}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4"
                              style={{
                                borderColor: getStatusColor(demanda.status || "") + "60",
                                color: getStatusColor(demanda.status || ""),
                              }}
                            >
                              {getStatusLabel(demanda.status || "")}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground hidden sm:block w-14 text-right">
                              {demanda.created_at ? formatDateOnly(demanda.created_at) : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aniversariantes do dia */}
          <Card className="border border-border/50 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cake className="h-4 w-4 text-pink-500" />
                Aniversariantes de Hoje
                {aniversariantes.length > 0 && (
                  <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-0 text-xs">
                    {aniversariantes.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <div className="overflow-y-auto max-h-72 px-6 pb-4">
                {aniversariantes.length === 0 ? (
                  <div className="text-center py-8">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Nenhum aniversariante hoje</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {aniversariantes.map((m: any) => {
                      const nascimento = m.data_nascimento
                        ? new Date(m.data_nascimento + "T00:00:00")
                        : null;
                      const idade = nascimento
                        ? new Date().getFullYear() - nascimento.getFullYear()
                        : null;
                      return (
                        <div
                          key={m.id}
                          onClick={() => navigate("/municipes")}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-950/20 cursor-pointer transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {m.nome?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                              {m.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {idade ? `${idade} anos` : ""}
                              {m.bairro ? ` · ${m.bairro}` : ""}
                            </p>
                          </div>
                          {m.telefone && (
                            <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Row: Funil + Humorômetro ─── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <FunilStatusChart data={charts.funilData} total={kpis.totalDemandas} />
          </div>
          <HumorometroCard
            emoji={humor.emoji} media={humor.media} mediaSlug={humor.mediaSlug}
            total={humor.total} distribuicao={humor.distribuicao}
          />
        </div>

        {/* ─── Row: Prioridades + Top 5 Áreas ─── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <PrioridadesCard data={charts.prioridadeData} total={kpis.totalDemandas} />
          <div className="xl:col-span-2">
            <Top5AreasChart
              data={charts.top5Areas}
              statuses={charts.uniqueStatuses}
              getStatusLabel={getStatusLabel}
              getStatusColor={getStatusColor}
            />
          </div>
        </div>

        {/* ─── Projetos & Planilhas ─── */}
        <ProjetosPlanilhasChart data={charts.projetosPlanilhasStatus} />

        {/* ─── Demandas em Atraso ─── */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Demandas em Atraso
                {overdue.demandasEmAtraso > 0 && (
                  <Badge variant="destructive" className="text-xs">{overdue.demandasEmAtraso}</Badge>
                )}
              </CardTitle>
              {overdue.demandasEmAtraso > 0 && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => navigate("/demandas?atraso=overdue")}
                  className="text-xs text-destructive hover:text-destructive h-7"
                >
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <OverdueCard label="30+ dias" value={overdue.demandasAtraso30} severity="caution"  onClick={() => navigate("/demandas?atraso=30")} />
              <OverdueCard label="60+ dias" value={overdue.demandasAtraso60} severity="warning"  onClick={() => navigate("/demandas?atraso=60")} />
              <OverdueCard label="90+ dias" value={overdue.demandasAtraso90} severity="critical" onClick={() => navigate("/demandas?atraso=90")} />
            </div>
            {overdue.demandasEmAtraso > 0 ? (
              <OverdueList title="Demandas que passaram do prazo" demandas={overdue.demandasAtrasoDetalhadas} />
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                🎉 Nenhuma demanda em atraso!
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

/* ─── Prioridades Card ────────────────────────────────────── */
function PrioridadesCard({
  data, total,
}: {
  data: Array<{ slug: string; label: string; color: string; value: number }>;
  total: number;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <Card className="border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Demandas por Prioridade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map(item => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const barPct = Math.round((item.value / maxValue) * 100);
          return (
            <div key={item.slug} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{item.value}</span>
                  <span className="w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barPct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma demanda cadastrada
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── OverdueCard ─────────────────────────────────────────── */
function OverdueCard({ label, value, severity, onClick }: {
  label: string; value: number; severity: "caution" | "warning" | "critical"; onClick: () => void;
}) {
  const styles = {
    caution:  { bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800/50", text: "text-yellow-700 dark:text-yellow-400", number: "text-yellow-600 dark:text-yellow-300" },
    warning:  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800/50", text: "text-orange-700 dark:text-orange-400", number: "text-orange-600 dark:text-orange-300" },
    critical: { bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800/50",       text: "text-red-700 dark:text-red-400",       number: "text-red-600 dark:text-red-300" },
  };
  const s = styles[severity];
  return (
    <div onClick={onClick} className={`cursor-pointer rounded-lg border p-3 text-center transition-all hover:shadow-md hover:scale-[1.02] ${s.bg} ${s.border}`}>
      <div className={`text-2xl font-bold tabular-nums ${s.number}`}>{value}</div>
      <div className={`text-xs font-medium mt-0.5 ${s.text}`}>{label}</div>
    </div>
  );
}
