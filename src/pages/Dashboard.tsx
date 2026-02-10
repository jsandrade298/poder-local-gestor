import { KPICard } from "@/components/dashboard/KPICard";
import { StatusDonutChart } from "@/components/dashboard/StatusDonutChart";
import { Top5AreasChart } from "@/components/dashboard/Top5AreasChart";
import { ProjetosPlanilhasChart } from "@/components/dashboard/ProjetosPlanilhasChart";
import { HumorometroCard } from "@/components/dashboard/HumorometroCard";
import { OverdueList } from "@/components/dashboard/OverdueList";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import {
  FileText,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const {
    kpis,
    humor,
    charts,
    overdue,
    isLoading,
    getStatusLabel,
    getStatusColor,
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
          <NovaDemandaDialog />
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KPICard
            title="Total Demandas"
            value={kpis.totalDemandas}
            icon={FileText}
            description="Cadastradas"
          />
          <KPICard
            title="Abertas"
            value={kpis.demandasAbertas}
            icon={Clock}
            description="Aguardando resolução"
          />
          <KPICard
            title="Em Atraso"
            value={kpis.demandasEmAtraso}
            icon={AlertTriangle}
            description="Passaram do prazo"
            variant={kpis.demandasEmAtraso > 0 ? "destructive" : "default"}
          />
          <KPICard
            title="Taxa de Conclusão"
            value={`${kpis.taxaConclusao}%`}
            icon={TrendingUp}
            description="Demandas atendidas"
          />
          <KPICard
            title="Munícipes"
            value={kpis.totalMunicipes}
            icon={Users}
            description="Cadastrados"
          />
        </div>

        {/* ─── Row: Donut + Humorômetro ─── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <StatusDonutChart
              title="Demandas por Status"
              data={charts.demandasPorStatus}
              total={kpis.totalDemandas}
            />
          </div>
          <HumorometroCard
            emoji={humor.emoji}
            media={humor.media}
            mediaSlug={humor.mediaSlug}
            total={humor.total}
            distribuicao={humor.distribuicao}
          />
        </div>

        {/* ─── Row: Áreas + Projetos ─── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Top5AreasChart
            data={charts.top5Areas}
            statuses={charts.uniqueStatuses}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
          />
          <ProjetosPlanilhasChart data={charts.projetosPlanilhasStatus} />
        </div>

        {/* ─── Demandas em Atraso ─── */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Demandas em Atraso
                {overdue.demandasEmAtraso > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {overdue.demandasEmAtraso}
                  </Badge>
                )}
              </CardTitle>
              {overdue.demandasEmAtraso > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/demandas?atraso=overdue")}
                  className="text-xs text-destructive hover:text-destructive h-7"
                >
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Faixas 30/60/90 */}
            <div className="grid grid-cols-3 gap-3">
              <OverdueCard
                label="30+ dias"
                value={overdue.demandasAtraso30}
                severity="caution"
                onClick={() => navigate("/demandas?atraso=30")}
              />
              <OverdueCard
                label="60+ dias"
                value={overdue.demandasAtraso60}
                severity="warning"
                onClick={() => navigate("/demandas?atraso=60")}
              />
              <OverdueCard
                label="90+ dias"
                value={overdue.demandasAtraso90}
                severity="critical"
                onClick={() => navigate("/demandas?atraso=90")}
              />
            </div>

            {/* Lista detalhada */}
            {overdue.demandasEmAtraso > 0 ? (
              <OverdueList
                title="Demandas que passaram do prazo"
                demandas={overdue.demandasAtrasoDetalhadas}
              />
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

/* ─── OverdueCard sub-component ─── */
function OverdueCard({
  label,
  value,
  severity,
  onClick,
}: {
  label: string;
  value: number;
  severity: "caution" | "warning" | "critical";
  onClick: () => void;
}) {
  const styles = {
    caution: {
      bg: "bg-yellow-50 dark:bg-yellow-950/30",
      border: "border-yellow-200 dark:border-yellow-800/50",
      text: "text-yellow-700 dark:text-yellow-400",
      number: "text-yellow-600 dark:text-yellow-300",
    },
    warning: {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      border: "border-orange-200 dark:border-orange-800/50",
      text: "text-orange-700 dark:text-orange-400",
      number: "text-orange-600 dark:text-orange-300",
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800/50",
      text: "text-red-700 dark:text-red-400",
      number: "text-red-600 dark:text-red-300",
    },
  };
  const s = styles[severity];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-3 text-center transition-all hover:shadow-md hover:scale-[1.02] ${s.bg} ${s.border}`}
    >
      <div className={`text-2xl font-bold tabular-nums ${s.number}`}>
        {value}
      </div>
      <div className={`text-xs font-medium mt-0.5 ${s.text}`}>{label}</div>
    </div>
  );
}
