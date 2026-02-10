import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar, MapPin, User, AlertTriangle, Trash2, X, ChevronDown, CheckSquare, MessageSquare, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateTime, formatDateOnly } from '@/lib/dateUtils';
import { logError } from '@/lib/errorUtils';
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
  tipo?: 'demanda' | 'tarefa';
  tarefa_responsavel_id?: string;
  eixo_id?: string;
  checklist_total?: number;
  checklist_done?: number;
  comentarios_count?: number;
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
  const [selectedUser, setSelectedUser] = useState<string>("producao-legislativa");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isDraggingRef = useRef(false);
  
  // Ref para controlar se já processamos o parâmetro da URL
  const processedTaskIdRef = useRef<string | null>(null);
  // Ref para prevenir processamento durante o fechamento do modal
  const isClosingModalRef = useRef(false);

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
        logError('Erro ao buscar kanban:', kanbanError);
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
          logError('Erro ao buscar demandas:', demandasError);
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
      
      // Buscar tarefas do kanban
      let tarefasData: any[] = [];
      
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
        logError('Erro ao buscar tarefas:', error);
        throw error;
      }
      
      // Filtrar tarefas baseado no usuário selecionado
      if (selectedUser === "producao-legislativa") {
        tarefasData = data?.filter(tarefa => tarefa.kanban_type === selectedUser) || [];
      } else {
        tarefasData = data?.filter(tarefa => 
          tarefa.kanban_type === selectedUser ||
          tarefa.tarefa_colaboradores.some((tc: any) => tc.colaborador.id === selectedUser)
        ) || [];
      }

      // ── Batch fetch checklist counts para todas as tarefas ──
      const tarefaIds = tarefasData.map(t => t.id);
      let checklistCounts: Record<string, { total: number; done: number }> = {};
      let commentCounts: Record<string, number> = {};

      if (tarefaIds.length > 0) {
        // Checklist items
        const { data: checklistData } = await supabase
          .from('tarefa_checklist_items')
          .select('tarefa_id, concluido')
          .in('tarefa_id', tarefaIds);

        if (checklistData) {
          for (const item of checklistData) {
            if (!checklistCounts[item.tarefa_id]) {
              checklistCounts[item.tarefa_id] = { total: 0, done: 0 };
            }
            checklistCounts[item.tarefa_id].total++;
            if (item.concluido) checklistCounts[item.tarefa_id].done++;
          }
        }

        // Comentários count
        const { data: commentData } = await supabase
          .from('tarefa_comentarios')
          .select('tarefa_id')
          .in('tarefa_id', tarefaIds);

        if (commentData) {
          for (const item of commentData) {
            commentCounts[item.tarefa_id] = (commentCounts[item.tarefa_id] || 0) + 1;
          }
        }
      }
      
      // Combinar tarefas formatadas
      const tarefasFormatadas = tarefasData?.map(tarefa => ({
        id: tarefa.id,
        titulo: tarefa.titulo,
        protocolo: `TAREFA-${tarefa.id.slice(0, 8)}`,
        descricao: tarefa.descricao || '',
        status: tarefa.completed ? 'atendido' : 'solicitada',
        kanban_position: tarefa.kanban_position,
        prioridade: tarefa.prioridade,
        data_prazo: tarefa.data_prazo || null,
        created_at: tarefa.created_at,
        responsavel_id: tarefa.responsavel_id || tarefa.created_by,
        tipo: 'tarefa' as const,
        cor: tarefa.cor || '#3B82F6',
        colaboradores: tarefa.tarefa_colaboradores?.map((tc: any) => tc.colaborador) || [],
        checklist_total: checklistCounts[tarefa.id]?.total || 0,
        checklist_done: checklistCounts[tarefa.id]?.done || 0,
        comentarios_count: commentCounts[tarefa.id] || 0,
      })) || [];
      
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
        logError('Erro ao buscar responsáveis:', error);
        throw error;
      }
      return data || [];
    }
  });

  // Detectar redirecionamento de notificação
  useEffect(() => {
    const tarefaId = searchParams.get('tarefa');
    
    // Se estamos fechando o modal, não processar
    if (isClosingModalRef.current) {
      return;
    }
    
    // Verificar se há tarefa ID na URL e se ainda não foi processado
    if (tarefaId && tarefaId !== processedTaskIdRef.current && demandas.length > 0) {
      console.log('🔍 Processando tarefa da notificação:', tarefaId);
      
      // Marcar como processado IMEDIATAMENTE
      processedTaskIdRef.current = tarefaId;
      
      // Limpar o parâmetro da URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('tarefa');
      setSearchParams(newSearchParams, { replace: true });
      
      // Buscar a tarefa nos dados atuais
      const tarefaEncontrada = demandas.find(d => d.id === tarefaId && d.tipo === 'tarefa');
      
      if (tarefaEncontrada) {
        console.log('✅ Tarefa encontrada, abrindo modal');
        setSelectedTarefa(tarefaEncontrada);
        setIsViewTarefaDialogOpen(true);
      } else {
        console.log('🔄 Tarefa não encontrada no kanban atual, verificando se precisa mudar usuário');
        
        // Buscar a tarefa e ajustar o selectedUser se necessário
        const buscarTarefaEspecifica = async () => {
          try {
            const { data: user } = await supabase.auth.getUser();
            if (!user?.user?.id) return;
            
            const { data: tarefa, error } = await supabase
              .from('tarefas')
              .select(`
                *,
                tarefa_colaboradores(colaborador_id)
              `)
              .eq('id', tarefaId)
              .single();
            
            if (error || !tarefa) {
              console.log('❌ Tarefa não existe no banco');
              toast.error("Tarefa não encontrada");
              return;
            }
            
            // Verificar se o usuário atual é colaborador
            const isColaborador = tarefa.tarefa_colaboradores?.some(
              (tc: any) => tc.colaborador_id === user.user.id
            );
            
            // Determinar o selectedUser correto
            const selectedUserCorreto = isColaborador ? user.user.id : tarefa.kanban_type;
            
            // Se o selectedUser atual não é o correto, ajustar
            if (selectedUserCorreto !== selectedUser) {
              console.log('🔄 Mudando selectedUser para:', selectedUserCorreto);
              setSelectedUser(selectedUserCorreto);
            } else {
              toast.error("Tarefa não encontrada neste kanban");
            }
            
          } catch (error) {
            logError('Erro ao processar redirecionamento:', error);
            toast.error("Erro ao abrir tarefa");
          }
        };
        
        buscarTarefaEspecifica();
      }
    }
    
    // Se o parâmetro foi removido, limpar a referência
    if (!tarefaId && processedTaskIdRef.current) {
      processedTaskIdRef.current = null;
    }
  }, [searchParams, demandas, selectedUser]);

  // Função para fechar o modal de tarefa com controle
  const handleCloseViewTarefaDialog = (open: boolean) => {
    if (!open) {
      isClosingModalRef.current = true;
      setIsViewTarefaDialogOpen(false);
      setSelectedTarefa(null);
      
      // Limpar o parâmetro da URL se ainda existir
      const tarefaId = searchParams.get('tarefa');
      if (tarefaId) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('tarefa');
        setSearchParams(newSearchParams, { replace: true });
      }
      
      // Resetar flag após um pequeno delay
      setTimeout(() => {
        isClosingModalRef.current = false;
      }, 100);
    } else {
      setIsViewTarefaDialogOpen(true);
    }
  };

  // Mutation para limpar kanban
  const limparKanbanMutation = useMutation({
    mutationFn: async () => {
      const { data: kanbanEntries, error: fetchError } = await supabase
        .from('demanda_kanbans')
        .select('id')
        .eq('kanban_type', selectedUser);
      
      if (fetchError) throw fetchError;
      
      if (kanbanEntries && kanbanEntries.length > 0) {
        const { error } = await supabase
          .from('demanda_kanbans')
          .delete()
          .eq('kanban_type', selectedUser);
        
        if (error) throw error;
      }
      
      // Remover tarefas
      let tarefasEntries: any[] = [];
      
      if (selectedUser === "producao-legislativa") {
        const { data, error } = await supabase
          .from('tarefas')
          .select('id')
          .eq('kanban_type', selectedUser);
        
        if (error) throw error;
        tarefasEntries = data || [];
      } else {
        const { data, error } = await supabase
          .from('tarefas')
          .select(`
            id,
            created_by,
            kanban_type,
            tarefa_colaboradores(colaborador_id)
          `);
        
        if (error) throw error;
        
        tarefasEntries = data?.filter(tarefa => 
          tarefa.kanban_type === selectedUser ||
          tarefa.tarefa_colaboradores.some((tc: any) => tc.colaborador_id === selectedUser)
        ) || [];
      }
      
      if (tarefasEntries && tarefasEntries.length > 0) {
        const tarefaIds = tarefasEntries.map(t => t.id);
        const { error } = await supabase
          .from('tarefas')
          .delete()
          .in('id', tarefaIds);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      toast.success("Kanban limpo com sucesso!");
    },
    onError: (error) => {
      logError('Erro ao limpar kanban:', error);
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
      logError('Erro ao remover demanda:', error);
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
      logError('Erro ao remover tarefa:', error);
      toast.error("Erro ao remover tarefa");
    }
  });

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
    today.setHours(0, 0, 0, 0);
    const prazo = new Date(dataPrazo.includes('T') ? dataPrazo : dataPrazo + 'T12:00:00');
    return today > prazo;
  };

  const getResponsavelNome = (responsavelId: string | undefined) => {
    if (!responsavelId) return '';
    const responsavel = responsaveis.find(r => r.id === responsavelId);
    return responsavel?.nome || '';
  };

  // Mutation para atualizar posição do item no kanban
  const updatePositionMutation = useMutation({
    mutationFn: async ({ itemId, newPosition, tipo }: { itemId: string, newPosition: string, tipo: string }) => {
      if (tipo === 'tarefa') {
        const { error } = await supabase
          .from('tarefas')
          .update({ kanban_position: newPosition })
          .eq('id', itemId);
        
        if (error) throw error;
      } else {
        // Para demandas, atualizar na tabela demanda_kanbans
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
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    },
    onError: (error) => {
      logError('Erro ao atualizar posição:', error);
      toast.error("Erro ao atualizar posição do item");
      // Reset flag em caso de erro
      isDraggingRef.current = false;
    }
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    isDraggingRef.current = true;

    if (!destination) {
      isDraggingRef.current = false;
      return;
    }
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      isDraggingRef.current = false;
      return;
    }

    const item = demandas.find(d => d.id === draggableId);
    if (!item) {
      isDraggingRef.current = false;
      return;
    }

    updatePositionMutation.mutate({
      itemId: draggableId,
      newPosition: destination.droppableId,
      tipo: item.tipo || 'demanda'
    });
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
              
              <div className="flex items-center gap-3">
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
                      className={selectedUser === "producao-legislativa" ? "bg-accent" : ""}
                    >
                      Produção Legislativa
                    </DropdownMenuItem>
                    {responsaveis.map((responsavel) => (
                      <DropdownMenuItem 
                        key={responsavel.id}
                        onClick={() => setSelectedUser(responsavel.id)}
                        className={selectedUser === responsavel.id ? "bg-accent" : ""}
                      >
                        {responsavel.nome}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-muted-foreground">
              Visualize e gerencie as tarefas e demandas em formato kanban
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AdicionarTarefaDialog 
              kanbanType={selectedUser}
            />
            
            <Button 
              onClick={() => setIsAdicionarDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Demanda
            </Button>
            
            <AdicionarDemandasKanbanDialog 
              open={isAdicionarDialogOpen}
              onOpenChange={setIsAdicionarDialogOpen}
              selectedUser={selectedUser}
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Limpar Kanban
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar limpeza do kanban</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover todas as demandas e tarefas deste kanban. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => limparKanbanMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statusColumns.map((column) => {
              const columnDemandas = getDemandsByStatus(column.id);
              
              return (
                <div key={column.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: column.color }}
                      />
                      {column.title}
                      <Badge variant="secondary" className="ml-2">
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
                            ? 'border-primary/50 bg-primary/5' 
                            : 'border-muted-foreground/20'
                        }`}
                      >
                        {columnDemandas.map((demanda, index) => (
                          <Draggable key={demanda.id} draggableId={demanda.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-pointer transition-all duration-200 hover:shadow-md relative group border-l-4 ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2 z-50' : ''
                                }`}
                                style={{
                                  borderLeftColor: demanda.tipo === 'tarefa' ? (demanda as any).cor || '#3B82F6' : 'hsl(var(--primary))',
                                  ...provided.draggableProps.style
                                }}
                                onClick={() => {
                                  if (!snapshot.isDragging && !isDraggingRef.current) {
                                    if (demanda.tipo === 'tarefa') {
                                      setSelectedTarefa(demanda);
                                      setIsViewTarefaDialogOpen(true);
                                    } else {
                                      setSelectedDemanda(demanda);
                                      setIsViewDialogOpen(true);
                                    }
                                  }
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (demanda.tipo === 'tarefa') {
                                      removerTarefaMutation.mutate(demanda.id);
                                    } else {
                                      removerDemandaMutation.mutate(demanda.id);
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1">
                                      <CardTitle className="text-sm font-medium leading-tight">
                                        {demanda.titulo}
                                      </CardTitle>
                                      <p className="text-xs text-muted-foreground">
                                        {demanda.protocolo}
                                      </p>
                                    </div>
                                  </div>
                                </CardHeader>
                                
                                <CardContent className="pt-0 space-y-2">
                                  {demanda.descricao && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {demanda.descricao}
                                    </p>
                                  )}

                                  {/* ── Indicador de checklist (apenas tarefas) ── */}
                                  {demanda.tipo === 'tarefa' && (demanda as any).checklist_total > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <CheckSquare className="h-3 w-3" />
                                          <span>
                                            {(demanda as any).checklist_done}/{(demanda as any).checklist_total}
                                          </span>
                                        </div>
                                        <span>
                                          {Math.round(((demanda as any).checklist_done / (demanda as any).checklist_total) * 100)}%
                                        </span>
                                      </div>
                                      <Progress 
                                        value={Math.round(((demanda as any).checklist_done / (demanda as any).checklist_total) * 100)} 
                                        className="h-1.5" 
                                      />
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant="outline" 
                                      style={{ 
                                        borderColor: getPrioridadeColor(demanda.prioridade),
                                        color: getPrioridadeColor(demanda.prioridade)
                                      }}
                                      className="text-xs"
                                    >
                                      {getPrioridadeLabel(demanda.prioridade)}
                                    </Badge>
                                    
                                    {demanda.data_prazo && (
                                      <div className={`flex items-center gap-1 text-xs ${
                                        isOverdue(demanda.data_prazo) ? 'text-destructive' : 'text-muted-foreground'
                                      }`}>
                                        <Calendar className="h-3 w-3" />
                                        {formatDateOnly(demanda.data_prazo)}
                                        {isOverdue(demanda.data_prazo) && (
                                          <AlertTriangle className="h-3 w-3 ml-1" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    {demanda.areas?.nome && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {demanda.areas.nome}
                                      </div>
                                    )}
                                    
                                    {demanda.municipes?.nome && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {demanda.municipes.nome}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {getResponsavelNome(demanda.responsavel_id || demanda.tarefa_responsavel_id) && (
                                    <div className="text-xs text-muted-foreground">
                                      <strong>Responsável:</strong> {getResponsavelNome(demanda.responsavel_id || demanda.tarefa_responsavel_id)}
                                    </div>
                                  )}
                                  
                                  {demanda.tipo === 'tarefa' && (demanda as any).colaboradores?.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      <strong>Colaboradores:</strong> {(demanda as any).colaboradores.map((c: any) => c.nome).join(', ')}
                                    </div>
                                  )}

                                  {/* ── Badges de comentários (apenas tarefas com comentários) ── */}
                                  {demanda.tipo === 'tarefa' && (demanda as any).comentarios_count > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{(demanda as any).comentarios_count} comentário{(demanda as any).comentarios_count !== 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {columnDemandas.length === 0 && (
                          <div className="text-center text-muted-foreground py-8">
                            Nenhum item nesta coluna
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
        <ViewDemandaDialog
          demanda={selectedDemanda}
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          onEdit={() => handleEditDemanda(selectedDemanda!)}
        />

        <EditDemandaDialog
          demanda={selectedDemanda}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />

        <ViewTarefaDialog
          tarefa={selectedTarefa}
          open={isViewTarefaDialogOpen}
          onOpenChange={handleCloseViewTarefaDialog}
          onEdit={() => handleEditTarefa(selectedTarefa!)}
        />

        <EditTarefaDialog
          tarefa={selectedTarefa}
          open={isEditTarefaDialogOpen}
          onOpenChange={setIsEditTarefaDialogOpen}
        />
      </div>
    </div>
  );
}
