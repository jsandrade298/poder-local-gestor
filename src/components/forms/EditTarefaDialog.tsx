import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Palette } from "lucide-react";
import { toast } from "sonner";

interface EditTarefaDialogProps {
  tarefa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const cores = [
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Verde", valor: "#10B981" },
  { nome: "Amarelo", valor: "#F59E0B" },
  { nome: "Vermelho", valor: "#EF4444" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Rosa", valor: "#EC4899" },
  { nome: "Laranja", valor: "#F97316" },
  { nome: "Cinza", valor: "#6B7280" }
];

export function EditTarefaDialog({ tarefa, open, onOpenChange }: EditTarefaDialogProps) {
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    posicao: "a_fazer",
    cor: "#3B82F6",
    completed: false
  });

  const queryClient = useQueryClient();

  // Buscar colaboradores
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Carregar dados da tarefa quando o dialog abrir
  useEffect(() => {
    if (tarefa && open) {
      setFormData({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        prioridade: tarefa.prioridade || "media",
        posicao: tarefa.kanban_position || "a_fazer",
        cor: tarefa.cor || "#3B82F6",
        completed: tarefa.completed || false
      });

      // Carregar colaboradores da tarefa
      if (tarefa.colaboradores) {
        setColaboradoresSelecionados(tarefa.colaboradores.map((c: any) => c.id));
      }
    }
  }, [tarefa, open]);

  const updateTarefaMutation = useMutation({
    mutationFn: async (tarefaData: typeof formData) => {
      // Atualizar tarefa
      const { error: tarefaError } = await supabase
        .from('tarefas')
        .update({
          titulo: tarefaData.titulo,
          descricao: tarefaData.descricao,
          prioridade: tarefaData.prioridade,
          kanban_position: tarefaData.posicao,
          cor: tarefaData.cor,
          completed: tarefaData.completed,
          completed_at: tarefaData.completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', tarefa.id);

      if (tarefaError) throw tarefaError;

      // Remover colaboradores existentes
      const { error: deleteError } = await supabase
        .from('tarefa_colaboradores')
        .delete()
        .eq('tarefa_id', tarefa.id);

      if (deleteError) throw deleteError;

      // Adicionar novos colaboradores se houver algum selecionado
      if (colaboradoresSelecionados.length > 0) {
        const colaboradoresData = colaboradoresSelecionados.map(colaboradorId => ({
          tarefa_id: tarefa.id,
          colaborador_id: colaboradorId
        }));

        const { error: colaboradoresError } = await supabase
          .from('tarefa_colaboradores')
          .insert(colaboradoresData);

        if (colaboradoresError) throw colaboradoresError;
      }

      return tarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban'] });
      toast.success("Tarefa atualizada com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao atualizar tarefa:', error);
      toast.error("Erro ao atualizar tarefa");
    }
  });

  const handleColaboradorToggle = (colaboradorId: string) => {
    setColaboradoresSelecionados(prev => 
      prev.includes(colaboradorId) 
        ? prev.filter(id => id !== colaboradorId)
        : [...prev, colaboradorId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    updateTarefaMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
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

          <div className="space-y-2">
            <Label>Colaboradores (Opcional)</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
              {colaboradores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum colaborador disponível</p>
              ) : (
                <div className="space-y-2">
                  {colaboradores.map((colaborador) => (
                    <div key={colaborador.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`colaborador-${colaborador.id}`}
                        checked={colaboradoresSelecionados.includes(colaborador.id)}
                        onCheckedChange={() => handleColaboradorToggle(colaborador.id)}
                      />
                      <Label 
                        htmlFor={`colaborador-${colaborador.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {colaborador.nome}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              <Label htmlFor="posicao">Posição</Label>
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

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Cor do Card
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {cores.map((cor) => (
                <button
                  key={cor.valor}
                  type="button"
                  className={`h-10 rounded-md border-2 transition-all hover:scale-105 ${
                    formData.cor === cor.valor ? 'border-foreground' : 'border-muted'
                  }`}
                  style={{ backgroundColor: cor.valor }}
                  onClick={() => setFormData({ ...formData, cor: cor.valor })}
                  title={cor.nome}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="completed"
                checked={formData.completed}
                onCheckedChange={(checked) => setFormData({ ...formData, completed: !!checked })}
              />
              <Label htmlFor="completed" className="cursor-pointer">
                Marcar como concluída
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateTarefaMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateTarefaMutation.isPending}
            >
              {updateTarefaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}