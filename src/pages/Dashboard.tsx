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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusChart />
        <AreaChart />
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
  );
}