import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings, Plus, Trash2, GripVertical, Save, X,
  Bell, BellOff, Pencil, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useDemandaStatus, DemandaStatus } from "@/hooks/useDemandaStatus";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfigurarStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CORES_DISPONIVEIS = [
  { nome: "Cinza",    valor: "#6b7280" },
  { nome: "Azul",    valor: "#3b82f6" },
  { nome: "Verde",   valor: "#22c55e" },
  { nome: "Amarelo", valor: "#f59e0b" },
  { nome: "Vermelho",valor: "#ef4444" },
  { nome: "Roxo",    valor: "#8b5cf6" },
  { nome: "Rosa",    valor: "#ec4899" },
  { nome: "Ciano",   valor: "#06b6d4" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Lima",    valor: "#84cc16" },
];

// Normaliza texto em slug (sem acentos, espaços viram _)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Item arrastável ──────────────────────────────────────────
function SortableStatusItem({
  status, onEdit, onDelete,
}: {
  status: DemandaStatus;
  onEdit: (s: DemandaStatus) => void;
  onDelete: (s: DemandaStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border rounded-lg ${isDragging ? "shadow-lg" : ""}`}
    >
      <button className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: status.cor }} />

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-1.5">
          {status.nome}
          {status.is_final && (
            <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded-full">
              conclusão
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">slug: {status.slug}</div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              {status.notificar_municipe
                ? <Bell className="h-4 w-4 text-blue-500" />
                : <BellOff className="h-4 w-4 text-gray-300" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {status.notificar_municipe ? "Notifica munícipe" : "Não notifica"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="ghost" size="icon" onClick={() => onEdit(status)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="icon"
        onClick={() => onDelete(status)}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Formulário de criação/edição ─────────────────────────────
function StatusForm({
  status, onSave, onCancel, isLoading,
}: {
  status: Partial<DemandaStatus> | null;
  onSave: (data: Partial<DemandaStatus>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<DemandaStatus>>(
    status || { nome: "", slug: "", cor: "#6b7280", notificar_municipe: false, is_final: false }
  );
  const isEditing = !!status?.id;
  const slugOriginal = status?.slug || "";
  const slugMudou = isEditing && formData.slug !== slugOriginal;

  const handleNomeChange = (nome: string) => {
    const newData: Partial<DemandaStatus> = { ...formData, nome };
    // Auto-sync do slug só quando estamos criando (nunca sobrescreve slug editado)
    if (!isEditing) {
      newData.slug = slugify(nome);
    }
    setFormData(newData);
  };

  const handleSlugChange = (slug: string) => {
    // Sanitiza: só minúsculas, números e _
    const slugSanitizado = slug.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setFormData({ ...formData, slug: slugSanitizado });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
      <h4 className="font-medium">{isEditing ? "Editar Status" : "Novo Status"}</h4>

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
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="em_analise"
          />
          <p className="text-xs text-gray-500">
            Apenas letras minúsculas, números e underscore (_)
          </p>
        </div>
      </div>

      {/* Aviso quando o slug foi alterado em um status existente */}
      {slugMudou && (
        <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <strong>Atenção:</strong> ao salvar, todas as demandas com o status{" "}
            <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">{slugOriginal}</code> serão
            migradas para{" "}
            <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">{formData.slug}</code>.
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {CORES_DISPONIVEIS.map((cor) => (
            <button
              key={cor.valor}
              type="button"
              onClick={() => setFormData({ ...formData, cor: cor.valor })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.cor === cor.valor ? "border-gray-800 dark:border-white scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: cor.valor }}
              title={cor.nome}
            />
          ))}
        </div>
      </div>

      {/* Notificar munícipe */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border">
        <div className="space-y-0.5">
          <Label htmlFor="notificar" className="flex items-center gap-1.5 cursor-pointer">
            <Bell className="h-4 w-4 text-blue-500" />
            Notificar munícipe
          </Label>
          <p className="text-xs text-gray-500">Enviar WhatsApp quando a demanda entrar neste status</p>
        </div>
        <Switch
          id="notificar"
          checked={formData.notificar_municipe || false}
          onCheckedChange={(checked) => setFormData({ ...formData, notificar_municipe: checked })}
        />
      </div>

      {/* Status de conclusão */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border">
        <div className="space-y-0.5">
          <Label htmlFor="is_final" className="flex items-center gap-1.5 cursor-pointer">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Status de conclusão
          </Label>
          <p className="text-xs text-gray-500">
            Marca este status como "concluído" — usado para calcular taxa de conclusão e KPIs do dashboard
          </p>
        </div>
        <Switch
          id="is_final"
          checked={formData.is_final || false}
          onCheckedChange={(checked) => setFormData({ ...formData, is_final: checked })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4 mr-2" />Cancelar
        </Button>
        <Button
          onClick={() => onSave({ ...formData, slugOriginal } as any)}
          disabled={!formData.nome || !formData.slug || isLoading}
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// ── Dialog principal ─────────────────────────────────────────
export function ConfigurarStatusDialog({ open, onOpenChange }: ConfigurarStatusDialogProps) {
  const { allStatusList, isLoadingAll, createStatus, updateStatus, deleteStatus, reorderStatus } =
    useDemandaStatus();

  const [editingStatus, setEditingStatus] = useState<Partial<DemandaStatus> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<DemandaStatus | null>(null);
  const [localOrder, setLocalOrder] = useState<DemandaStatus[]>([]);

  if (allStatusList.length > 0 && localOrder.length === 0) setLocalOrder(allStatusList);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localOrder.findIndex(s => s.id === active.id);
      const newIndex = localOrder.findIndex(s => s.id === over.id);
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);
      reorderStatus.mutate(newOrder.map(s => s.id));
    }
  };

  const handleSave = (data: Partial<DemandaStatus> & { slugOriginal?: string }) => {
    const { slugOriginal, ...payload } = data;
    if (editingStatus?.id) {
      updateStatus.mutate({ id: editingStatus.id, slugOriginal, ...payload } as any);
    } else {
      createStatus.mutate(payload);
    }
    setShowForm(false);
    setEditingStatus(null);
  };

  const displayList = localOrder.length > 0 ? localOrder : allStatusList;
  const finalCount = displayList.filter(s => s.is_final).length;

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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Arraste para reordenar. A ordem define o funil no dashboard.
              </p>
              {finalCount > 0 && (
                <span className="text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                  {finalCount} de conclusão
                </span>
              )}
            </div>

            {isLoadingAll ? (
              <div className="text-center py-8 text-gray-500">Carregando status...</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayList.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {displayList.map(status => (
                      <SortableStatusItem
                        key={status.id}
                        status={status}
                        onEdit={s => { setEditingStatus(s); setShowForm(true); }}
                        onDelete={s => setStatusToDelete(s)}
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
                onCancel={() => { setShowForm(false); setEditingStatus(null); }}
                isLoading={createStatus.isPending || updateStatus.isPending}
              />
            ) : (
              <Button onClick={() => { setEditingStatus(null); setShowForm(true); }} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" />Adicionar Novo Status
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!statusToDelete} onOpenChange={() => setStatusToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{statusToDelete?.nome}"?<br /><br />
              <strong>Atenção:</strong> Não será possível excluir se houver demandas usando este status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (statusToDelete) { deleteStatus.mutate(statusToDelete.id); setStatusToDelete(null); } }}
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
