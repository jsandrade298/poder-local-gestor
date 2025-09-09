import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AdicionarTarefaDialogProps {
  kanbanType: string;
}

export function AdicionarTarefaDialog({ kanbanType }: AdicionarTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    posicao: "a_fazer"
  });

  const queryClient = useQueryClient();

  const createTarefaMutation = useMutation({
    mutationFn: async (tarefa: typeof formData) => {
      // Criar uma tarefa na nova tabela
      const { data: novaTarefa, error: tarefaError } = await supabase
        .from('tarefas')
        .insert({
          titulo: tarefa.titulo,
          descricao: tarefa.descricao,
          prioridade: tarefa.prioridade,
          kanban_position: tarefa.posicao,
          kanban_type: kanbanType, // ID do usuário ou tipo do kanban
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (tarefaError) throw tarefaError;

      return novaTarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas-kanban', kanbanType] });
      toast.success("Tarefa criada com sucesso!");
      setFormData({
        titulo: "",
        descricao: "",
        prioridade: "media",
        posicao: "a_fazer"
      });
      setOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao criar tarefa:', error);
      toast.error("Erro ao criar tarefa");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    createTarefaMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Digite o título da tarefa..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a tarefa..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
              >
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

            <div className="space-y-2">
              <Label htmlFor="posicao">Posição Inicial</Label>
              <Select
                value={formData.posicao}
                onValueChange={(value) => setFormData({ ...formData, posicao: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_fazer">A Fazer</SelectItem>
                  <SelectItem value="em_progresso">Em Progresso</SelectItem>
                  <SelectItem value="feito">Feito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createTarefaMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createTarefaMutation.isPending}
            >
              {createTarefaMutation.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}