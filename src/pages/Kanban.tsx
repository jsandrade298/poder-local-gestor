import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, User, AlertTriangle, Trash2, X, ChevronDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { formatDateTime } from '@/lib/dateUtils';
import { AdicionarDemandasKanbanDialog } from "@/components/forms/AdicionarDemandasKanbanDialog";
import { AdicionarTarefaDialog } from "@/components/forms/AdicionarTarefaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { ViewTarefaDialog } from "@/components/forms/ViewTarefaDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { EditTarefaDialog } from "@/components/forms/EditTarefaDialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface Demanda {
  id: string;
  titulo: string;
  protocolo: string;
  descricao: string;
  status: string;
  kanban_position: string;
  prioridade: string;
  data_prazo: string | null;
  created_at: string;
  areas?: { nome: string };
  municipes?: { nome: string };
  responsavel_id?: string;
  tipo?: 'demanda' | 'tarefa'; // Novo campo para diferenciar
  tarefa_responsavel_id?: string; // Campo específico para responsável da tarefa
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  kanban_position: string;
  kanban_type: string;
  created_by: string;
  completed: boolean;
  created_at: string;
  tipo: 'tarefa';
}

const statusColumns = [
  { id: 'a_fazer', title: 'A Fazer', color: 'hsl(var(--chart-1))' },
  { id: 'em_progresso', title: 'Em Progresso', color: 'hsl(var(--chart-2))' },
  { id: 'feito', title: 'Feito', color: 'hsl(var(--chart-4))' },
];

export default function Kanban() {
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null);
  const [selectedTarefa, setSelectedTarefa] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewTarefaDialogOpen, setIsViewTarefaDialogOpen] = useState(false);
  const [isEditTarefaDialogOpen, setIsEditTarefaDialogOpen] = useState(false);
  const [isAdicionarDialogOpen, setIsAdicionarDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("producao-legislativa"); // Default para produção legislativa
  const queryClient = useQueryClient();


  // Buscar demandas e tarefas do kanban
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-kanban', selectedUser],
    queryFn: async () => {
      // Buscar demandas do kanban
      const { data: kanbanData, error: kanbanError } = await supabase
        .from('demanda_kanbans')
        .select('demanda_id, kanban_position')
        .eq('kanban_type', selectedUser);
      
      if (kanbanError) {
        console.error('Erro ao buscar kanban:', kanbanError);
        throw kanbanError;
      }
      
      let demandasCompletas: any[] = [];
      
      if (kanbanData && kanbanData.length > 0) {
        // Buscar as demandas completas
        const demandaIds = kanbanData.map(k => k.demanda_id);
        const { data: demandasData, error: demandasError } = await supabase
          .from('demandas')
          .select(`
            *,
            areas(nome),
            municipes(nome)
          `)
          .in('id', demandaIds)
          .order('created_at', { ascending: false });
        
        if (demandasError) {
          console.error('Erro ao buscar demandas:', demandasError);
          throw demandasError;
        }
        
        // Combinar os dados das demandas
        demandasCompletas = demandasData?.map(demanda => {
          const kanbanInfo = kanbanData.find(k => k.demanda_id === demanda.id);
          return {
            ...demanda,
            kanban_position: kanbanInfo?.kanban_position || 'a_fazer',
            tipo: 'demanda'
          };
        }) || [];
      }
      
      // Buscar tarefas do kanban - incluir tarefas do usuário E tarefas atribuídas a ele
      let tarefasData: any[] = [];
      
      // Buscar tarefas com colaboradores
      const { data, error } = await supabase
        .from('tarefas')
        .select(`
          *,
          tarefa_colaboradores(
            colaborador:profiles(id, nome)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar tarefas:', error);
        throw error;
      }
      
      // Filtrar tarefas baseado no usuário selecionado
      if (selectedUser === "producao-legislativa") {
        // Para produção legislativa, mostrar tarefas deste tipo
        tarefasData = data?.filter(tarefa => tarefa.kanban_type === selectedUser) || [];
      } else {
         // Para usuários específicos, incluir tarefas onde:
         // 1. Ele é colaborador OU
         // 2. O kanban_type é dele (compatibilidade com tarefas antigas)
         tarefasData = data?.filter(tarefa => 
           tarefa.kanban_type === selectedUser ||
           tarefa.tarefa_colaboradores.some((tc: any) => tc.colaborador.id === selectedUser)
         ) || [];
      }
      
      // Combinar tarefas formatadas para o mesmo padrão das demandas
      const tarefasFormatadas = tarefasData?.map(tarefa => ({
        id: tarefa.id,
        titulo: tarefa.titulo,
        protocolo: `TAREFA-${tarefa.id.slice(0, 8)}`,
        descricao: tarefa.descricao || '',
        status: tarefa.completed ? 'resolvida' : 'aberta',
        kanban_position: tarefa.kanban_position,
        prioridade: tarefa.prioridade,
        data_prazo: null,
        created_at: tarefa.created_at,
        responsavel_id: tarefa.responsavel_id || tarefa.created_by,
        tipo: 'tarefa' as const,
        cor: tarefa.cor || '#3B82F6',
        colaboradores: tarefa.tarefa_colaboradores?.map((tc: any) => tc.colaborador) || []
      })) || [];
      
      // Combinar demandas e tarefas
      return [...demandasCompletas, ...tarefasFormatadas];
    }
  });

  // Buscar responsáveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar responsáveis:', error);
        throw error;
      }
      return data || [];
    }
  });

  // Detectar parâmetro de tarefa na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tarefaId = urlParams.get('tarefa');
    
    if (tarefaId && demandas.length > 0) {
      const tarefa = demandas.find(d => d.id === tarefaId && d.tipo === 'tarefa');
      if (tarefa) {
        setSelectedTarefa(tarefa);
        setIsViewTarefaDialogOpen(true);
        // Limpar parâmetro da URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [demandas]);

  // Mutation para limpar kanban (demandas e tarefas)
  const limparKanbanMutation = useMutation({
    mutationFn: async () => {
      console.log("🔄 Iniciando limpeza do kanban...");
      
      // Remover todas as entradas do kanban selecionado
      const { data: kanbanEntries, error: fetchError } = await supabase
        .from('demanda_kanbans')
        .select('id')
        .eq('kanban_type', selectedUser);
      
      if (fetchError) {
        console.error("❌ Erro ao buscar entradas do kanban:", fetchError);
        throw fetchError;
      }
      
      if (kanbanEntries && kanbanEntries.length > 0) {
        const { error } = await supabase
          .from('demanda_kanbans')
          .delete()
          .eq('kanban_type', selectedUser);
        
        if (error) {
          console.error("❌ Erro ao remover entradas do kanban:", error);
          throw error;
        }
      }
      
      // Remover todas as tarefas do kanban selecionado
      let tarefasEntries: any[] = [];
      
      if (selectedUser === "producao-legislativa") {
        // Para produção legislativa, remover apenas tarefas deste tipo
        const { data, error } = await supabase
          .from('tarefas')
          .select('id')
          .eq('kanban_type', selectedUser);
        
        if (error) {
          console.error("❌ Erro ao buscar tarefas de produção legislativa:", error);
          throw error;
        }
        tarefasEntries = data || [];
      } else {
        // Para usuários específicos, buscar tarefas onde ele é criador, colaborador ou o kanban_type é dele
        const { data, error } = await supabase
          .from('tarefas')
          .select(`
            id,
            created_by,
            kanban_type,
            tarefa_colaboradores(colaborador_id)
          `);
        
        if (error) {
          console.error("❌ Erro ao buscar tarefas do usuário:", error);
          throw error;
        }
        
        // Filtrar tarefas que pertencem ao usuário
        tarefasEntries = data?.filter(tarefa => 
          tarefa.kanban_type === selectedUser ||
          tarefa.tarefa_colaboradores.some((tc: any) => tc.colaborador_id === selectedUser)
        ) || [];
      }
      
      if (tarefasEntries && tarefasEntries.length > 0) {
        // Deletar as tarefas encontradas
        const tarefaIds = tarefasEntries.map(t => t.id);
        const { error } = await supabase
          .from('tarefas')
          .delete()
          .in('id', tarefaIds);
        
        if (error) {
          console.error("❌ Erro ao remover tarefas:", error);
          throw error;
        }
      }
      
      console.log("✅ Kanban limpo com sucesso!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      toast.success("Kanban limpo com sucesso!");
    },
    onError: (error) => {
      console.error('❌ Erro ao limpar kanban:', error);
      toast.error(`Erro ao limpar kanban: ${error.message}`);
    }
  });

  // Mutation para remover demanda do kanban
  const removerDemandaMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase
        .from('demanda_kanbans')
        .delete()
        .eq('demanda_id', demandaId)
        .eq('kanban_type', selectedUser);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      toast.success("Demanda removida do kanban!");
    },
    onError: (error) => {
      console.error('Erro ao remover demanda:', error);
      toast.error("Erro ao remover demanda");
    }
  });

  // Mutation para remover tarefa
  const removerTarefaMutation = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase
        .from('tarefas')
        .delete()
        .eq('id', tarefaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      toast.success("Tarefa removida!");
    },
    onError: (error) => {
      console.error('Erro ao remover tarefa:', error);
      toast.error("Erro ao remover tarefa");
    }
  });

  // Mutation para atualizar posição no kanban (demandas e tarefas)
  const updateKanbanPositionMutation = useMutation({
    mutationFn: async ({ itemId, newPosition, tipo }: { itemId: string; newPosition: string; tipo: 'demanda' | 'tarefa' }) => {
      if (tipo === 'tarefa') {
        const { error } = await supabase
          .from('tarefas')
          .update({ kanban_position: newPosition })
          .eq('id', itemId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('demanda_kanbans')
          .update({ kanban_position: newPosition })
          .eq('demanda_id', itemId)
          .eq('kanban_type', selectedUser);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      toast.success("Posição atualizada!");
    },
    onError: (error) => {
      console.error('Erro ao atualizar posição:', error);
      toast.error("Erro ao atualizar posição");
    }
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const itemId = result.draggableId;
    const sourcePosition = result.source.droppableId;
    const destinationPosition = result.destination.droppableId;

    if (sourcePosition === destinationPosition) return;

    // Descobrir se é demanda ou tarefa
    const item = demandas.find(d => d.id === itemId);
    const tipo = item?.tipo || 'demanda';

    updateKanbanPositionMutation.mutate({ 
      itemId, 
      newPosition: destinationPosition,
      tipo
    });
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))';
      case 'media': return 'hsl(var(--chart-2))';
      case 'alta': return 'hsl(var(--chart-1))';
      case 'urgente': return 'hsl(var(--chart-5))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return prioridade;
    }
  };

  const isOverdue = (dataPrazo: string | null) => {
    if (!dataPrazo) return false;
    const today = new Date();
    const prazo = new Date(dataPrazo);
    return today > prazo;
  };

  const getResponsavelNome = (responsavelId: string | undefined) => {
    if (!responsavelId) return '';
    const responsavel = responsaveis.find(r => r.id === responsavelId);
    return responsavel?.nome || '';
  };

  const getDemandsByStatus = (kanbanPosition: string) => {
    return demandas.filter((item: Demanda) => item.kanban_position === kanbanPosition);
  };

  const handleEditDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleEditTarefa = (tarefa: any) => {
    setSelectedTarefa(tarefa);
    setIsViewTarefaDialogOpen(false);
    setIsEditTarefaDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando kanban...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-foreground">Kanban</h1>
              
              {/* Dropdown de seleção de usuário */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[200px] justify-between bg-background/50 backdrop-blur border shadow-sm hover:shadow-md">
                    {selectedUser === "producao-legislativa" 
                      ? "Produção Legislativa" 
                      : responsaveis.find(r => r.id === selectedUser)?.nome || "Selecionar usuário"
                    }
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px] bg-background/95 backdrop-blur border shadow-lg">
                  <DropdownMenuItem 
                    onClick={() => setSelectedUser("producao-legislativa")}
                    className={selectedUser === "producao-legislativa" ? "bg-accent text-accent-foreground" : ""}
                  >
                    Produção Legislativa
                  </DropdownMenuItem>
                  {responsaveis.map((user) => (
                    <DropdownMenuItem 
                      key={user.id}
                      onClick={() => setSelectedUser(user.id)}
                      className={selectedUser === user.id ? "bg-accent text-accent-foreground" : ""}
                    >
                      {user.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <p className="text-muted-foreground">
              {selectedUser === "producao-legislativa" 
                ? "Organize o fluxo das demandas na produção legislativa (independente do status real)"
                : `Kanban pessoal de ${responsaveis.find(r => r.id === selectedUser)?.nome || "usuário"}`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={limparKanbanMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {limparKanbanMutation.isPending ? 'Limpando...' : 'Limpar Kanban'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Confirmar limpeza do kanban{" "}
                    {selectedUser === "producao-legislativa" 
                      ? "de Produção Legislativa"
                      : `de ${responsaveis.find(r => r.id === selectedUser)?.nome || "usuário"}`
                    }
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá todas as demandas do kanban{" "}
                    <strong>
                      {selectedUser === "producao-legislativa" 
                        ? "de Produção Legislativa"
                        : `pessoal de ${responsaveis.find(r => r.id === selectedUser)?.nome || "usuário"}`
                      }
                    </strong>. 
                    <br />
                    As demandas voltarão para a lista geral e poderão ser adicionadas novamente quando necessário.
                    Esta ação não pode ser desfeita.
                    <br /><br />
                    <strong>Demandas que serão removidas deste kanban:</strong>
                    <br />
                    • A Fazer: {getDemandsByStatus('a_fazer').length} demandas
                    <br />
                    • Em Progresso: {getDemandsByStatus('em_progresso').length} demandas
                    <br />
                    • Feito: {getDemandsByStatus('feito').length} demandas
                    <br />
                    • <strong>Total: {demandas.length} demandas</strong>
                    <br /><br />
                    <em>Outros kanbans não serão afetados.</em>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => limparKanbanMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={limparKanbanMutation.isPending}
                  >
                    {limparKanbanMutation.isPending ? 'Limpando...' : 'Limpar Kanban'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AdicionarTarefaDialog kanbanType={selectedUser} />
            <Button onClick={() => setIsAdicionarDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Demanda
            </Button>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statusColumns.map((column) => {
              const columnDemandas = getDemandsByStatus(column.id);
              
              return (
                <div key={column.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 
                      className="text-lg font-semibold text-foreground flex items-center gap-2"
                      style={{ borderLeftColor: column.color, borderLeftWidth: '4px', paddingLeft: '12px' }}
                    >
                      {column.title}
                      <Badge variant="secondary" className="text-xs">
                        {columnDemandas.length}
                      </Badge>
                    </h2>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[300px] space-y-3 p-3 rounded-lg border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted-foreground/20'
                        }`}
                      >
                        {columnDemandas.map((demanda, index) => (
                          <Draggable
                            key={demanda.id}
                            draggableId={demanda.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-pointer transition-all duration-200 hover:shadow-md relative group border-l-4 ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''
                                }`}
                                style={{
                                  borderLeftColor: demanda.tipo === 'tarefa' ? (demanda as any).cor || '#3B82F6' : 'hsl(var(--primary))',
                                  ...provided.draggableProps.style
                                }}
                                onClick={() => {
                                  if (demanda.tipo === 'tarefa') {
                                    setSelectedTarefa(demanda);
                                    setIsViewTarefaDialogOpen(true);
                                  } else {
                                    setSelectedDemanda(demanda);
                                    setIsViewDialogOpen(true);
                                  }
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (demanda.tipo === 'tarefa') {
                                      removerTarefaMutation.mutate(demanda.id);
                                    } else {
                                      removerDemandaMutation.mutate(demanda.id);
                                    }
                                  }}
                                  disabled={removerDemandaMutation.isPending || removerTarefaMutation.isPending}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                
                                <CardHeader className="pb-2">
                                   <div className="flex items-start justify-between gap-2">
                                     <div className="flex items-center gap-2 flex-1">
                                       <CardTitle className="text-sm font-medium line-clamp-2">
                                         {demanda.titulo}
                                       </CardTitle>
                                       {demanda.tipo === 'tarefa' && (
                                         <Badge variant="secondary" className="text-xs shrink-0 bg-blue-100 text-blue-700">
                                           Tarefa
                                         </Badge>
                                       )}
                                     </div>
                                     <Badge variant="outline" className="text-xs shrink-0">
                                       #{demanda.protocolo}
                                     </Badge>
                                   </div>
                                </CardHeader>
                                
                                <CardContent className="pt-0 space-y-2">
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {demanda.descricao}
                                  </p>
                                  
                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs"
                                      style={{ 
                                        borderColor: getPrioridadeColor(demanda.prioridade),
                                        color: getPrioridadeColor(demanda.prioridade)
                                      }}
                                    >
                                      {getPrioridadeLabel(demanda.prioridade)}
                                    </Badge>
                                    
                                    {isOverdue(demanda.data_prazo) && (
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    {demanda.areas?.nome && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{demanda.areas.nome}</span>
                                      </div>
                                    )}
                                    
                                    {demanda.municipes?.nome && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">{demanda.municipes.nome}</span>
                                      </div>
                                    )}

                                    {demanda.tipo === 'tarefa' && (demanda as any).colaboradores?.length > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">
                                          Colaboradores: {(demanda as any).colaboradores.map((c: any) => c.nome).join(', ')}
                                        </span>
                                      </div>
                                    )}

                                    {demanda.tipo !== 'tarefa' && demanda.responsavel_id && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">
                                          Resp: {getResponsavelNome(demanda.responsavel_id)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {demanda.data_prazo && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>Prazo: {formatDateTime(demanda.data_prazo).split(' ')[0]}</span>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {columnDemandas.length === 0 && (
                          <div className="flex items-center justify-center h-32 text-muted-foreground">
                            <p className="text-sm">Nenhuma demanda nesta coluna</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

        {/* Dialogs */}
        {selectedDemanda && (
          <ViewDemandaDialog
            demanda={selectedDemanda}
            open={isViewDialogOpen}
            onOpenChange={setIsViewDialogOpen}
            onEdit={handleEditDemanda}
          />
        )}

        {selectedDemanda && (
          <EditDemandaDialog
            demanda={selectedDemanda}
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
              }
            }}
          />
        )}

        {/* Dialogs de Tarefa */}
        {selectedTarefa && (
          <ViewTarefaDialog
            tarefa={selectedTarefa}
            open={isViewTarefaDialogOpen}
            onOpenChange={setIsViewTarefaDialogOpen}
            onEdit={handleEditTarefa}
          />
        )}

        {selectedTarefa && (
          <EditTarefaDialog
            tarefa={selectedTarefa}
            open={isEditTarefaDialogOpen}
            onOpenChange={(open) => {
              setIsEditTarefaDialogOpen(open);
              if (!open) {
                queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
              }
            }}
          />
        )}

        <AdicionarDemandasKanbanDialog
          open={isAdicionarDialogOpen}
          selectedUser={selectedUser}
          onOpenChange={(open) => {
            setIsAdicionarDialogOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
            }
          }}
        />
      </div>
    </div>
  );
}