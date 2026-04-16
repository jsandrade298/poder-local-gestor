import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Settings, MoreHorizontal, Calendar, User, AlertTriangle, Pencil, Archive, CheckSquare, MessageSquare } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useKanbanBoardCards, useKanbanBoardColunas, KanbanBoard, KanbanBoardCard, KanbanBoardColuna } from "@/hooks/useKanbanBoards";
import { useBoardCardCounts } from "@/hooks/useBoardCardExtras";
import { BoardColumnConfig } from "./BoardColumnConfig";
import { BoardCardDialog } from "./BoardCardDialog";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { formatDateOnly } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKanbanBoards } from "@/hooks/useKanbanBoards";

interface BoardViewProps {
  board: KanbanBoard;
  onBack: () => void;
}

export function BoardView({ board, onBack }: BoardViewProps) {
  const { colunas, isLoading: isLoadingColunas } = useKanbanBoardColunas(board.id);
  const { cards, moveCard } = useKanbanBoardCards(board.id);
  const { archiveBoard } = useKanbanBoards();
  const { checklist: checklistCounts, comentarios: comentariosCounts } = useBoardCardCounts(board.id);

  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanBoardCard | null>(null);
  const [defaultColunaId, setDefaultColunaId] = useState<string>("");
  const [isEditBoardOpen, setIsEditBoardOpen] = useState(false);

  // Buscar responsáveis para exibir nomes nos cards
  const { data: responsaveis = [] } = useQuery({
    queryKey: ['usuarios-gabinete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .neq('role_no_tenant', 'representante')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const getResponsavelNome = (id: string | null) => {
    if (!id) return null;
    return responsaveis.find(r => r.id === id)?.nome || null;
  };

  const getPrioridadeColor = (p: string) => {
    switch (p) {
      case 'baixa': return '#22c55e';
      case 'media': return '#f59e0b';
      case 'alta': return '#ef4444';
      case 'urgente': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const isOverdue = (prazo: string | null) => {
    if (!prazo) return false;
    return new Date(prazo + 'T23:59:59') < new Date();
  };

  // Agrupar cards por coluna
  const cardsByColumn = colunas.reduce<Record<string, KanbanBoardCard[]>>((acc, col) => {
    acc[col.id] = cards
      .filter(c => c.coluna_id === col.id)
      .sort((a, b) => a.ordem - b.ordem);
    return acc;
  }, {});

  // Drag & Drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newColunaId = destination.droppableId;
    const newOrdem = destination.index;

    moveCard.mutate({
      cardId: draggableId,
      colunaId: newColunaId,
      ordem: newOrdem,
    });
  };

  const handleOpenNewCard = (colunaId?: string) => {
    setSelectedCard(null);
    setDefaultColunaId(colunaId || colunas[0]?.id || "");
    setIsCardDialogOpen(true);
  };

  const handleOpenCard = (card: KanbanBoardCard) => {
    setSelectedCard(card);
    setDefaultColunaId(card.coluna_id);
    setIsCardDialogOpen(true);
  };

  if (isLoadingColunas) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Projetos</span>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xl">{board.icone}</span>
            <h2 className="text-lg font-semibold">{board.nome}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => handleOpenNewCard()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Card</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsColumnConfigOpen(true)} className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Colunas</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditBoardOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar board
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => archiveBoard.mutate(board.id, { onSuccess: onBack })}
                className="text-red-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Arquivar board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Board com colunas ── */}
      {colunas.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">Nenhuma coluna configurada.</p>
          <Button onClick={() => setIsColumnConfigOpen(true)} variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurar Colunas
          </Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
            {colunas.map((coluna) => (
              <div key={coluna.id} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coluna.cor }} />
                    <h3 className="text-sm font-semibold text-foreground">{coluna.nome}</h3>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {(cardsByColumn[coluna.id] || []).length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleOpenNewCard(coluna.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Droppable column */}
                <Droppable droppableId={coluna.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2.5 min-h-[100px] p-2 rounded-xl transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-primary/5 ring-2 ring-primary/20'
                          : 'bg-muted/30'
                      }`}
                    >
                      {(cardsByColumn[coluna.id] || []).map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleOpenCard(card)}
                              className={`cursor-pointer ${snapshot.isDragging ? 'rotate-2 scale-105' : ''}`}
                            >
                              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                {/* Cover colorida */}
                                <div className="h-1" style={{ backgroundColor: card.cor || '#3b82f6' }} />
                                <CardContent className="p-3 space-y-2">
                                  <p className="text-sm font-medium text-foreground leading-snug">
                                    {card.titulo}
                                  </p>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] h-4 px-1.5"
                                      style={{
                                        backgroundColor: getPrioridadeColor(card.prioridade) + '20',
                                        color: getPrioridadeColor(card.prioridade),
                                      }}
                                    >
                                      {card.prioridade === 'baixa' ? 'Baixa' :
                                       card.prioridade === 'media' ? 'Média' :
                                       card.prioridade === 'alta' ? 'Alta' : 'Urgente'}
                                    </Badge>

                                    {card.data_prazo && (
                                      <span className={`flex items-center gap-1 text-[10px] ${
                                        isOverdue(card.data_prazo) ? 'text-red-600 font-medium' : 'text-muted-foreground'
                                      }`}>
                                        {isOverdue(card.data_prazo) && <AlertTriangle className="h-3 w-3" />}
                                        <Calendar className="h-3 w-3" />
                                        {formatDateOnly(card.data_prazo)}
                                      </span>
                                    )}
                                  </div>

                                  {getResponsavelNome(card.responsavel_id) && (
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <User className="h-3 w-3" />
                                      {getResponsavelNome(card.responsavel_id)}
                                    </div>
                                  )}

                                  {/* Indicadores de checklist e comentários */}
                                  {((checklistCounts[card.id]?.total || 0) > 0 || (comentariosCounts[card.id] || 0) > 0) && (
                                    <div className="flex items-center gap-3 pt-1 border-t border-border/30">
                                      {(checklistCounts[card.id]?.total || 0) > 0 && (
                                        <div className={`flex items-center gap-1 text-[10px] ${
                                          checklistCounts[card.id]?.done === checklistCounts[card.id]?.total
                                            ? 'text-green-600' : 'text-muted-foreground'
                                        }`}>
                                          <CheckSquare className="h-3 w-3" />
                                          {checklistCounts[card.id]?.done}/{checklistCounts[card.id]?.total}
                                        </div>
                                      )}
                                      {(comentariosCounts[card.id] || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <MessageSquare className="h-3 w-3" />
                                          {comentariosCounts[card.id]}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* ── Dialogs ── */}
      <BoardColumnConfig
        open={isColumnConfigOpen}
        onOpenChange={setIsColumnConfigOpen}
        boardId={board.id}
      />

      <BoardCardDialog
        open={isCardDialogOpen}
        onOpenChange={setIsCardDialogOpen}
        boardId={board.id}
        card={selectedCard}
        defaultColunaId={defaultColunaId}
      />

      <CreateBoardDialog
        open={isEditBoardOpen}
        onOpenChange={setIsEditBoardOpen}
        editingBoard={board}
      />
    </div>
  );
}
