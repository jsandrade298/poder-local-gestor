import React, { useState, useEffect, useCallback } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2, Download, Plus, Calendar as CalendarIcon, CheckCircle, Target, GripVertical, GripHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NovaAcaoDialog } from "@/components/forms/NovaAcaoDialog";
import { EditAcaoDialog } from "@/components/forms/EditAcaoDialog";
import { EixosManagerDialog } from "@/components/forms/EixosManagerDialog";
import { TemasManagerDialog } from "@/components/forms/TemasManagerDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
  
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const queryClient = useQueryClient();

  // Queries para dados
  const { data: planosAcao = [], isLoading, error } = useQuery({
    queryKey: ['planos-acao'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('planos_acao')
          .select(`
            *,
            eixos(nome, cor),
            prioridades_acao(nome, nivel, cor),
            temas_acao(nome),
            status_acao(nome, cor),
            responsavel:profiles!responsavel_id(nome),
            criador:profiles!created_by(nome)
          `)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Erro ao carregar planos:', err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 30000
  });

  const { data: eixos = [] } = useQuery({
    queryKey: ['eixos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ['temas-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('temas_acao').select('*, eixos(nome)').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ['prioridades-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prioridades_acao').select('*').order('nivel');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ['status-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('status_acao').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-plano'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  // Mutations
  const createAction = useMutation({
    mutationFn: async (newAction: any) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('planos_acao')
        .insert({
          ...newAction,
          created_by: user.user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação criada com sucesso!');
      setIsNewActionDialogOpen(false);
      setInsertPosition(null);
    },
    onError: (error) => {
      toast.error('Erro ao criar ação');
      console.error('Erro:', error);
    }
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase
        .from('planos_acao')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ação');
      console.error('Erro:', error);
    }
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planos_acao')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir ação');
      console.error('Erro:', error);
    }
  });

  // Função para reorganizar ações
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    // Lógica de reorganização pode ser implementada aqui
  };

  // Função para inserir nova ação em posição específica
  const handleInsertAction = (position: number) => {
    setInsertPosition(position);
    setIsNewActionDialogOpen(true);
  };

  // Componente para inserção entre linhas
  const InsertRow = ({ index }: { index: number }) => (
    <tr 
      className="group cursor-pointer hover:bg-muted/50 transition-colors"
      onMouseEnter={() => setHoveredRowIndex(index)}
      onMouseLeave={() => setHoveredRowIndex(null)}
      onClick={() => handleInsertAction(index)}
    >
      <td colSpan={12} className="p-2 text-center">
        <div className={cn(
          "flex items-center justify-center gap-2 text-muted-foreground transition-all duration-200",
          hoveredRowIndex === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Adicionar nova ação aqui</span>
        </div>
      </td>
    </tr>
  );

  // Filtros aplicados
  const filteredActions = planosAcao?.filter((action) => {
    const matchesSearch = !searchTerm || 
      action.acao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.eixos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.temas_acao?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.apoio?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEixo = eixoFilter === "all" || action.eixo_id === eixoFilter;
    const matchesStatus = statusFilter === "all" || action.status_id === statusFilter;
    const matchesResponsavel = responsavelFilter === "all" || action.responsavel_id === responsavelFilter;
    const matchesPrioridade = prioridadeFilter === "all" || action.prioridade_id === prioridadeFilter;
    const matchesConcluida = concluidaFilter === "all" || 
      (concluidaFilter === "true" && action.concluida) || 
      (concluidaFilter === "false" && !action.concluida);

    return matchesSearch && matchesEixo && matchesStatus && matchesResponsavel && matchesPrioridade && matchesConcluida;
  }) || [];

  // Calcular estatísticas
  const totalAcoes = filteredActions.length;
  const acoesConcluidas = filteredActions.filter(a => a.concluida).length;
  const percentualConcluido = totalAcoes > 0 ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0;

  // Funções auxiliares
  const handleToggleConcluida = (action: any) => {
    updateAction.mutate({
      id: action.id,
      updates: { concluida: !action.concluida }
    });
  };

  const handleQuickEdit = (action: any, field: string, value: any) => {
    const finalValue = field === 'responsavel_id' && value === 'none' ? null : value;
    
    updateAction.mutate({
      id: action.id,
      updates: { [field]: finalValue }
    });
  };

  const handleCellEdit = (actionId: string, field: string, currentValue: string) => {
    setEditingCell({ actionId, field });
    setEditingValue(currentValue || '');
  };

  const handleCellSave = () => {
    if (editingCell) {
      const action = filteredActions.find(a => a.id === editingCell.actionId);
      if (action) {
        handleQuickEdit(action, editingCell.field, editingValue);
      }
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // Funções para redimensionamento de colunas
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    e.preventDefault();
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, Math.min(800, startWidth + deltaX)); // Min 50px, Max 800px
    
    setColumnWidths(prev => ({
      ...prev,
      [isResizing]: newWidth
    }));
  }, [isResizing, startX, startWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  const handleResizeStart = (columnName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(columnName);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnName as keyof typeof columnWidths]);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Cleanup dos event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  const exportToCSV = () => {
    const headers = [
      'Eixo', 'Prioridade', 'Tema', 'Ação', 'Responsável', 
      'Apoio', 'Status', 'Prazo', 'Atualização', 'Concluída'
    ];

    const csvData = filteredActions.map(action => [
      action.eixos?.nome || '',
      action.prioridades_acao?.nome || '',
      action.temas_acao?.nome || '',
      action.acao || '',
      action.responsavel?.nome || '',
      action.apoio || '',
      action.status_acao?.nome || '',
      action.prazo ? format(new Date(action.prazo), 'dd/MM/yyyy') : '',
      action.atualizacao || '',
      action.concluida ? 'Sim' : 'Não'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plano_acao_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  // Se há erro, mostrar mensagem de erro
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar dados</h2>
            <p className="text-muted-foreground mb-4">{(error as Error)?.message || 'Erro desconhecido'}</p>
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-8 w-8" />
            Plano de Ação
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as ações estratégicas do gabinete
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEixosManager(true)}>
            Gerenciar Eixos
          </Button>
          <Button variant="outline" onClick={() => setShowTemasManager(true)}>
            Gerenciar Temas
          </Button>
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
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">{acoesConcluidas}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">{totalAcoes - acoesConcluidas}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">% Progresso</p>
                <p className="text-2xl font-bold text-primary">{percentualConcluido}%</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{percentualConcluido}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={eixoFilter} onValueChange={setEixoFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por eixo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eixos</SelectItem>
                {eixos.map((eixo) => (
                  <SelectItem key={eixo.id} value={eixo.id}>
                    {eixo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusAcao.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={concluidaFilter} onValueChange={setConcluidaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="true">Concluídas</SelectItem>
                <SelectItem value="false">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
          </div>
          
          {/* Container com scroll vertical sempre visível */}
          <div 
            className="relative border rounded-md"
            style={{ height: tableHeight }}
          >
            {/* Header fixo fora do scroll */}
            <div className="sticky top-0 z-20 bg-background border-b">
              <Table style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 80) }}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.eixo }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Eixo</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('eixo', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.prioridade }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Prioridade</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('prioridade', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.tema }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Tema</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('tema', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.acao }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Ação</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('acao', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.responsavel }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Responsável</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('responsavel', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.apoio }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Apoio</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('apoio', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.status }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Status</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('status', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.prazo }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Prazo</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('prazo', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="relative font-medium border-r"
                      style={{ width: columnWidths.atualizacao }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Atualização</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                          onMouseDown={(e) => handleResizeStart('atualizacao', e)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
            
            {/* Área de conteúdo com scroll */}
            <div 
              className="plano-acao-scroll"
              style={{ 
                height: `calc(${tableHeight}px - 57px)`, // 57px é a altura do header
                overflowY: 'scroll',
                overflowX: 'auto'
              }}
            >
              <Table 
                className="relative w-full" 
                style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 80) }}
              >
                <TableBody>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="acoes">
                      {(provided, snapshot) => (
                        <tbody
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={snapshot.isDraggingOver ? "bg-blue-50/50" : ""}
                        >
                          {filteredActions.map((action, index) => (
                            <Draggable key={action.id} draggableId={action.id} index={index}>
                              {(provided, snapshot) => (
                                <TableRow
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`
                                    border-b transition-colors hover:bg-muted/50
                                    ${snapshot.isDragging ? 'bg-blue-100 shadow-lg' : ''}
                                    ${action.concluida ? 'bg-green-50 hover:bg-green-100/50' : ''}
                                  `}
                                >
                                  <TableCell className="w-12 p-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </TableCell>
                                  
                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.eixo }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'eixo' ? (
                                      <Select
                                        value={editingValue}
                                        onValueChange={setEditingValue}
                                        onOpenChange={(open) => {
                                          if (!open) {
                                            handleCellSave();
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {eixos.map((eixo) => (
                                            <SelectItem key={eixo.id} value={eixo.id}>
                                              {eixo.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'eixo_id', action.eixo_id || '')}
                                      >
                                        <span className="text-sm">
                                          {action.eixos?.nome || '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.prioridade }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'prioridade' ? (
                                      <Select
                                        value={editingValue}
                                        onValueChange={setEditingValue}
                                        onOpenChange={(open) => {
                                          if (!open) {
                                            handleCellSave();
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {prioridades.map((prioridade) => (
                                            <SelectItem key={prioridade.id} value={prioridade.id}>
                                              {prioridade.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'prioridade_id', action.prioridade_id || '')}
                                      >
                                        <Badge variant="outline" className="text-xs">
                                          {action.prioridades_acao?.nome || '-'}
                                        </Badge>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.tema }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'tema' ? (
                                      <Select
                                        value={editingValue}
                                        onValueChange={setEditingValue}
                                        onOpenChange={(open) => {
                                          if (!open) {
                                            handleCellSave();
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {temas.map((tema) => (
                                            <SelectItem key={tema.id} value={tema.id}>
                                              {tema.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'tema_id', action.tema_id || '')}
                                      >
                                        <span className="text-sm">
                                          {action.temas_acao?.nome || '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.acao }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'acao' ? (
                                      <Textarea
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleCellSave();
                                          }
                                          if (e.key === 'Escape') {
                                            handleCellCancel();
                                          }
                                        }}
                                        className="min-h-[60px] text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[60px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'acao', action.acao || '')}
                                      >
                                        <span className="text-sm break-words line-clamp-3">
                                          {action.acao || '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.responsavel }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'responsavel' ? (
                                      <Select
                                        value={editingValue}
                                        onValueChange={setEditingValue}
                                        onOpenChange={(open) => {
                                          if (!open) {
                                            handleCellSave();
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Nenhum responsável</SelectItem>
                                          {usuarios.map((usuario) => (
                                            <SelectItem key={usuario.id} value={usuario.id}>
                                              {usuario.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'responsavel_id', action.responsavel_id || 'none')}
                                      >
                                        <span className="text-sm">
                                          {action.responsavel?.nome || 'Sem responsável'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.apoio }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'apoio' ? (
                                      <Textarea
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleCellSave();
                                          }
                                          if (e.key === 'Escape') {
                                            handleCellCancel();
                                          }
                                        }}
                                        className="min-h-[60px] text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[60px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'apoio', action.apoio || '')}
                                      >
                                        <span className="text-sm break-words line-clamp-3">
                                          {action.apoio || '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.status }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'status' ? (
                                      <Select
                                        value={editingValue}
                                        onValueChange={setEditingValue}
                                        onOpenChange={(open) => {
                                          if (!open) {
                                            handleCellSave();
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {statusAcao.map((status) => (
                                            <SelectItem key={status.id} value={status.id}>
                                              {status.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'status_id', action.status_id || '')}
                                      >
                                        <Badge variant="outline" className="text-xs">
                                          {action.status_acao?.nome || '-'}
                                        </Badge>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.prazo }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'prazo' ? (
                                      <Input
                                        type="date"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleCellSave();
                                          }
                                          if (e.key === 'Escape') {
                                            handleCellCancel();
                                          }
                                        }}
                                        className="h-8 text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[32px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'prazo', action.prazo ? format(new Date(action.prazo), 'yyyy-MM-dd') : '')}
                                      >
                                        <span className="text-sm">
                                          {action.prazo ? format(new Date(action.prazo), 'dd/MM/yyyy') : '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell 
                                    className="p-2 border-r"
                                    style={{ width: columnWidths.atualizacao }}
                                  >
                                    {editingCell?.actionId === action.id && editingCell?.field === 'atualizacao' ? (
                                      <Textarea
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleCellSave();
                                          }
                                          if (e.key === 'Escape') {
                                            handleCellCancel();
                                          }
                                        }}
                                        className="min-h-[60px] text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        className="cursor-pointer min-h-[60px] p-1 rounded hover:bg-gray-100 transition-colors"
                                        onClick={() => handleCellEdit(action.id, 'atualizacao', action.atualizacao || '')}
                                      >
                                        <span className="text-sm break-words line-clamp-3">
                                          {action.atualizacao || '-'}
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>
                                  
                                  <TableCell className="w-20 p-2">
                                    <div className="flex gap-1">
                                      <Checkbox
                                        checked={action.concluida}
                                        onCheckedChange={() => handleToggleConcluida(action)}
                                        className="mr-2"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingAction(action);
                                          setIsEditDialogOpen(true);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <GripHorizontal className="h-3 w-3" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Tem certeza que deseja excluir esta ação? Esta ação não pode ser desfeita.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => deleteAction.mutate(action.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Excluir
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      )}
                    </Droppable>
                  </DragDropContext>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <NovaAcaoDialog 
        open={isNewActionDialogOpen} 
        onOpenChange={setIsNewActionDialogOpen}
        onSubmit={(actionData) => {
          createAction.mutate(actionData);
        }}
      />

      <EditAcaoDialog
        action={editingAction}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(actionData) => {
          if (editingAction) {
            updateAction.mutate({
              id: editingAction.id,
              updates: actionData
            });
          }
          setIsEditDialogOpen(false);
          setEditingAction(null);
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