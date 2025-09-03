import { KPICard } from "@/components/dashboard/KPICard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { AreaChart } from "@/components/dashboard/AreaChart";
import { AgingList } from "@/components/dashboard/AgingList";
import { OverdueList } from "@/components/dashboard/OverdueList";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { FileText, Users, Clock, TrendingUp, Play, Pause, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { metrics, charts, aging, overdue, isLoading } = useDashboardData();
  const navigate = useNavigate();

  const handleOverdueClick = (filter: string) => {
    if (filter === 'all') {
      navigate(`/demandas?atraso=overdue`);
    } else {
      navigate(`/demandas?atraso=${filter}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Header da Dashboard */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Visão Geral do Gabinete
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              Acompanhe as principais métricas e demandas em tempo real
            </p>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <NovaDemandaDialog />
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6">
          <KPICard
            title="Total de Demandas"
            value={metrics.totalDemandas}
            icon={FileText}
            description="Todas as demandas cadastradas"
          />
          <KPICard
            title="Demandas Abertas"
            value={metrics.demandasAbertas}
            icon={Clock}
            description="Aguardando atendimento"
          />
          <KPICard
            title="Em Andamento"
            value={metrics.demandasEmAndamento}
            icon={Play}
            description="Sendo atendidas"
          />
          <KPICard
            title="Aguardando"
            value={metrics.demandasAguardando}
            icon={Pause}
            description="Pendentes"
          />
          <KPICard
            title="Resolvidas"
            value={metrics.demandasResolvidas}
            icon={CheckCircle}
            description="Concluídas"
          />
          <KPICard
            title="Canceladas"
            value={metrics.demandasCanceladas}
            icon={XCircle}
            description="Canceladas"
          />
        </div>

        {/* Métricas Secundárias */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <KPICard
            title="Munícipes Cadastrados"
            value={metrics.totalMunicipes}
            icon={Users}
            description="Base de dados atualizada"
          />
          <KPICard
            title="Taxa de Conclusão"
            value={metrics.taxaConclusao}
            icon={TrendingUp}
            description="Demandas concluídas no período"
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <StatusChart data={charts.statusData} />
          <AreaChart data={charts.areaChartData} />
        </div>

        {/* Demandas em Atraso */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">
              Demandas em Atraso
            </h2>
          </div>
          <OverdueList 
            title="Demandas que passaram do prazo"
            demandas={overdue.demandasAtrasoDetalhadas}
          />
        </div>

        {/* Listas de Envelhecimento */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              Demandas por Tempo de Criação
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <AgingList
              title="Mais de 30 dias"
              days={30}
              demandas={aging.demandas30Dias}
            />
            <AgingList
              title="Mais de 60 dias"
              days={60}
              demandas={aging.demandas60Dias}
            />
            <AgingList
              title="Mais de 90 dias"
              days={90}
              demandas={aging.demandas90Dias}
            />
          </div>
          
          {/* Cards de Demandas em Atraso por Tempo */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div onClick={() => handleOverdueClick('30')} className="cursor-pointer">
              <KPICard
                title="Mais de 30 dias em atraso"
                value={metrics.demandasAtraso30}
                icon={Clock}
                description="Em atraso há mais de 30 dias"
                variant="warning"
              />
            </div>
            <div onClick={() => handleOverdueClick('60')} className="cursor-pointer">
              <KPICard
                title="Mais de 60 dias em atraso"
                value={metrics.demandasAtraso60}
                icon={Clock}
                description="Em atraso há mais de 60 dias"
                variant="destructive"
              />
            </div>
            <div onClick={() => handleOverdueClick('90')} className="cursor-pointer">
              <KPICard
                title="Mais de 90 dias em atraso"
                value={metrics.demandasAtraso90}
                icon={Clock}
                description="Em atraso há mais de 90 dias"
                variant="destructive"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}