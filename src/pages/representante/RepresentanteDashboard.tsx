import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { Users, FileText, Clock, CheckCircle2, ArrowRight, MapPin, Phone } from "lucide-react";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateOnly } from "@/lib/dateUtils";

export default function RepresentanteDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { getStatusLabel, getStatusColor } = useDemandaStatus();

  // KPIs — RLS filtra automaticamente para o representante
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["rep-kpis"],
    queryFn: async () => {
      const [{ count: totalMunicipes }, { count: totalDemandas }, { count: abertas }, { count: resolvidas }] =
        await Promise.all([
          supabase.from("municipes").select("*", { count: "exact", head: true }),
          supabase.from("demandas").select("*", { count: "exact", head: true }),
          supabase.from("demandas").select("*", { count: "exact", head: true }).in("status", ["solicitada", "em_andamento", "aguardando"]),
          supabase.from("demandas").select("*", { count: "exact", head: true }).in("status", ["resolvida", "concluida", "concluída"]),
        ]);
      return { totalMunicipes, totalDemandas, abertas, resolvidas };
    },
  });

  // Demandas recentes
  const { data: demandasRecentes = [] } = useQuery({
    queryKey: ["rep-demandas-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, criado_em, municipes(nome)")
        .order("criado_em", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Munícipes recentes
  const { data: municipesRecentes = [] } = useQuery({
    queryKey: ["rep-municipes-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("municipes")
        .select("id, nome, telefone, bairro, criado_em")
        .order("criado_em", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {profile?.nome?.split(" ")[0] || "Representante"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aqui está um resumo da sua atuação
          </p>
        </div>
        <div className="flex gap-2">
          <NovoMunicipeDialog />
          <NovaDemandaDialog />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Munícipes</p>
                <p className="text-2xl font-bold">{kpis?.totalMunicipes ?? "—"}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Demandas</p>
                <p className="text-2xl font-bold">{kpis?.totalDemandas ?? "—"}</p>
              </div>
              <FileText className="h-8 w-8 text-violet-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="text-2xl font-bold">{kpis?.abertas ?? "—"}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resolvidas</p>
                <p className="text-2xl font-bold">{kpis?.resolvidas ?? "—"}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listas recentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Demandas recentes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Demandas Recentes</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => navigate("/rep/demandas")}
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {demandasRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma demanda cadastrada ainda
              </p>
            ) : (
              demandasRecentes.map((d: any) => (
                <div key={d.id} className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {(d.municipes as any)?.nome} · {formatDateOnly(d.criado_em)}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Munícipes recentes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Munícipes Recentes</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => navigate("/rep/municipes")}
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {municipesRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum munícipe cadastrado ainda
              </p>
            ) : (
              municipesRecentes.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {m.nome?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {m.bairro && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {m.bairro}
                        </span>
                      )}
                      {m.telefone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {m.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
