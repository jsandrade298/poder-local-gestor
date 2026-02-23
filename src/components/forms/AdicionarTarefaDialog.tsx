import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Palette, Calendar, Bell, Trash2, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { registrarHistorico } from "@/lib/kanbanHistoricoUtils";

interface AdicionarTarefaDialogProps {
  kanbanType: string;
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

const opcoesLembrete = [
  { dias: 1, label: "1 dia antes" },
  { dias: 3, label: "3 dias antes" },
  { dias: 5, label: "5 dias antes" },
  { dias: 7, label: "7 dias antes" },
];

interface ChecklistItem {
  id: string;
  texto: string;
}

export function AdicionarTarefaDialog({ kanbanType }: AdicionarTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [novoItemTexto, setNovoItemTexto] = useState("");
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    posicao: "a_fazer",
    cor: "#3B82F6",
    data_prazo: "",
    lembretes_prazo: [] as number[]
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

  // ── Checklist local ──
  const handleAddChecklistItem = () => {
    const texto = novoItemTexto.trim();
    if (!texto) return;
    setChecklistItems(prev => [...prev, { id: crypto.randomUUID(), texto }]);
    setNovoItemTexto("");
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };

  const handleChecklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddChecklistItem();
    }
  };

  const createTarefaMutation = useMutation({
    mutationFn: async (tarefa: typeof formData) => {
      console.log("🔄 Criando tarefa - dados:", tarefa);
      console.log("🔄 Colaboradores selecionados:", colaboradoresSelecionados);
      console.log("🔄 Checklist items:", checklistItems);
      
      // Obter usuário atual
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      
      if (!userId) throw new Error('Usuário não autenticado');

      // Buscar dados do usuário criador
      const { data: criador } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', userId)
        .single();
      
      // Criar tarefa
      const { data: novaTarefa, error: tarefaError } = await supabase
        .from('tarefas')
        .insert({
          titulo: tarefa.titulo,
          descricao: tarefa.descricao,
          prioridade: tarefa.prioridade,
          kanban_position: tarefa.posicao,
          kanban_type: kanbanType,
          cor: tarefa.cor,
          data_prazo: tarefa.data_prazo || null,
          lembretes_prazo: tarefa.data_prazo && tarefa.lembretes_prazo.length > 0 ? tarefa.lembretes_prazo : [],
          created_by: userId
        })
        .select()
        .single();

      if (tarefaError) throw tarefaError;

      // Inserir checklist items no banco
      if (checklistItems.length > 0) {
        const checklistData = checklistItems.map((item, index) => ({
          tarefa_id: novaTarefa.id,
          texto: item.texto,
          ordem: index,
          concluido: false
        }));

        const { error: checklistError } = await supabase
          .from('tarefa_checklist_items')
          .insert(checklistData);

        if (checklistError) {
          console.error('Erro ao criar checklist:', checklistError);
        }
      }

      // Adicionar colaboradores se houver algum selecionado
      if (colaboradoresSelecionados.length > 0) {
        const colaboradoresData = colaboradoresSelecionados.map(colaboradorId => ({
          tarefa_id: novaTarefa.id,
          colaborador_id: colaboradorId
        }));

        const { error: colaboradoresError } = await supabase
          .from('tarefa_colaboradores')
          .insert(colaboradoresData);

        if (colaboradoresError) throw colaboradoresError;

        // Criar notificações para os colaboradores
        const notificacoesData = colaboradoresSelecionados.map(colaboradorId => ({
          remetente_id: userId,
          destinatario_id: colaboradorId,
          tipo: 'tarefa_atribuida',
          titulo: 'Nova tarefa atribuída',
          mensagem: `${criador?.nome || 'Usuário'} atribuiu você à tarefa: "${tarefa.titulo}"`,
          url_destino: `/kanban?tarefa=${novaTarefa.id}`,
          lida: false
        }));

        const { error: notificacoesError } = await supabase
          .from('notificacoes')
          .insert(notificacoesData);

        if (notificacoesError) {
          console.error('Erro ao criar notificações:', notificacoesError);
        }
      }

      // Registrar no histórico
      registrarHistorico({
        item_id: novaTarefa.id,
        item_tipo: 'tarefa',
        item_titulo: tarefa.titulo,
        kanban_type: kanbanType,
        posicao_nova: tarefa.posicao,
        acao: 'adicionado',
      });

      return novaTarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico'] });
      toast.success("Tarefa criada com sucesso!");
      setFormData({
        titulo: "",
        descricao: "",
        prioridade: "media",
        posicao: "a_fazer",
        cor: "#3B82F6",
        data_prazo: "",
        lembretes_prazo: []
      });
      setColaboradoresSelecionados([]);
      setChecklistItems([]);
      setNovoItemTexto("");
      setOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao criar tarefa:', error);
      toast.error("Erro ao criar tarefa");
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
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
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

          {/* Campo de prazo */}
          <div className="space-y-2">
            <Label htmlFor="data_prazo" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Prazo
            </Label>
            <Input
              id="data_prazo"
              type="date"
              value={formData.data_prazo}
              onChange={(e) => setFormData({ ...formData, data_prazo: e.target.value, lembretes_prazo: e.target.value ? formData.lembretes_prazo : [] })}
            />
          </div>

          {/* Lembretes de prazo */}
          {formData.data_prazo && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4" />
                Lembretes antes do prazo
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {opcoesLembrete.map((opcao) => (
                  <div key={opcao.dias} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lembrete-${opcao.dias}`}
                      checked={formData.lembretes_prazo.includes(opcao.dias)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          lembretes_prazo: checked
                            ? [...prev.lembretes_prazo, opcao.dias].sort((a, b) => b - a)
                            : prev.lembretes_prazo.filter(d => d !== opcao.dias)
                        }));
                      }}
                    />
                    <Label htmlFor={`lembrete-${opcao.dias}`} className="text-sm cursor-pointer">
                      {opcao.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tarefas em atraso enviam lembrete diário automaticamente.
              </p>
            </div>
          )}

          {/* ══════════════ Checklist ══════════════ */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Checklist
              {checklistItems.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({checklistItems.length} {checklistItems.length === 1 ? 'item' : 'itens'})
                </span>
              )}
            </Label>

            {/* Lista de itens */}
            {checklistItems.length > 0 && (
              <div className="border rounded-md divide-y">
                {checklistItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 group hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground w-5 text-center">{index + 1}</span>
                    <span className="flex-1 text-sm">{item.texto}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar novo item */}
            <div className="flex items-center gap-2">
              <Input
                value={novoItemTexto}
                onChange={(e) => setNovoItemTexto(e.target.value)}
                onKeyDown={handleChecklistKeyDown}
                placeholder="Adicionar item ao checklist..."
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddChecklistItem}
                disabled={!novoItemTexto.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cor do Card */}
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
