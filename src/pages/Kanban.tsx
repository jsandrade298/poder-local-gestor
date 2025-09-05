import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, User, AlertTriangle, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { formatDateTime } from '@/lib/dateUtils';
import { AdicionarDemandasKanbanDialog } from "@/components/forms/AdicionarDemandasKanbanDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";

interface Demanda {
  id: string;
  titulo: string;
  protocolo: string;
  descricao: string;
  status: string;
  prioridade: string;
  data_prazo: string | null;
  created_at: string;
  areas?: { nome: string };
  municipes?: { nome: string };
  responsavel_id?: string;
}

const statusColumns = [
  { id: 'aberta', title: 'A Fazer', color: 'hsl(var(--chart-1))' },
  { id: 'em_andamento', title: 'Em Progresso', color: 'hsl(var(--chart-2))' },
  { id: 'resolvida', title: 'Feito', color: 'hsl(var(--chart-4))' },
];

export default function Kanban() {
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAdicionarDialogOpen, setIsAdicionarDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome)
        `)
        .in('status', ['aberta', 'em_andamento', 'resolvida'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const limparKanbanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('demandas')
        .update({ status: 'aguardando' })
        .in('status', ['aberta', 'em_andamento', 'resolvida']);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      toast.success("Kanban limpo com sucesso!");
    },
    onError: (error) => {
      console.error('Erro ao limpar kanban:', error);
      toast.error("Erro ao limpar kanban");
    }
  });

  const removerDemandaKanbanMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase
        .from('demandas')
        .update({ status: 'aguardando' })
        .eq('id', demandaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      toast.success("Demanda removida do kanban!");
    },
    onError: (error) => {
      console.error('Erro ao remover demanda do kanban:', error);
      toast.error("Erro ao remover demanda do kanban");
    }
  });

  const handleDragEnd = (result: any) => {
    // Não alteramos o status da demanda, apenas permitimos o movimento visual
    return;
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

  const getDemandsByStatus = (status: string) => {
    return demandas.filter((demanda: Demanda) => demanda.status === status);
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
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kanban de Produção Legislativa</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o fluxo das demandas na produção legislativa
            </p>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Kanban
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar limpeza do kanban</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá todas as demandas do kanban, alterando seu status para "Aguardando". 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => limparKanbanMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar Kanban
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => setIsAdicionarDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
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
                        className={`min-h-[200px] space-y-3 p-2 rounded-lg border-2 border-dashed transition-colors ${
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
                                className={`cursor-pointer transition-all duration-200 hover:shadow-md relative group ${
                                  snapshot.isDragging ? 'shadow-lg rotate-3' : ''
                                }`}
                                onClick={() => {
                                  setSelectedDemanda(demanda);
                                  setIsViewDialogOpen(true);
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removerDemandaKanbanMutation.mutate(demanda.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-sm font-medium line-clamp-2">
                                      {demanda.titulo}
                                    </CardTitle>
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

                                    {demanda.responsavel_id && (
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
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

        {selectedDemanda && (
          <ViewDemandaDialog
            demanda={selectedDemanda}
            open={isViewDialogOpen}
            onOpenChange={setIsViewDialogOpen}
          />
        )}

        <AdicionarDemandasKanbanDialog
          open={isAdicionarDialogOpen}
          onOpenChange={setIsAdicionarDialogOpen}
        />
      </div>
    </div>
  );
}