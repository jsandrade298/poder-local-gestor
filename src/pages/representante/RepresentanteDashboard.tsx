import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRepresentanteDashboardData, type RecentesDias } from "@/hooks/useRepresentanteDashboardData";
import { KPICard } from "@/components/dashboard/KPICard";
import { HumorometroCard } from "@/components/dashboard/HumorometroCard";
import { FunilStatusChart } from "@/components/dashboard/FunilStatusChart";
import { Top5AreasChart } from "@/components/dashboard/Top5AreasChart";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Users, Clock, TrendingUp, AlertTriangle,
  ArrowRight, Cake, Sparkles, Phone, BarChart3,
} from "lucide-react";
import { formatDateOnly } from "@/lib/dateUtils";

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "#ef4444" },
  alta:    { label: "Alta",    color: "#f97316" },
  media:   { label: "Média",   color: "#eab308" },
  baixa:   { label: "Baixa",   color: "#22c55e" },
};

export default function RepresentanteDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const {
    kpis, humor, charts, recentes, aniversariantes,
    recentesDias, setRecentesDias,
    isLoading, getStatusLabel, getStatusColor,
  } = useRepresentanteDashboardData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-0 py-0 md:container md:mx-auto space-y-4 md:space-y-6 max-w-[1400px]">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Olá, {profile?.nome?.split(" ")[0] || "Representante"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral das suas demandas e munícipes
          </p>
        </div>
        <div className="flex gap-2">
          <NovoMunicipeDialog />
          <NovaDemandaDialog />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard title="Total Demandas"   value={kpis.totalDemandas}    icon={FileText}       description="Cadastradas" />
        <KPICard title="Abertas"          value={kpis.demandasAbertas}  icon={Clock}          description="Aguardando resolução" />
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

      {/* Demandas recentes + Aniversariantes */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Demandas recentes */}
        <div className="xl:col-span-2">
          <Card className="border border-border/50 shadow-sm flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Demandas Recentes
                </CardTitle>
                <div className="flex items-center gap-1 flex-wrap">
                  {([7, 15, 30] as RecentesDias[]).map((dias) => (
                    <button
                      key={dias}
                      onClick={() => setRecentesDias(dias)}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        recentesDias === dias
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {dias}d
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => navigate("/rep/demandas")} className="text-xs h-7 ml-1">
                    Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <div className="overflow-y-auto max-h-72 px-6 pb-4">
                {recentes.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhuma demanda nos últimos {recentesDias} dias.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentes.map((demanda) => (
                      <div
                        key={demanda.id}
                        onClick={() => navigate(`/rep/demandas?protocolo=${demanda.protocolo}`)}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getStatusColor(demanda.status || "") }} />
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

        {/* Aniversariantes */}
        <Card className="border border-border/50 shadow-sm flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" />
              Aniversariantes de Hoje
              {aniversariantes.length > 0 && (
                <Badge className="bg-pink-100 text-pink-700 border-0 text-xs">
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
                    const nascimento = m.data_nascimento ? new Date(m.data_nascimento + "T00:00:00") : null;
                    const idade = nascimento ? new Date().getFullYear() - nascimento.getFullYear() : null;
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-pink-600">
                            {m.nome?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.nome}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {idade && <span>🎂 {idade} anos</span>}
                            {m.telefone && (
                              <span className="flex items-center gap-0.5">
                                <Phone className="h-3 w-3" />{m.telefone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil + Humorômetro */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunilStatusChart data={charts.funilData} total={kpis.totalDemandas} />
        <HumorometroCard
          emoji={humor.emoji}
          media={humor.media}
          mediaSlug={humor.mediaSlug}
          total={humor.total}
          distribuicao={humor.distribuicao}
        />
      </div>

      {/* Prioridades + Top 5 Áreas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Prioridades */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Demandas por Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {charts.prioridadeData.every((p) => p.value === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma demanda cadastrada</p>
            ) : (
              charts.prioridadeData.map((p) => {
                const cfg = PRIORIDADE_CONFIG[p.slug];
                const pct = kpis.totalDemandas > 0 ? Math.round((p.value / kpis.totalDemandas) * 100) : 0;
                return (
                  <div key={p.slug} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium" style={{ color: cfg?.color }}>{cfg?.label || p.slug}</span>
                      <span className="text-muted-foreground">{p.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: cfg?.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Top 5 Áreas */}
        <Top5AreasChart
          data={charts.top5Areas}
          statuses={charts.uniqueStatuses as string[]}
          getStatusLabel={getStatusLabel}
          getStatusColor={getStatusColor}
        />
      </div>

    </div>
  );
}
