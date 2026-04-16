import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Columns, FileText, Clock, Archive } from "lucide-react";
import { useKanbanBoards, KanbanBoard } from "@/hooks/useKanbanBoards";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BoardGalleryProps {
  onSelectBoard: (board: KanbanBoard) => void;
  onCreateBoard: () => void;
}

export function BoardGallery({ onSelectBoard, onCreateBoard }: BoardGalleryProps) {
  const { boards, isLoading } = useKanbanBoards();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">
          📂
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold">Nenhum projeto criado</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Crie o primeiro board de projeto para organizar o trabalho da equipe com colunas personalizáveis.
          </p>
        </div>
        <Button onClick={onCreateBoard} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar primeiro board
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Boards de Projeto</h2>
          <p className="text-sm text-muted-foreground">{boards.length} board(s) ativo(s)</p>
        </div>
        <Button onClick={onCreateBoard} className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Novo Board
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <Card
            key={board.id}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 border-0 shadow-sm overflow-hidden group"
            onClick={() => onSelectBoard(board)}
          >
            {/* Barra de cor no topo */}
            <div className="h-1.5" style={{ backgroundColor: board.cor }} />

            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: board.cor + '15' }}
                >
                  {board.icone}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{board.nome}</h3>
                  {board.descricao && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{board.descricao}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Columns className="h-3 w-3" />
                  {board.colunas_count || 0} colunas
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {board.cards_count || 0} cards
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>Criado por {board.criador_nome}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(board.updated_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
