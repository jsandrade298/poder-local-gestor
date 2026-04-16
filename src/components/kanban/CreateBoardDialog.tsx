import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { useKanbanBoards, KanbanBoard } from "@/hooks/useKanbanBoards";

const EMOJIS = [
  '📋', '📢', '📅', '🏗️', '🎯', '📊', '💬', '🗂️',
  '📌', '🔥', '⭐', '💡', '🎨', '📝', '🤝', '🏆',
  '📣', '🛠️', '📦', '🎪', '🏛️', '🚀', '📎', '✅',
];

const CORES = [
  { nome: "Azul",     valor: "#3b82f6" },
  { nome: "Verde",    valor: "#22c55e" },
  { nome: "Amarelo",  valor: "#f59e0b" },
  { nome: "Vermelho", valor: "#ef4444" },
  { nome: "Roxo",     valor: "#8b5cf6" },
  { nome: "Rosa",     valor: "#ec4899" },
  { nome: "Ciano",    valor: "#06b6d4" },
  { nome: "Laranja",  valor: "#f97316" },
  { nome: "Lima",     valor: "#84cc16" },
  { nome: "Cinza",    valor: "#6b7280" },
];

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBoard?: KanbanBoard | null;
}

export function CreateBoardDialog({ open, onOpenChange, editingBoard }: CreateBoardDialogProps) {
  const { createBoard, updateBoard } = useKanbanBoards();
  const isEditing = !!editingBoard?.id;

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    icone: "📋",
    cor: "#3b82f6",
  });

  useEffect(() => {
    if (editingBoard) {
      setForm({
        nome: editingBoard.nome || "",
        descricao: editingBoard.descricao || "",
        icone: editingBoard.icone || "📋",
        cor: editingBoard.cor || "#3b82f6",
      });
    } else {
      setForm({ nome: "", descricao: "", icone: "📋", cor: "#3b82f6" });
    }
  }, [editingBoard, open]);

  const handleSave = () => {
    if (!form.nome.trim()) return;

    if (isEditing) {
      updateBoard.mutate({ id: editingBoard!.id, nome: form.nome, descricao: form.descricao || null, icone: form.icone, cor: form.cor } as any);
    } else {
      createBoard.mutate(form);
    }
    onOpenChange(false);
  };

  const isPending = createBoard.isPending || updateBoard.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Board" : "Novo Board de Projeto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Emoji picker */}
          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg border">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, icone: emoji }))}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                    form.icone === emoji
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "hover:bg-muted hover:scale-105"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="board-nome">Nome *</Label>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{form.icone}</span>
              <Input
                id="board-nome"
                value={form.nome}
                onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Comunicação"
                autoFocus
              />
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((cor) => (
                <button
                  key={cor.valor}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, cor: cor.valor }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.cor === cor.valor
                      ? "border-gray-800 dark:border-white scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: cor.valor }}
                  title={cor.nome}
                />
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="board-descricao">Descrição (opcional)</Label>
            <Textarea
              id="board-descricao"
              value={form.descricao}
              onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva o objetivo deste board..."
              rows={2}
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: form.cor + '20' }}
            >
              {form.icone}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{form.nome || "Nome do board"}</p>
              <div className="w-10 h-1 rounded-full mt-1" style={{ backgroundColor: form.cor }} />
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              <X className="h-4 w-4 mr-2" />Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.nome.trim() || isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Board"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
