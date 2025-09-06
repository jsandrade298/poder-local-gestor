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
            className="relative bg-background"
            style={{ height: tableHeight }}
          >
            <div 
              className="h-full plano-acao-scroll"
              style={{ 
                overflowY: 'scroll',
                overflowX: 'auto'
              }}
            >
              <Table 
                className="relative w-full" 
                style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 80) }}
              >
                {/* Header fixo com backdrop blur */}
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm border-b shadow-sm z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableHead>
                  <TableHead className="w-12">
                    <Checkbox />
                  </TableHead>
                  <TableHead style={{ width: columnWidths.eixo }} className="relative">
                    Eixo
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('eixo', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.prioridade }} className="relative">
                    Prioridade
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('prioridade', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.tema }} className="relative">
                    Tema
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('tema', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.acao }} className="relative">
                    Ação
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('acao', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.responsavel }} className="relative">
                    Responsável
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('responsavel', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.apoio }} className="relative">
                    Apoio
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('apoio', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.status }} className="relative">
                    Status
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('status', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.prazo }} className="relative">
                    Prazo
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('prazo', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.atualizacao }} className="relative">
                    Atualização
                    <div 
                      className="absolute right-0 top-0 h-full w-6 cursor-col-resize hover:bg-primary/30 flex items-center justify-center group"
                      onMouseDown={(e) => handleResizeStart('atualizacao', e)}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </TableHead>
                  <TableHead style={{ width: columnWidths.excluir }}>
                    Excluir
                  </TableHead>
                </TableRow>
              </TableHeader>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="actions-table">
                  {(provided) => (
                    <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredActions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8">
                            Nenhuma ação encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <InsertRow index={0} />
                          {filteredActions.map((action, index) => (
                            <React.Fragment key={action.id}>
                              <Draggable draggableId={action.id} index={index}>
                                {(provided, snapshot) => (
                                  <TableRow 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      action.concluida ? "opacity-60" : "",
                                      snapshot.isDragging && "shadow-lg bg-background"
                                    )}
                                  >
                                     {/* Handle de drag */}
                                     <TableCell className="w-12 p-2">
                                       <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                         <GripVertical className="h-4 w-4 text-muted-foreground" />
                                       </div>
                                     </TableCell>
                                     
                                     {/* Checkbox */}
                                     <TableCell className="w-12">
                                       <Checkbox
                                         checked={action.concluida}
                                         onCheckedChange={() => handleToggleConcluida(action)}
                                       />
                                     </TableCell>

                                    {/* Eixo */}
                                    <TableCell style={{ width: columnWidths.eixo }}>
                                      <Select 
                                        value={action.eixo_id || ""} 
                                        onValueChange={(value) => handleQuickEdit(action, 'eixo_id', value)}
                                      >
                                        <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                          <Badge 
                                            variant="outline" 
                                            style={{ 
                                              borderColor: action.eixos?.cor, 
                                              color: action.eixos?.cor 
                                            }}
                                          >
                                            {action.eixos?.nome || 'Selecionar eixo'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {eixos.map((eixo) => (
                                            <SelectItem key={eixo.id} value={eixo.id}>
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full" 
                                                  style={{ backgroundColor: eixo.cor }}
                                                />
                                                {eixo.nome}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>

                                    {/* Prioridade */}
                                    <TableCell style={{ width: columnWidths.prioridade }}>
                                      <Select 
                                        value={action.prioridade_id || ""} 
                                        onValueChange={(value) => handleQuickEdit(action, 'prioridade_id', value)}
                                      >
                                        <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                          <Badge 
                                            variant="outline"
                                            style={{ 
                                              borderColor: action.prioridades_acao?.cor, 
                                              color: action.prioridades_acao?.cor 
                                            }}
                                          >
                                            {action.prioridades_acao?.nome || 'Selecionar prioridade'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {prioridades.map((prioridade) => (
                                            <SelectItem key={prioridade.id} value={prioridade.id}>
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full" 
                                                  style={{ backgroundColor: prioridade.cor }}
                                                />
                                                {prioridade.nome}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>

                                    {/* Tema */}
                                    <TableCell style={{ width: columnWidths.tema }}>
                                      <Select 
                                        value={action.tema_id || ""} 
                                        onValueChange={(value) => handleQuickEdit(action, 'tema_id', value)}
                                      >
                                        <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                          <Badge variant="secondary">
                                            {action.temas_acao?.nome || 'Selecionar tema'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {temas.map((tema) => (
                                            <SelectItem key={tema.id} value={tema.id}>
                                              {tema.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>

                                    {/* Ação */}
                                    <TableCell style={{ width: columnWidths.acao }}>
                                      {editingCell?.actionId === action.id && editingCell?.field === 'acao' ? (
                                        <div className="flex gap-2 items-start">
                                          <Textarea
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            style={{ width: Math.max(columnWidths.acao - 100, 200) }}
                                            className="min-h-[60px]"
                                            autoFocus
                                          />
                                          <div className="flex flex-col gap-1">
                                            <Button size="sm" onClick={handleCellSave}>
                                              Salvar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleCellCancel}>
                                              Cancelar
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div 
                                          className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] overflow-hidden text-ellipsis"
                                          style={{ maxWidth: columnWidths.acao - 20 }}
                                          onClick={() => handleCellEdit(action.id, 'acao', action.acao)}
                                          title={action.acao}
                                        >
                                          {action.acao || 'Clique para editar'}
                                        </div>
                                      )}
                                    </TableCell>

                                    {/* Responsável */}
                                    <TableCell style={{ width: columnWidths.responsavel }}>
                                      <Select 
                                        value={action.responsavel_id || "none"} 
                                        onValueChange={(value) => handleQuickEdit(action, 'responsavel_id', value)}
                                      >
                                        <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                          <div className="text-left truncate">
                                            {action.responsavel?.nome || 'Selecionar responsável'}
                                          </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Sem responsável</SelectItem>
                                          {usuarios.map((usuario) => (
                                            <SelectItem key={usuario.id} value={usuario.id}>
                                              {usuario.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>

                                    {/* Apoio */}
                                    <TableCell style={{ width: columnWidths.apoio }}>
                                      <div className="truncate" title={action.apoio}>
                                        {action.apoio || '-'}
                                      </div>
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell style={{ width: columnWidths.status }}>
                                      <Select 
                                        value={action.status_id || ""} 
                                        onValueChange={(value) => handleQuickEdit(action, 'status_id', value)}
                                      >
                                        <SelectTrigger className="border-0 h-auto p-0 hover:bg-muted">
                                          <Badge 
                                            variant="outline"
                                            style={{ 
                                              borderColor: action.status_acao?.cor, 
                                              color: action.status_acao?.cor 
                                            }}
                                          >
                                            {action.status_acao?.nome || 'Selecionar status'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {statusAcao.map((status) => (
                                            <SelectItem key={status.id} value={status.id}>
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full" 
                                                  style={{ backgroundColor: status.cor }}
                                                />
                                                {status.nome}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>

                                    {/* Prazo */}
                                    <TableCell style={{ width: columnWidths.prazo }}>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button 
                                            variant="outline" 
                                            className={cn(
                                              "w-full justify-start text-left font-normal border-0 hover:bg-muted",
                                              !action.prazo && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {action.prazo ? (
                                              format(new Date(action.prazo), 'dd/MM/yyyy')
                                            ) : (
                                              "Selecionar"
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={action.prazo ? new Date(action.prazo) : undefined}
                                            onSelect={(date) => {
                                              if (date) {
                                                handleQuickEdit(action, 'prazo', date.toISOString().split('T')[0]);
                                              }
                                            }}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </TableCell>

                                    {/* Atualização */}
                                    <TableCell style={{ width: columnWidths.atualizacao }}>
                                      {editingCell?.actionId === action.id && editingCell?.field === 'atualizacao' ? (
                                        <div className="flex gap-2 items-start">
                                           <Textarea
                                             value={editingValue}
                                             onChange={(e) => setEditingValue(e.target.value)}
                                             style={{ 
                                               width: Math.max(columnWidths.atualizacao - 100, 200),
                                               whiteSpace: 'pre-wrap'
                                             }}
                                             className="min-h-[60px] whitespace-pre-wrap"
                                             autoFocus
                                           />
                                          <div className="flex flex-col gap-1">
                                            <Button size="sm" onClick={handleCellSave}>
                                              Salvar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleCellCancel}>
                                              Cancelar
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                         <div 
                                           className="cursor-pointer p-2 hover:bg-muted rounded min-h-[40px] whitespace-pre-wrap"
                                           style={{ 
                                             maxWidth: columnWidths.atualizacao - 20,
                                             wordBreak: 'break-word',
                                             whiteSpace: 'pre-wrap'
                                           }}
                                           onClick={() => handleCellEdit(action.id, 'atualizacao', action.atualizacao)}
                                           title={action.atualizacao}
                                         >
                                           {action.atualizacao || 'Clique para editar'}
                                         </div>
                                      )}
                                    </TableCell>

                                     {/* Botão de exclusão */}
                                     <TableCell style={{ width: columnWidths.excluir }}>
                                       <AlertDialog>
                                         <AlertDialogTrigger asChild>
                                           <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                             <Trash2 className="h-4 w-4" />
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
                                             <AlertDialogAction onClick={() => deleteAction.mutate(action.id)}>
                                               Excluir
                                             </AlertDialogAction>
                                           </AlertDialogFooter>
                                         </AlertDialogContent>
                                       </AlertDialog>
                                     </TableCell>
                                  </TableRow>
                                )}
                              </Draggable>
                              <InsertRow index={index + 1} />
                            </React.Fragment>
                          ))}
                        </>
                      )}
                      {provided.placeholder}
                    </TableBody>
                  )}
                </Droppable>
              </DragDropContext>
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