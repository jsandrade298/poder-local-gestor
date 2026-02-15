import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  User,
  Edit,
  Palette,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  Clock,
  GripVertical,
} from "lucide-react";
import { formatDateTime, formatDateOnly } from "@/lib/dateUtils";
import { logError } from "@/lib/errorUtils";
import { toast } from "sonner";

interface ViewTarefaDialogProps {
  tarefa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (tarefa: any) => void;
}

export function ViewTarefaDialog({
  tarefa,
  open,
  onOpenChange,
  onEdit,
}: ViewTarefaDialogProps) {
  const [novoItemTexto, setNovoItemTexto] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [activeTab, setActiveTab] = useState("detalhes");
  const comentarioInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Reset state ao abrir/fechar
  useEffect(() => {
    if (open) {
      setNovoItemTexto("");
      setNovoComentario("");
      setActiveTab("detalhes");
    }
  }, [open, tarefa?.id]);

  // ── Buscar checklist items ──
  const { data: checklistItems = [] } = useQuery({
    queryKey: ["tarefa-checklist", tarefa?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];
      const { data, error } = await supabase
        .from("tarefa_checklist_items")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        logError("Erro ao buscar checklist:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!tarefa?.id && open,
  });

  // ── Buscar comentários ──
  const { data: comentarios = [] } = useQuery({
    queryKey: ["tarefa-comentarios", tarefa?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];
      const { data, error } = await supabase
        .from("tarefa_comentarios")
        .select(
          `
          *,
          autor:profiles!tarefa_comentarios_autor_id_fkey(id, nome)
        `
        )
        .eq("tarefa_id", tarefa.id)
        .order("created_at", { ascending: false });
      if (error) {
        logError("Erro ao buscar comentários:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!tarefa?.id && open,
  });

  // ── Mutations: Checklist ──
  const addChecklistItemMutation = useMutation({
    mutationFn: async (texto: string) => {
      const maxOrdem =
        checklistItems.length > 0
          ? Math.max(...checklistItems.map((i: any) => i.ordem))
          : -1;
      const { error } = await supabase
        .from("tarefa_checklist_items")
        .insert({
          tarefa_id: tarefa.id,
          texto,
          ordem: maxOrdem + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tarefa-checklist", tarefa.id],
      });
      queryClient.invalidateQueries({ queryKey: ["demandas-kanban"] });
      setNovoItemTexto("");
    },
    onError: (error) => {
      logError("Erro ao adicionar item:", error);
      toast.error("Erro ao adicionar item");
    },
  });

  const toggleChecklistItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      concluido,
    }: {
      itemId: string;
      concluido: boolean;
    }) => {
      const { error } = await supabase
        .from("tarefa_checklist_items")
        .update({ concluido, updated_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tarefa-checklist", tarefa.id],
      });
      queryClient.invalidateQueries({ queryKey: ["demandas-kanban"] });
    },
    onError: (error) => {
      logError("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item");
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("tarefa_checklist_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tarefa-checklist", tarefa.id],
      });
      queryClient.invalidateQueries({ queryKey: ["demandas-kanban"] });
    },
    onError: (error) => {
      logError("Erro ao remover item:", error);
      toast.error("Erro ao remover item");
    },
  });

  // ── Mutations: Comentários ──
  const addComentarioMutation = useMutation({
    mutationFn: async (texto: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("tarefa_comentarios").insert({
        tarefa_id: tarefa.id,
        autor_id: user.id,
        texto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tarefa-comentarios", tarefa.id],
      });
      queryClient.invalidateQueries({ queryKey: ["demandas-kanban"] });
      setNovoComentario("");
      toast.success("Comentário adicionado");
    },
    onError: (error) => {
      logError("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    },
  });

  if (!tarefa) return null;

  // ── Helpers ──
  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "baixa":
        return "hsl(var(--chart-4))";
      case "media":
        return "hsl(var(--chart-2))";
      case "alta":
        return "hsl(var(--chart-1))";
      case "urgente":
        return "hsl(var(--chart-5))";
      default:
        return "hsl(var(--muted-foreground))";
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case "baixa":
        return "Baixa";
      case "media":
        return "Média";
      case "alta":
        return "Alta";
      case "urgente":
        return "Urgente";
      default:
        return prioridade;
    }
  };

  const isOverdue = (dataPrazo: string | null) => {
    if (!dataPrazo) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = new Date(dataPrazo + "T00:00:00");
    return today > prazo;
  };

  const getDiasAtraso = (dataPrazo: string | null) => {
    if (!dataPrazo) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = new Date(dataPrazo + "T00:00:00");
    return Math.floor(
      (today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const checklistTotal = checklistItems.length;
  const checklistDone = checklistItems.filter(
    (i: any) => i.concluido
  ).length;
  const checklistPercent =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const handleAddChecklistItem = () => {
    const texto = novoItemTexto.trim();
    if (!texto) return;
    addChecklistItemMutation.mutate(texto);
  };

  const handleAddComentario = () => {
    const texto = novoComentario.trim();
    if (!texto) return;
    addComentarioMutation.mutate(texto);
  };

  const handleChecklistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddChecklistItem();
    }
  };

  const handleComentarioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddComentario();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: tarefa.cor || "#3B82F6" }}
            />
            Visualizar Tarefa
          </DialogTitle>
        </DialogHeader>

        {/* Header da tarefa */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{tarefa.titulo}</h2>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                Tarefa
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              #{tarefa.protocolo}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(tarefa)}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Prazo em destaque (se existir) */}
        {tarefa.data_prazo && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
              isOverdue(tarefa.data_prazo)
                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-400"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            {isOverdue(tarefa.data_prazo) ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Clock className="h-4 w-4 flex-shrink-0" />
            )}
            <span>
              <strong>Prazo:</strong> {formatDateOnly(tarefa.data_prazo)}
              {isOverdue(tarefa.data_prazo) && (
                <span className="ml-2 font-medium">
                  ({getDiasAtraso(tarefa.data_prazo)} dias em atraso)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="detalhes"
              className="flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Edit className="h-3.5 w-3.5" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger
              value="checklist"
              className="flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Checklist
              {checklistTotal > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {checklistDone}/{checklistTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="comentarios"
              className="flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Comentários
              {comentarios.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {comentarios.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ──────── Aba Detalhes ──────── */}
          <TabsContent value="detalhes" className="space-y-4 mt-4">
            {/* Descrição */}
            {tarefa.descricao && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium">Descrição</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                  {tarefa.descricao}
                </p>
              </div>
            )}

            {/* Grid de informações */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium">Prioridade</h3>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: getPrioridadeColor(tarefa.prioridade),
                    color: getPrioridadeColor(tarefa.prioridade),
                  }}
                >
                  {getPrioridadeLabel(tarefa.prioridade)}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium">Status</h3>
                <Badge
                  variant={tarefa.completed ? "default" : "secondary"}
                >
                  {tarefa.completed ? "Concluída" : "Em andamento"}
                </Badge>
              </div>
            </div>

            {/* Colaboradores */}
            {tarefa.colaboradores && tarefa.colaboradores.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Colaboradores
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tarefa.colaboradores.map(
                    (colaborador: any, index: number) => (
                      <Badge key={index} variant="outline">
                        {colaborador.nome}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Cor e data de criação lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor do Card
                </h3>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{
                      backgroundColor: tarefa.cor || "#3B82F6",
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {tarefa.cor || "#3B82F6"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Criado em
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(tarefa.created_at)}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ──────── Aba Checklist ──────── */}
          <TabsContent value="checklist" className="space-y-4 mt-4">
            {/* Barra de progresso */}
            {checklistTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">
                    {checklistDone}/{checklistTotal} concluídos ({checklistPercent}%)
                  </span>
                </div>
                <Progress value={checklistPercent} className="h-2" />
              </div>
            )}

            {/* Lista de itens */}
            <div className="space-y-1">
              {checklistItems.map((item: any) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors hover:bg-muted/50 ${
                    item.concluido ? "opacity-60" : ""
                  }`}
                >
                  <Checkbox
                    checked={item.concluido}
                    onCheckedChange={(checked) =>
                      toggleChecklistItemMutation.mutate({
                        itemId: item.id,
                        concluido: !!checked,
                      })
                    }
                    className="flex-shrink-0"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      item.concluido
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {item.texto}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() =>
                      deleteChecklistItemMutation.mutate(item.id)
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {checklistTotal === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item no checklist. Adicione itens abaixo.
                </p>
              )}
            </div>

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
                size="sm"
                onClick={handleAddChecklistItem}
                disabled={
                  !novoItemTexto.trim() ||
                  addChecklistItemMutation.isPending
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* ──────── Aba Comentários ──────── */}
          <TabsContent value="comentarios" className="space-y-4 mt-4">
            {/* Input de novo comentário */}
            <div className="space-y-2">
              <Textarea
                ref={comentarioInputRef}
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={handleComentarioKeyDown}
                placeholder="Escrever um comentário... (Ctrl+Enter para enviar)"
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddComentario}
                  disabled={
                    !novoComentario.trim() ||
                    addComentarioMutation.isPending
                  }
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {addComentarioMutation.isPending
                    ? "Enviando..."
                    : "Enviar"}
                </Button>
              </div>
            </div>

            {/* Lista de comentários */}
            <div className="space-y-3">
              {comentarios.map((comentario: any) => (
                <div
                  key={comentario.id}
                  className="bg-muted/30 rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">
                        {comentario.autor?.nome || "Usuário"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(comentario.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-9">
                    {comentario.texto}
                  </p>
                </div>
              ))}

              {comentarios.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda. Seja o primeiro a comentar!
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
