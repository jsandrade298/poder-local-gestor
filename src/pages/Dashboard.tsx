import { KPICard } from "@/components/dashboard/KPICard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { AreaChart } from "@/components/dashboard/AreaChart";
import { AgingList } from "@/components/dashboard/AgingList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Users, Clock, TrendingUp, Plus, Filter } from "lucide-react";

// Dados mockados - substituir pela integração com Supabase
const demandas30Dias = [
  { id: "1", titulo: "Reparo de buraco na Rua das Flores", area: "Infraestrutura", responsavel: "João Silva", diasVencido: 35 },
  { id: "2", titulo: "Melhoria na iluminação da praça", area: "Infraestrutura", responsavel: "Maria Santos", diasVencido: 38 },
];

const demandas60Dias = [
  { id: "3", titulo: "Solicitação de novo semáforo", area: "Trânsito", responsavel: "Carlos Lima", diasVencido: 65 },
];

const demandas90Dias = [
  { id: "4", titulo: "Reforma da escola municipal", area: "Educação", responsavel: "Ana Costa", diasVencido: 95 },
];

export default function Dashboard() {
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
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button size="sm" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nova Demanda
            </Button>
          </div>
        </div>

        {/* Filtros Globais */}
        <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros Globais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Filtrar por Bairro
                </label>
                <Select>
                  <SelectTrigger className="h-11">
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
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Filtrar por Responsável
                </label>
                <Select>
                  <SelectTrigger className="h-11">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total de Demandas"
          value="248"
          icon={FileText}
          trend={{ value: "+12%", isPositive: true }}
          description="Todas as demandas cadastradas"
        />
        <KPICard
          title="Demandas Ativas"
          value="156"
          icon={Clock}
          trend={{ value: "+8%", isPositive: true }}
          description="Em andamento ou solicitadas"
        />
        <KPICard
          title="Munícipes Cadastrados"
          value="1.247"
          icon={Users}
          trend={{ value: "+24", isPositive: true }}
          description="Base de dados atualizada"
        />
        <KPICard
          title="Taxa de Conclusão"
          value="68%"
          icon={TrendingUp}
          trend={{ value: "+5%", isPositive: true }}
          description="Demandas concluídas no mês"
        />
      </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <StatusChart />
          <AreaChart />
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
              demandas={demandas30Dias}
            />
            <AgingList
              title="Mais de 60 dias"
              days={60}
              demandas={demandas60Dias}
            />
            <AgingList
              title="Mais de 90 dias"
              days={90}
              demandas={demandas90Dias}
            />
          </div>
        </div>
      </div>
    </div>
  );
}