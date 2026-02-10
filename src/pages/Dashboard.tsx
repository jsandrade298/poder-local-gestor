import { KPICard } from "@/components/dashboard/KPICard";
import { StatusDonutChart } from "@/components/dashboard/StatusDonutChart";
import { Top5AreasChart } from "@/components/dashboard/Top5AreasChart";
import { PlanosStatusChart } from "@/components/dashboard/PlanosStatusChart";
import { ProjetosPlanilhasChart } from "@/components/dashboard/ProjetosPlanilhasChart";
import { OverdueList } from "@/components/dashboard/OverdueList";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import {
  FileText,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  ClipboardList,
  FolderKanban,
  Table2,
  ListTodo,
  Plus,
  ArrowRight,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { kpis, charts, overdue, isLoading, getStatusLabel, getStatusColor } =
    useDashboardData();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* ─── Header ─── */}
        <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Visão Geral do Gabinete
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe as principais métricas e demandas em tempo real
            </p>
          </div>
          <div className="flex gap-2">
            <NovaDemandaDialog />
          </div>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KPICard
            title="Total Demandas"
            value={kpis.totalDemandas}
            icon={FileText}
            description="Cadastradas no sistema"
          />
          <KPICard
            title="Demandas Abertas"
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
            title="Planos de Ação"
            value={kpis.totalPlanosAcao}
            icon={ClipboardList}
            description={`${kpis.planosConcluidos} concluídos`}
          />
          <KPICard
            title="Munícipes"
            value={kpis.totalMunicipes}
            icon={Users}
            description="Cadastrados"
          />
        </div>

        {/* ─── Charts Row 1: Demandas ─── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <StatusDonutChart
            title="Demandas por Status"
            data={charts.demandasPorStatus}
            total={kpis.totalDemandas}
          />
          <Top5AreasChart
            data={charts.top5Areas}
            statuses={charts.uniqueStatuses}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
          />
        </div>

        {/* ─── Charts Row 2: Planos & Projetos ─── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PlanosStatusChart data={charts.planosPorStatus} />
          <ProjetosPlanilhasChart data={charts.projetosPlanilhasStatus} />
        </div>

        {/* ─── Demandas em Atraso ─── */}
        {overdue.demandasEmAtraso > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="text-lg font-semibold text-foreground">
                  Demandas em Atraso
                </h2>
                <Badge variant="destructive" className="ml-2">
                  {overdue.demandasEmAtraso}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/demandas?atraso=overdue")}
                className="text-destructive hover:text-destructive"
              >
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {/* Faixas de atraso */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div
                onClick={() => navigate("/demandas?atraso=30")}
                className="cursor-pointer"
              >
                <KPICard
                  title="Mais de 30 dias"
                  value={overdue.demandasAtraso30}
                  icon={Clock}
                  description="em atraso"
                  variant="caution"
                />
              </div>
              <div
                onClick={() => navigate("/demandas?atraso=60")}
                className="cursor-pointer"
              >
                <KPICard
                  title="Mais de 60 dias"
                  value={overdue.demandasAtraso60}
                  icon={Clock}
                  description="em atraso"
                  variant="warning"
                />
              </div>
              <div
                onClick={() => navigate("/demandas?atraso=90")}
                className="cursor-pointer"
              >
                <KPICard
                  title="Mais de 90 dias"
                  value={overdue.demandasAtraso90}
                  icon={Clock}
                  description="em atraso"
                  variant="destructive"
                />
              </div>
            </div>

            {/* Lista detalhada */}
            <OverdueList
              title="Demandas que passaram do prazo"
              demandas={overdue.demandasAtrasoDetalhadas}
            />
          </div>
        )}

        {/* ─── Atalhos Rápidos ─── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Acesso Rápido
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <QuickLink
              icon={Plus}
              label="Nova Demanda"
              description="Registrar demanda"
              onClick={() => {/* NovaDemandaDialog handles this */}}
              isDialog
            />
            <QuickLink
              icon={FolderKanban}
              label="Kanban"
              description="Visualizar quadro"
              onClick={() => navigate("/kanban")}
            />
            <QuickLink
              icon={ListTodo}
              label="Plano de Ação"
              description="Gerenciar ações"
              onClick={() => navigate("/plano-acao")}
            />
            <QuickLink
              icon={Users}
              label="Munícipes"
              description="Base de dados"
              onClick={() => navigate("/municipes")}
            />
            <QuickLink
              icon={Table2}
              label="Demandas"
              description="Lista completa"
              onClick={() => navigate("/demandas")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  description,
  onClick,
  isDialog,
}: {
  icon: any;
  label: string;
  description: string;
  onClick: () => void;
  isDialog?: boolean;
}) {
  if (isDialog) return null; // Nova Demanda is handled by the header dialog

  return (
    <Card
      className="group cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 border-border/50"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {label}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
