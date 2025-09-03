import { KPICard } from "@/components/dashboard/KPICard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { AreaChart } from "@/components/dashboard/AreaChart";
import { AgingList } from "@/components/dashboard/AgingList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Users, Clock, TrendingUp, Plus, Filter } from "lucide-react";
import { useDemandas } from "@/hooks/useDemandas";
import { useMunicipes } from "@/hooks/useMunicipes";
import { useState } from "react";

export default function Dashboard() {
  const { demandas, loading, getDemandasPorStatus, getDemandasPorArea, getDemandasEnvelhecimento } = useDemandas();
  const { municipes } = useMunicipes();
  const [bairroFilter, setBairroFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const statusData = getDemandasPorStatus();
  const areaData = getDemandasPorArea();
  const { demandas30, demandas60, demandas90 } = getDemandasEnvelhecimento();
  
  // Calcular KPIs
  const totalDemandas = demandas.length;
  const demandasAtivas = demandas.filter(d => ['solicitado', 'em_andamento'].includes(d.status)).length;
  const totalMunicipes = municipes.length;
  const taxaConclusao = totalDemandas > 0 ? Math.round((demandas.filter(d => d.status === 'concluido').length / totalDemandas) * 100) : 0;
  return (
    <div className="space-y-6">
      {/* Header da Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Visão Geral do Gabinete
          </h1>
          <p className="text-muted-foreground">
            Acompanhe as principais métricas e demandas em tempo real
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Demanda
          </Button>
        </div>
      </div>

      {/* Filtros Globais */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filtros Globais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Filtrar por Bairro
              </label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os bairros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="centro">Centro</SelectItem>
                  <SelectItem value="vila-nova">Vila Nova</SelectItem>
                  <SelectItem value="jardim-america">Jardim América</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Filtrar por Responsável
              </label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="joao">João Silva</SelectItem>
                  <SelectItem value="maria">Maria Santos</SelectItem>
                  <SelectItem value="carlos">Carlos Lima</SelectItem>
                  <SelectItem value="ana">Ana Costa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de Demandas"
          value={totalDemandas.toString()}
          icon={FileText}
          trend={{ value: "+12%", isPositive: true }}
          description="Todas as demandas cadastradas"
        />
        <KPICard
          title="Demandas Ativas"
          value={demandasAtivas.toString()}
          icon={Clock}
          trend={{ value: "+8%", isPositive: true }}
          description="Em andamento ou solicitadas"
        />
        <KPICard
          title="Munícipes Cadastrados"
          value={totalMunicipes.toString()}
          icon={Users}
          trend={{ value: "+24", isPositive: true }}
          description="Base de dados atualizada"
        />
        <KPICard
          title="Taxa de Conclusão"
          value={`${taxaConclusao}%`}
          icon={TrendingUp}
          trend={{ value: "+5%", isPositive: true }}
          description="Demandas concluídas no total"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusChart data={statusData} />
        <AreaChart data={areaData} />
      </div>

      {/* Listas de Envelhecimento */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Demandas por Tempo de Criação
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AgingList
            title="Mais de 30 dias"
            days={30}
            demandas={demandas30}
          />
          <AgingList
            title="Mais de 60 dias"
            days={60}
            demandas={demandas60}
          />
          <AgingList
            title="Mais de 90 dias"
            days={90}
            demandas={demandas90}
          />
        </div>
      </div>
    </div>
  );
}