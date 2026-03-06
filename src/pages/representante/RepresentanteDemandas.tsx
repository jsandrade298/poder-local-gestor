import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { formatDateOnly } from "@/lib/dateUtils";
import { Search, FileText, Eye, Edit, AlertTriangle, SlidersHorizontal, X, Plus, Inbox } from "lucide-react";

export default function RepresentanteDemandas() {
  const { user } = useAuth();
  const uid = user?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [prioridadeFilter, setPrioridadeFilter] = useState("todos");
  const [areaFilter, setAreaFilter] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { statusList } = useDemandaStatus();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ═══════════════════════════════════════════════════════════
  // FIX: Filtrar por representante_id = uid (profile.id do representante)
  // ═══════════════════════════════════════════════════════════
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["rep-demandas", uid, debounced, statusFilter, prioridadeFilter, areaFilter],
    enabled: !!uid,
    queryFn: async () => {
      let query = supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, prioridade, data_prazo, created_at, municipes(nome, bairro), areas(nome)")
        .eq("representante_id", uid!)
        .order("created_at", { ascending: false });

      if (debounced) query = query.ilike("titulo", `%${debounced}%`);
      if (statusFilter !== "todos") query = query.eq("status", statusFilter);
      if (prioridadeFilter !== "todos") query = query.eq("prioridade", prioridadeFilter);

      const { data } = await query;
      let result = data || [];
      if (areaFilter !== "todos") result = result.filter((d: any) => d.areas?.nome === areaFilter);
      return result;
    },
  });

  const areas = [...new Set(demandas.map((d: any) => d.areas?.nome).filter(Boolean))].sort();
  const activeFilters = [statusFilter !== "todos", prioridadeFilter !== "todos", areaFilter !== "todos"]
    .filter(Boolean).length;

  const isAtrasada = (d: any) =>
    d.data_prazo && new Date(d.data_prazo) < new Date() &&
    !["resolvida", "concluida", "concluída"].includes(d.status);

  const prioridadeCor: Record<string, string> = {
    baixa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    media: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    urgente: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

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
            {demandas.length} demanda{demandas.length !== 1 ? "s" : ""} vinculada{demandas.length !== 1 ? "s" : ""} a você
          </p>
        </div>
        <NovaDemandaDialog />
      </div>

      {/* Busca + filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}
          className="relative flex-shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as áreas</SelectItem>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {activeFilters > 0 && (
            <div className="sm:col-span-3 flex justify-end">
              <Button variant="ghost" size="sm" className="gap-1 text-xs"
                onClick={() => { setStatusFilter("todos"); setPrioridadeFilter("todos"); setAreaFilter("todos"); }}>
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : demandas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-medium mb-1">
              {debounced || activeFilters > 0 ? "Nenhuma demanda encontrada" : "Nenhuma demanda cadastrada ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {debounced || activeFilters > 0
                ? "Tente ajustar os filtros ou a busca"
                : "Comece cadastrando sua primeira demanda"}
            </p>
            {!debounced && activeFilters === 0 && <NovaDemandaDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {demandas.map((d: any) => (
            <Card key={d.id} className={`hover:shadow-md transition-all ${isAtrasada(d) ? "border-red-200 dark:border-red-900/50" : ""}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">#{d.protocolo}</span>
                      {isAtrasada(d) && (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />Atrasada
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
                      {d.areas?.nome && (
                        <span className="text-xs text-muted-foreground">{d.areas.nome}</span>
                      )}
                      {d.municipes?.nome && (
                        <span className="text-xs text-muted-foreground">· {d.municipes.nome}</span>
                      )}
                      {d.data_prazo && (
                        <span className={`text-xs ${isAtrasada(d) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          Prazo: {formatDateOnly(d.data_prazo)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button variant="outline" size="sm"
                      onClick={() => { setSelectedDemanda(d); setIsViewOpen(true); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => { setSelectedDemanda(d); setIsEditOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedDemanda && (
        <>
          <ViewDemandaDialog demanda={selectedDemanda} open={isViewOpen} onOpenChange={setIsViewOpen} />
          <EditDemandaDialog demanda={selectedDemanda} open={isEditOpen} onOpenChange={setIsEditOpen} />
        </>
      )}
    </div>
  );
}
