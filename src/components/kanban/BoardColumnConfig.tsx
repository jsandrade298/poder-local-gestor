import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Save, X, Settings } from "lucide-react";
import { useKanbanBoardColunas, KanbanBoardColuna } from "@/hooks/useKanbanBoards";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const CORES = [
  "#6b7280", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16",
];

// ── Item arrastável ──
function SortableColunaItem({
  coluna, onDelete,
}: {
  coluna: KanbanBoardColuna;
  onDelete: (c: KanbanBoardColuna) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: coluna.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border rounded-lg ${isDragging ? "shadow-lg" : ""}`}
    >
      <button className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: coluna.cor }} />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{coluna.nome}</span>
      </div>
      <Button
        variant="ghost" size="icon"
        onClick={() => onDelete(coluna)}
        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Dialog principal ──
interface BoardColumnConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

export function BoardColumnConfig({ open, onOpenChange, boardId }: BoardColumnConfigProps) {
  const { colunas, createColuna, archiveColuna, reorderColunas } = useKanbanBoardColunas(boardId);

  const [showForm, setShowForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCor, setNewCor] = useState("#6b7280");
  const [localOrder, setLocalOrder] = useState<KanbanBoardColuna[]>([]);
  const [colunaToDelete, setColunaToDelete] = useState<KanbanBoardColuna | null>(null);

  // Sincronizar ordem local com dados do server
  if (colunas.length > 0 && localOrder.length === 0) setLocalOrder(colunas);
  if (colunas.length > 0 && localOrder.length > 0 && colunas.length !== localOrder.length) {
    setLocalOrder(colunas);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localOrder.findIndex(c => c.id === active.id);
      const newIndex = localOrder.findIndex(c => c.id === over.id);
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);
      reorderColunas.mutate(newOrder.map(c => c.id));
    }
  };

  const handleCreate = () => {
    if (!newNome.trim()) return;
    createColuna.mutate({ nome: newNome.trim(), cor: newCor });
    setNewNome("");
    setNewCor("#6b7280");
    setShowForm(false);
    setLocalOrder([]); // Force resync
  };

  const handleDelete = () => {
    if (colunaToDelete) {
      archiveColuna.mutate(colunaToDelete.id);
      setLocalOrder([]);
      setColunaToDelete(null);
    }
  };

  const displayList = localOrder.length > 0 ? localOrder : colunas;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Colunas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar. As colunas definem o fluxo do board.
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayList.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {displayList.map(coluna => (
                    <SortableColunaItem
                      key={coluna.id}
                      coluna={coluna}
                      onDelete={c => setColunaToDelete(c)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {showForm ? (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-2">
                  <Label>Nome da coluna</Label>
                  <Input
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Ex: Em Revisão"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {CORES.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setNewCor(cor)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          newCor === cor ? "border-gray-800 dark:border-white scale-110" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setNewNome(""); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={!newNome.trim() || createColuna.isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowForm(true)} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Coluna
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!colunaToDelete} onOpenChange={() => setColunaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a coluna "{colunaToDelete?.nome}"?
              Ela não pode conter cards ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
