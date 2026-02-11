import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Route, MapPin, Calendar, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateOnly } from "@/lib/dateUtils";

interface AdicionarRotasKanbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser?: string;
}

export function AdicionarRotasKanbanDialog({
  open,
  onOpenChange,
  selectedUser,
}: AdicionarRotasKanbanDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usuarioFilter, setUsuarioFilter] = useState("all");
  const [selectedRotas, setSelectedRotas] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Buscar todas as rotas com pontos
  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ["rotas-kanban-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select(
          `
          *,
          rota_pontos(id)
        `
        )
        .order("data_programada", { ascending: false });

      if (error) {
        console.error("Erro ao buscar rotas:", error);
        throw error;
      }

      // Buscar nomes dos usuários
      const usuarioIds = [
        ...new Set((data || []).map((r: any) => r.usuario_id)),
      ];
      let profilesMap = new Map<string, string>();

      if (usuarioIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", usuarioIds);

        profilesMap = new Map(
          profiles?.map((p: any) => [p.id, p.nome]) || []
        );
      }

      return (data || []).map((rota: any) => ({
        ...rota,
        usuario_nome: profilesMap.get(rota.usuario_id) || "Usuário",
        pontos_count: rota.rota_pontos?.length || 0,
      }));
    },
    enabled: open,
  });

  // Buscar usuários para filtro
  const { data: usuarios = [] } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Mutation para adicionar rotas ao kanban
  const adicionarMutation = useMutation({
    mutationFn: async (rotaIds: string[]) => {
      const entries = rotaIds.map((rotaId) => ({
        rota_id: rotaId,
        kanban_type: selectedUser || "producao-legislativa",
        kanban_position: "a_fazer",
      }));

      const { error } = await supabase
        .from("kanban_rotas")
        .upsert(entries, {
          onConflict: "rota_id,kanban_type",
          ignoreDuplicates: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["demandas-kanban", selectedUser],
      });
      toast.success(
        `${selectedRotas.length} rota(s) adicionada(s) ao kanban!`
      );
      setSelectedRotas([]);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao adicionar rotas ao kanban:", error);
      toast.error("Erro ao adicionar rotas ao kanban");
    },
  });

  // Filtrar rotas
  const filteredRotas = rotas.filter((rota: any) => {
    const matchesSearch =
      rota.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rota.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rota.observacoes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || rota.status === statusFilter;
    const matchesUsuario =
      usuarioFilter === "all" || rota.usuario_id === usuarioFilter;

    return matchesSearch && matchesStatus && matchesUsuario;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "em_andamento":
        return "Em Andamento";
      case "concluida":
        return "Concluída";
      case "cancelada":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pendente":
        return "secondary";
      case "em_andamento":
        return "default";
      case "concluida":
        return "outline";
      case "cancelada":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleSelectRota = (rotaId: string, checked: boolean) => {
    if (checked) {
      setSelectedRotas((prev) => [...prev, rotaId]);
    } else {
      setSelectedRotas((prev) => prev.filter((id) => id !== rotaId));
    }
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedRotas(filteredRotas.map((r: any) => r.id));
    } else {
      setSelectedRotas([]);
    }
  };

  const handleConcluir = () => {
    if (selectedRotas.length === 0) {
      toast.error("Selecione pelo menos uma rota");
      return;
    }
    adicionarMutation.mutate(selectedRotas);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Adicionar Rotas ao Kanban
          </DialogTitle>
          <DialogDescription>
            Selecione as rotas salvas que deseja adicionar ao kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Filtros */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">
                      Em Andamento
                    </SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Usuário */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Responsável
                </label>
                <Select
                  value={usuarioFilter}
                  onValueChange={setUsuarioFilter}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Todos os Responsáveis
                    </SelectItem>
                    {usuarios.map((usuario: any) => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por título, responsável ou observações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Limpar filtros */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setUsuarioFilter("all");
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Seleção e estatísticas */}
          <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all-rotas"
                  checked={
                    selectedRotas.length === filteredRotas.length &&
                    filteredRotas.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <label
                  htmlFor="select-all-rotas"
                  className="text-sm font-medium"
                >
                  Selecionar todas ({filteredRotas.length})
                </label>
              </div>
              <Badge variant="secondary">
                {selectedRotas.length} selecionada(s)
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredRotas.length} de {rotas.length} rota(s)
            </p>
          </div>

          {/* Lista de rotas */}
          <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Carregando rotas...</span>
              </div>
            ) : filteredRotas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Route className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhuma rota encontrada.</p>
                <p className="text-xs mt-1">
                  Ajuste os filtros ou crie rotas no Mapa.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data Programada</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRotas.map((rota: any) => (
                    <TableRow key={rota.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRotas.includes(rota.id)}
                          onCheckedChange={(checked) =>
                            handleSelectRota(
                              rota.id,
                              checked as boolean
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium line-clamp-1">
                            {rota.titulo}
                          </p>
                          {rota.observacoes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {rota.observacoes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {rota.usuario_nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDateOnly(rota.data_programada)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {rota.pontos_count} ponto(s)
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(rota.status)}>
                          {getStatusLabel(rota.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConcluir}
            disabled={
              selectedRotas.length === 0 || adicionarMutation.isPending
            }
            className="gap-2"
          >
            <Route className="h-4 w-4" />
            {adicionarMutation.isPending
              ? "Adicionando..."
              : `Adicionar ${selectedRotas.length} rota(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
