import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Save,
  X,
  Bell,
  BellOff,
  Pencil,
} from "lucide-react";
import { useDemandaStatus, DemandaStatus } from "@/hooks/useDemandaStatus";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfigurarStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Cores predefinidas para escolha
const CORES_DISPONIVEIS = [
  { nome: "Cinza", valor: "#6b7280" },
  { nome: "Azul", valor: "#3b82f6" },
  { nome: "Verde", valor: "#22c55e" },
  { nome: "Amarelo", valor: "#f59e0b" },
  { nome: "Vermelho", valor: "#ef4444" },
  { nome: "Roxo", valor: "#8b5cf6" },
  { nome: "Rosa", valor: "#ec4899" },
  { nome: "Ciano", valor: "#06b6d4" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Lima", valor: "#84cc16" },
];

// Componente para item arrastável
function SortableStatusItem({
  status,
  onEdit,
  onDelete,
}: {
  status: DemandaStatus;
  onEdit: (status: DemandaStatus) => void;
  onDelete: (status: DemandaStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: status.cor }}
      />

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{status.nome}</div>
        <div className="text-xs text-gray-500 truncate">slug: {status.slug}</div>
      </div>

      {status.notificar_municipe ? (
        <Bell className="h-4 w-4 text-blue-500" title="Notifica munícipe" />
      ) : (
        <BellOff className="h-4 w-4 text-gray-300" title="Não notifica" />
      )}

      <Button variant="ghost" size="icon" onClick={() => onEdit(status)}>
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(status)}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Formulário de edição/criação
function StatusForm({
  status,
  onSave,
  onCancel,
  isLoading,
}: {
  status: Partial<DemandaStatus> | null;
  onSave: (data: Partial<DemandaStatus>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<DemandaStatus>>(
    status || {
      nome: "",
      slug: "",
      cor: "#6b7280",
      notificar_municipe: false,
    }
  );

  const isEditing = !!status?.id;

  const handleNomeChange = (nome: string) => {
    const newData: Partial<DemandaStatus> = { ...formData, nome };
    // Auto-gerar slug se não estiver editando
    if (!isEditing) {
      newData.slug = nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }
    setFormData(newData);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <h4 className="font-medium">
        {isEditing ? "Editar Status" : "Novo Status"}
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            value={formData.nome || ""}
            onChange={(e) => handleNomeChange(e.target.value)}
            placeholder="Ex: Em Análise"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Identificador (slug)</Label>
          <Input
            id="slug"
            value={formData.slug || ""}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="em_analise"
            disabled={isEditing}
            className={isEditing ? "bg-gray-100" : ""}
          />
          {isEditing && (
            <p className="text-xs text-gray-500">
              O identificador não pode ser alterado
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {CORES_DISPONIVEIS.map((cor) => (
            <button
              key={cor.valor}
              type="button"
              onClick={() => setFormData({ ...formData, cor: cor.valor })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.cor === cor.valor
                  ? "border-gray-800 scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: cor.valor }}
              title={cor.nome}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="notificar">Notificar munícipe</Label>
          <p className="text-xs text-gray-500">
            Enviar WhatsApp quando a demanda entrar neste status
          </p>
        </div>
        <Switch
          id="notificar"
          checked={formData.notificar_municipe || false}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, notificar_municipe: checked })
          }
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button
          onClick={() => onSave(formData)}
          disabled={!formData.nome || isLoading}
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export function ConfigurarStatusDialog({
  open,
  onOpenChange,
}: ConfigurarStatusDialogProps) {
  const {
    allStatusList,
    isLoadingAll,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatus,
  } = useDemandaStatus();

  const [editingStatus, setEditingStatus] = useState<Partial<DemandaStatus> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<DemandaStatus | null>(null);
  const [localOrder, setLocalOrder] = useState<DemandaStatus[]>([]);

  // Sincronizar ordem local com dados do servidor
  useState(() => {
    if (allStatusList.length > 0) {
      setLocalOrder(allStatusList);
    }
  });

  // Atualizar ordem local quando dados mudarem
  if (allStatusList.length > 0 && localOrder.length === 0) {
    setLocalOrder(allStatusList);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOrder.findIndex((s) => s.id === active.id);
      const newIndex = localOrder.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Salvar nova ordem no servidor
      reorderStatus.mutate(newOrder.map((s) => s.id));
    }
  };

  const handleEdit = (status: DemandaStatus) => {
    setEditingStatus(status);
    setShowForm(true);
  };

  const handleDelete = (status: DemandaStatus) => {
    setStatusToDelete(status);
  };

  const confirmDelete = () => {
    if (statusToDelete) {
      deleteStatus.mutate(statusToDelete.id);
      setStatusToDelete(null);
    }
  };

  const handleSave = (data: Partial<DemandaStatus>) => {
    if (editingStatus?.id) {
      updateStatus.mutate({ id: editingStatus.id, ...data });
    } else {
      createStatus.mutate(data);
    }
    setShowForm(false);
    setEditingStatus(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStatus(null);
  };

  const handleAddNew = () => {
    setEditingStatus(null);
    setShowForm(true);
  };

  const displayList = localOrder.length > 0 ? localOrder : allStatusList;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Status de Demandas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Arraste para reordenar. A ordem define a sequência nos filtros e
              selects.
            </p>

            {isLoadingAll ? (
              <div className="text-center py-8 text-gray-500">
                Carregando status...
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayList.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {displayList.map((status) => (
                      <SortableStatusItem
                        key={status.id}
                        status={status}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {showForm ? (
              <StatusForm
                status={editingStatus}
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={createStatus.isPending || updateStatus.isPending}
              />
            ) : (
              <Button onClick={handleAddNew} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Novo Status
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!statusToDelete}
        onOpenChange={() => setStatusToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o status "{statusToDelete?.nome}"?
              <br />
              <br />
              <strong>Atenção:</strong> Não será possível excluir se houver
              demandas usando este status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
