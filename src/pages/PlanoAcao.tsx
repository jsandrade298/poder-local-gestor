import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2, Download, Upload, FileText, Plus, Calendar as CalendarIcon, CheckCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NovaAcaoDialog } from "@/components/forms/NovaAcaoDialog";
import { EditAcaoDialog } from "@/components/forms/EditAcaoDialog";
import { EixosManagerDialog } from "@/components/forms/EixosManagerDialog";
import { TemasManagerDialog } from "@/components/forms/TemasManagerDialog";
import { Label } from "@/components/ui/label";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Queries para dados
  const { data: planosAcao = [], isLoading } = useQuery({
    queryKey: ['planos-acao'],
    queryFn: async () => {
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
      return data;
    }
  });

  const { data: eixos = [] } = useQuery({
    queryKey: ['eixos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ['temas-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('temas_acao').select('*, eixos(nome)').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ['prioridades-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prioridades_acao').select('*').order('nivel');
      if (error) throw error;
      return data;
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ['status-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('status_acao').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-plano'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome').order('nome');
      if (error) throw error;
      return data;
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

  // Filtros aplicados
  const filteredActions = planosAcao.filter((action) => {
    const matchesSearch = !searchTerm || 
      action.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.eixos?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.temas_acao?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.apoio?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEixo = eixoFilter === "all" || action.eixo_id === eixoFilter;
    const matchesStatus = statusFilter === "all" || action.status_id === statusFilter;
    const matchesResponsavel = responsavelFilter === "all" || action.responsavel_id === responsavelFilter;
    const matchesPrioridade = prioridadeFilter === "all" || action.prioridade_id === prioridadeFilter;
    const matchesConcluida = concluidaFilter === "all" || 
      (concluidaFilter === "true" && action.concluida) || 
      (concluidaFilter === "false" && !action.concluida);

    return matchesSearch && matchesEixo && matchesStatus && matchesResponsavel && matchesPrioridade && matchesConcluida;
  });

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
    updateAction.mutate({
      id: action.id,
      updates: { [field]: value }
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
              <FileText className="h-8 w-8 text-blue-600" />
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

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox />
                </TableHead>
                <TableHead>Eixo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead className="min-w-[200px]">Ação</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Apoio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead className="w-12">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Nenhuma ação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredActions.map((action) => (
                  <TableRow key={action.id} className={action.concluida ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={action.concluida}
                        onCheckedChange={() => handleToggleConcluida(action)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        style={{ 
                          borderColor: action.eixos?.cor, 
                          color: action.eixos?.cor 
                        }}
                      >
                        {action.eixos?.nome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: action.prioridades_acao?.cor, 
                          color: action.prioridades_acao?.cor 
                        }}
                      >
                        {action.prioridades_acao?.nome}
                      </Badge>
                    </TableCell>
                    <TableCell>{action.temas_acao?.nome}</TableCell>
                    <TableCell className="max-w-[300px]">
                      {editingCell?.actionId === action.id && editingCell?.field === 'acao' ? (
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave();
                            if (e.key === 'Escape') handleCellCancel();
                          }}
                          autoFocus
                          className="h-8"
                        />
                      ) : (
                        <div 
                          className="truncate cursor-pointer hover:bg-muted/50 p-1 rounded" 
                          title={action.acao}
                          onClick={() => handleCellEdit(action.id, 'acao', action.acao)}
                        >
                          {action.acao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingCell?.actionId === action.id && editingCell?.field === 'responsavel_id' ? (
                        <Select
                          value={editingValue}
                          onValueChange={(value) => {
                            setEditingValue(value);
                            handleQuickEdit(action, 'responsavel_id', value);
                            setEditingCell(null);
                          }}
                          onOpenChange={(open) => {
                            if (!open) setEditingCell(null);
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {usuarios.map((usuario) => (
                              <SelectItem key={usuario.id} value={usuario.id}>
                                {usuario.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                          onClick={() => handleCellEdit(action.id, 'responsavel_id', action.responsavel_id || '')}
                        >
                          {action.responsavel?.nome || '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {editingCell?.actionId === action.id && editingCell?.field === 'apoio' ? (
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave();
                            if (e.key === 'Escape') handleCellCancel();
                          }}
                          autoFocus
                          className="h-8"
                        />
                      ) : (
                        <div 
                          className="truncate cursor-pointer hover:bg-muted/50 p-1 rounded" 
                          title={action.apoio}
                          onClick={() => handleCellEdit(action.id, 'apoio', action.apoio || '')}
                        >
                          {action.apoio || '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: action.status_acao?.cor, 
                          color: action.status_acao?.cor 
                        }}
                      >
                        {action.status_acao?.nome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {action.prazo ? format(new Date(action.prazo), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={action.atualizacao}>
                        {action.atualizacao || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setEditingAction(action);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteAction.mutate(action.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogos */}
      <NovaAcaoDialog
        open={isNewActionDialogOpen}
        onOpenChange={setIsNewActionDialogOpen}
        onSubmit={(data) => createAction.mutate(data)}
      />

      <EditAcaoDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(data) => {
          if (editingAction) {
            updateAction.mutate({
              id: editingAction.id,
              updates: data
            });
            setIsEditDialogOpen(false);
          }
        }}
        action={editingAction}
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