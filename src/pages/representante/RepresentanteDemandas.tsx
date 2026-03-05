import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { formatDateOnly } from "@/lib/dateUtils";
import { Search, FileText, Eye, Edit, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RepresentanteDemandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { statusList } = useDemandaStatus();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["rep-demandas", debounced, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, prioridade, data_prazo, criado_em, municipes(nome, bairro)")
        .order("criado_em", { ascending: false });

      if (debounced) {
        query = query.ilike("titulo", `%${debounced}%`);
      }
      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const prioridadeCor: Record<string, string> = {
    baixa: "bg-green-100 text-green-700",
    media: "bg-blue-100 text-blue-700",
    alta: "bg-orange-100 text-orange-700",
    urgente: "bg-red-100 text-red-700",
  };

  const isAtrasada = (d: any) =>
    d.data_prazo && new Date(d.data_prazo) < new Date() && !["resolvida", "concluida", "concluída"].includes(d.status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Minhas Demandas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {demandas.length} demanda{demandas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NovaDemandaDialog />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusList.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                  {s.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : demandas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {debounced || statusFilter !== "todos"
                ? "Nenhuma demanda encontrada para este filtro"
                : "Nenhuma demanda cadastrada ainda"}
            </p>
            {!debounced && statusFilter === "todos" && (
              <div className="mt-4">
                <NovaDemandaDialog />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {demandas.map((d: any) => (
            <Card key={d.id} className={`hover:shadow-md transition-shadow ${isAtrasada(d) ? "border-red-200" : ""}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">#{d.protocolo}</span>
                      {isAtrasada(d) && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Atrasada
                        </span>
                      )}
                    </div>
                    <p className="font-semibold truncate mt-0.5">{d.titulo}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <StatusBadge status={d.status} />
                      {d.prioridade && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${prioridadeCor[d.prioridade] || ""}`}>
                          {d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1)}
                        </span>
                      )}
                      {(d.municipes as any)?.nome && (
                        <span className="text-xs text-muted-foreground truncate">
                          {(d.municipes as any).nome}
                        </span>
                      )}
                      {d.data_prazo && (
                        <span className={`text-xs ${isAtrasada(d) ? "text-red-600" : "text-muted-foreground"}`}>
                          Prazo: {formatDateOnly(d.data_prazo)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDemanda(d);
                        setIsViewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDemanda(d);
                        setIsEditOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {selectedDemanda && (
        <>
          <ViewDemandaDialog
            demanda={selectedDemanda}
            open={isViewOpen}
            onOpenChange={setIsViewOpen}
          />
          <EditDemandaDialog
            demanda={selectedDemanda}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
          />
        </>
      )}
    </div>
  );
}
