import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2, Download, Plus, Calendar as CalendarIcon, CheckCircle, Target, GripVertical, GripHorizontal, Upload, Save, Maximize } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NovaAcaoDialog } from "@/components/forms/NovaAcaoDialog";
import { EditAcaoDialog } from "@/components/forms/EditAcaoDialog";
import { EixosManagerDialog } from "@/components/forms/EixosManagerDialog";
import { TemasManagerDialog } from "@/components/forms/TemasManagerDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ImportCSVDialogPlanoAcao } from "@/components/forms/ImportCSVDialogPlanoAcao";
import { PlanoAcaoTable } from "@/components/PlanoAcaoTable";

export default function PlanoAcao() {
  const [searchTerm, setSearchTerm] = useState("");
  const [eixoFilter, setEixoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [concluidaFilter, setConcluidaFilter] = useState("all");
  const [isNewActionDialogOpen, setIsNewActionDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showEixosManager, setShowEixosManager] = useState(false);
  const [showTemasManager, setShowTemasManager] = useState(false);
  const [editingCell, setEditingCell] = useState<{actionId: string, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  
  // Estados para importação CSV
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para larguras das colunas
  const [columnWidths, setColumnWidths] = useState({
    eixo: 120,
    prioridade: 100,
    tema: 150,
    acao: 320,
    responsavel: 150,
    apoio: 200,
    status: 120,
    prazo: 120,
    atualizacao: 320,
    excluir: 80
  });
  
  const [tableHeight, setTableHeight] = useState(600);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Carregar layout salvo ao inicializar
  useEffect(() => {
    const savedLayout = localStorage.getItem('plano-acao-layout');
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        if (layout.columnWidths) {
          setColumnWidths(layout.columnWidths);
        }
        if (layout.tableHeight) {
          setTableHeight(layout.tableHeight);
        }
      } catch (error) {
        console.error('Erro ao carregar layout salvo:', error);
      }
    }
  }, []);

  // Função para salvar layout
  const saveLayout = () => {
    const layout = {
      columnWidths,
      tableHeight,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('plano-acao-layout', JSON.stringify(layout));
    toast.success('Layout salvo com sucesso!');
  };

  const queryClient = useQueryClient();

  // Fetch functions
  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select(`
          *,
          eixos(id, nome, cor),
          prioridades_acao(id, nome, cor),
          temas_acao(id, nome),
          status_acao(id, nome, cor),
          responsavel:usuarios!acoes_responsavel_id_fkey(id, nome),
          apoio:usuarios!acoes_apoio_id_fkey(id, nome)
        `)
        .order("ordem");
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: eixos = [] } = useQuery({
    queryKey: ["eixos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eixos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ["prioridades-acao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prioridades_acao")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ["temas-acao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("temas_acao")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ["status-acao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_acao")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  // Mutations
  const createAction = useMutation({
    mutationFn: async (data: any) => {
      const maxOrder = Math.max(...acoes.map(a => a.ordem || 0), 0);
      const { data: newAction, error } = await supabase
        .from("acoes")
        .insert({ ...data, ordem: maxOrder + 1 })
        .select()
        .single();
      
      if (error) throw error;
      return newAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acoes"] });
      toast.success("Ação criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar ação: " + error.message);
    }
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from("acoes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acoes"] });
      toast.success("Ação atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar ação: " + error.message);
    }
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("acoes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acoes"] });
      toast.success("Ação excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir ação: " + error.message);
    }
  });

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(filteredActions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      ordem: index + 1
    }));

    // Update all items with new order
    Promise.all(
      updatedItems.map(item =>
        supabase
          .from("acoes")
          .update({ ordem: item.ordem })
          .eq("id", item.id)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ["acoes"] });
    });
  }, [queryClient]);

  // Filters
  const filteredActions = acoes.filter(action => {
    const matchesSearch = action.acao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         action.eixos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         action.temas_acao?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEixo = eixoFilter === "all" || action.eixo_id === eixoFilter;
    const matchesStatus = statusFilter === "all" || action.status_id === statusFilter;
    const matchesResponsavel = responsavelFilter === "all" || action.responsavel_id === responsavelFilter;
    const matchesPrioridade = prioridadeFilter === "all" || action.prioridade_id === prioridadeFilter;
    const matchesConcluida = concluidaFilter === "all" || 
                            (concluidaFilter === "true" && action.concluida) ||
                            (concluidaFilter === "false" && !action.concluida);

    return matchesSearch && matchesEixo && matchesStatus && matchesResponsavel && matchesPrioridade && matchesConcluida;
  });

  // Statistics
  const totalAcoes = acoes.length;
  const acoesCompletas = acoes.filter(action => action.concluida).length;
  const acoesAtrasadas = acoes.filter(action => {
    if (!action.prazo_conclusao || action.concluida) return false;
    return new Date(action.prazo_conclusao) < new Date();
  }).length;
  const progressoPercentual = totalAcoes > 0 ? Math.round((acoesCompletas / totalAcoes) * 100) : 0;

  // Handlers
  const handleToggleConcluida = (action: any) => {
    updateAction.mutate({
      id: action.id,
      updates: { concluida: !action.concluida }
    });
  };

  const handleQuickEdit = (action: any, field: string, value: any) => {
    updateAction.mutate({
      id: action.id,
      updates: { [field]: value }
    });
  };

  const handleCellEdit = (actionId: string, field: string, currentValue: string) => {
    setEditingCell({ actionId, field });
    setEditingValue(currentValue || "");
  };

  const handleCellSave = () => {
    if (editingCell) {
      updateAction.mutate({
        id: editingCell.actionId,
        updates: { [editingCell.field]: editingValue }
      });
    }
    setEditingCell(null);
    setEditingValue("");
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  const handleInsertAction = async (position: number) => {
    try {
      // Encontrar a ordem da posição
      const targetOrder = position === 0 ? 0.5 : 
                         position >= filteredActions.length ? filteredActions[filteredActions.length - 1].ordem + 1 :
                         (filteredActions[position - 1].ordem + filteredActions[position].ordem) / 2;

      const { data: newAction, error } = await supabase
        .from("acoes")
        .insert({
          acao: "Nova ação",
          ordem: targetOrder
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["acoes"] });
      toast.success("Nova ação inserida!");
      
      // Editar imediatamente
      setTimeout(() => {
        handleCellEdit(newAction.id, 'acao', newAction.acao);
      }, 100);
    } catch (error: any) {
      toast.error("Erro ao inserir ação: " + error.message);
    }
  };

  // Resize handling
  const handleResizeStart = (columnName: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(columnName);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnName as keyof typeof columnWidths]);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diff = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      
      setColumnWidths(prev => ({
        ...prev,
        [columnName]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Eixo", "Prioridade", "Tema", "Ação", "Responsável", "Apoio", 
      "Status", "Prazo", "Atualização", "Concluída"
    ];
    
    const csvData = filteredActions.map(action => [
      action.eixos?.nome || "",
      action.prioridades_acao?.nome || "",
      action.temas_acao?.nome || "",
      action.acao || "",
      action.responsavel?.nome || "",
      action.apoio?.nome || "",
      action.status_acao?.nome || "",
      action.prazo_conclusao ? format(new Date(action.prazo_conclusao), "dd/MM/yyyy") : "",
      action.atualizacao || "",
      action.concluida ? "Sim" : "Não"
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plano-acao-${format(new Date(), "dd-MM-yyyy")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Arquivo CSV exportado com sucesso!");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Plano de Ação</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowEixosManager(true)}>
              Gerenciar Eixos
            </Button>
            <Button variant="outline" onClick={() => setShowTemasManager(true)}>
              Gerenciar Temas
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar ações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={eixoFilter} onValueChange={setEixoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os eixos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eixos</SelectItem>
                  {eixos.map((eixo) => (
                    <SelectItem key={eixo.id} value={eixo.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eixo.cor }} />
                        {eixo.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as prioridades</SelectItem>
                  {prioridades.map((prioridade) => (
                    <SelectItem key={prioridade.id} value={prioridade.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: prioridade.cor }} />
                        {prioridade.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusAcao.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.cor }} />
                        {status.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={concluidaFilter} onValueChange={setConcluidaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="true">Concluídas</SelectItem>
                  <SelectItem value="false">Em andamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <ImportCSVDialogPlanoAcao
            onFileSelect={() => {}}
            isImporting={isImporting}
            fileInputRef={fileInputRef}
            importResults={importResults}
          >
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          </ImportCSVDialogPlanoAcao>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setIsNewActionDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ação
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Total de Ações</p>
                <p className="text-2xl font-bold">{totalAcoes}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Ações Completas</p>
                <p className="text-2xl font-bold text-green-600">{acoesCompletas}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Ações Atrasadas</p>
                <p className="text-2xl font-bold text-red-600">{acoesAtrasadas}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Progresso</p>
                <p className="text-2xl font-bold">{progressoPercentual}%</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-bold">{progressoPercentual}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela com Scroll contido no Card */}
      <Card>
        <CardContent className="p-0">
          {/* Controles de altura da tabela */}
          <div className="p-4 border-b flex items-center gap-4">
            <label className="text-sm font-medium">Altura da tabela:</label>
            <input
              type="range"
              min="400"
              max="800"
              value={tableHeight}
              onChange={(e) => setTableHeight(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm text-muted-foreground">{tableHeight}px</span>
            
            {/* Botões Salvar Layout e Maximizar */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={saveLayout}
                variant="outline"
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Layout
              </Button>
              <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Maximize className="h-4 w-4 mr-2" />
                    Maximizar Planilha
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[98vw] max-h-[98vh] h-[98vh] w-[98vw] p-0">
                  <DialogHeader className="p-6 pb-2 border-b flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <DialogTitle className="flex items-center gap-2">
                        <Target className="h-6 w-6" />
                        Plano de Ação - Visualização Maximizada
                      </DialogTitle>
                      <div className="mt-1 mr-8">
                        <Button
                          onClick={saveLayout}
                          variant="outline"
                          size="sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar Layout
                        </Button>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden">
                    <div 
                      className="h-full w-full overflow-auto"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "hsl(var(--border)) transparent"
                      }}
                    >
                      <div className="p-6 pt-4">
                        <PlanoAcaoTable
                          filteredActions={filteredActions}
                          isLoading={isLoading}
                          columnWidths={columnWidths}
                          editingCell={editingCell}
                          editingValue={editingValue}
                          hoveredRowIndex={hoveredRowIndex}
                          eixos={eixos}
                          prioridades={prioridades}
                          temas={temas}
                          statusAcao={statusAcao}
                          usuarios={usuarios}
                          handleDragEnd={handleDragEnd}
                          handleToggleConcluida={handleToggleConcluida}
                          handleQuickEdit={handleQuickEdit}
                          handleCellEdit={handleCellEdit}
                          handleCellSave={handleCellSave}
                          handleCellCancel={handleCellCancel}
                          setEditingValue={setEditingValue}
                          setHoveredRowIndex={setHoveredRowIndex}
                          handleInsertAction={handleInsertAction}
                          deleteAction={deleteAction}
                          updateAction={updateAction}
                          handleResizeStart={handleResizeStart}
                          isMaximized={true}
                        />
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Container com scroll vertical sempre visível */}
          <div 
            className="relative bg-background border rounded-lg"
            style={{ height: tableHeight }}
          >
            <div 
              className="h-full custom-scrollbar"
              style={{ 
                overflowY: 'scroll',
                overflowX: 'auto'
              }}
            >
              <PlanoAcaoTable
                filteredActions={filteredActions}
                isLoading={isLoading}
                columnWidths={columnWidths}
                editingCell={editingCell}
                editingValue={editingValue}
                hoveredRowIndex={hoveredRowIndex}
                eixos={eixos}
                prioridades={prioridades}
                temas={temas}
                statusAcao={statusAcao}
                usuarios={usuarios}
                handleDragEnd={handleDragEnd}
                handleToggleConcluida={handleToggleConcluida}
                handleQuickEdit={handleQuickEdit}
                handleCellEdit={handleCellEdit}
                handleCellSave={handleCellSave}
                handleCellCancel={handleCellCancel}
                setEditingValue={setEditingValue}
                setHoveredRowIndex={setHoveredRowIndex}
                handleInsertAction={handleInsertAction}
                deleteAction={deleteAction}
                updateAction={updateAction}
                handleResizeStart={handleResizeStart}
                isMaximized={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NovaAcaoDialog
        open={isNewActionDialogOpen}
        onOpenChange={setIsNewActionDialogOpen}
        onSubmit={(data) => {
          createAction.mutate(data);
        }}
      />

      <EditAcaoDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        action={editingAction}
        onSubmit={(data) => {
          if (editingAction) {
            updateAction.mutate({
              id: editingAction.id,
              updates: data
            });
          }
          setIsEditDialogOpen(false);
        }}
      />

      <EixosManagerDialog
        open={showEixosManager}
        onOpenChange={setShowEixosManager}
      />

      <TemasManagerDialog
        open={showTemasManager}
        onOpenChange={setShowTemasManager}
      />
    </div>
  );
}
