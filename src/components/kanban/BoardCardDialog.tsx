import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, X, Trash2, Calendar, User, AlertTriangle } from "lucide-react";
import { useKanbanBoardCards, useKanbanBoardColunas, KanbanBoardCard } from "@/hooks/useKanbanBoards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatDateOnly } from "@/lib/dateUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const CORES_CARD = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6b7280",
];

interface BoardCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  card?: KanbanBoardCard | null;
  defaultColunaId?: string;
}

export function BoardCardDialog({ open, onOpenChange, boardId, card, defaultColunaId }: BoardCardDialogProps) {
  const { createCard, updateCard, deleteCard, archiveCard } = useKanbanBoardCards(boardId);
  const { colunas } = useKanbanBoardColunas(boardId);
  const isEditing = !!card?.id;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    responsavel_id: "",
    prioridade: "media",
    cor: "#3b82f6",
    data_prazo: "",
    coluna_id: "",
  });

  useEffect(() => {
    if (card) {
      setForm({
        titulo: card.titulo || "",
        descricao: card.descricao || "",
        responsavel_id: card.responsavel_id || "",
        prioridade: card.prioridade || "media",
        cor: card.cor || "#3b82f6",
        data_prazo: card.data_prazo || "",
        coluna_id: card.coluna_id || "",
      });
    } else {
      setForm({
        titulo: "",
        descricao: "",
        responsavel_id: "",
        prioridade: "media",
        cor: "#3b82f6",
        data_prazo: "",
        coluna_id: defaultColunaId || colunas[0]?.id || "",
      });
    }
  }, [card, open, defaultColunaId, colunas]);

  // Buscar usuários do tenant
  const { data: usuarios = [] } = useQuery({
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
    enabled: open,
  });

  const handleSave = () => {
    if (!form.titulo.trim()) return;

    if (isEditing) {
      updateCard.mutate({
        id: card!.id,
        titulo: form.titulo,
        descricao: form.descricao || null,
        responsavel_id: form.responsavel_id || null,
        prioridade: form.prioridade,
        cor: form.cor,
        data_prazo: form.data_prazo || null,
        coluna_id: form.coluna_id,
      } as any);
    } else {
      createCard.mutate({
        coluna_id: form.coluna_id,
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        responsavel_id: form.responsavel_id || undefined,
        prioridade: form.prioridade,
        cor: form.cor,
        data_prazo: form.data_prazo || undefined,
      });
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (card?.id) {
      deleteCard.mutate(card.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    }
  };

  const isOverdue = card?.data_prazo && new Date(card.data_prazo) < new Date();
  const isPending = createCard.isPending || updateCard.isPending;

  const getPrioridadeLabel = (p: string) => {
    switch (p) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return p;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isEditing ? "Editar Card" : "Novo Card"}
              </DialogTitle>
              {isEditing && (
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Metadados do card (modo edição) */}
            {isEditing && card && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Criado por {card.criador?.nome || 'Usuário'} em {formatDateTime(card.created_at)}</span>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />Atrasado
                  </Badge>
                )}
              </div>
            )}

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="card-titulo">Título *</Label>
              <Input
                id="card-titulo"
                value={form.titulo}
                onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="O que precisa ser feito?"
                autoFocus
              />
            </div>

            {/* Coluna */}
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={form.coluna_id} onValueChange={(v) => setForm(f => ({ ...f, coluna_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {colunas.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.cor }} />
                        {col.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Responsável */}
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={form.responsavel_id || "__none__"}
                  onValueChange={(v) => setForm(f => ({ ...f, responsavel_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prazo */}
            <div className="space-y-2">
              <Label htmlFor="card-prazo">Prazo</Label>
              <Input
                id="card-prazo"
                type="date"
                value={form.data_prazo}
                onChange={(e) => setForm(f => ({ ...f, data_prazo: e.target.value }))}
              />
            </div>

            {/* Cor */}
            <div className="space-y-2">
              <Label>Cor do card</Label>
              <div className="flex gap-2">
                {CORES_CARD.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, cor }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.cor === cor ? "border-gray-800 dark:border-white scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="card-descricao">Descrição</Label>
              <Textarea
                id="card-descricao"
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes do card..."
                rows={3}
              />
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                <X className="h-4 w-4 mr-2" />Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!form.titulo.trim() || !form.coluna_id || isPending}>
                <Save className="h-4 w-4 mr-2" />
                {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Card"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{card?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
