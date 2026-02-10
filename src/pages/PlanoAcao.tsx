import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Target, Plus, Search, GanttChart, Table2, MoreHorizontal,
  Calendar as CalendarIcon, Trash2, Edit, Copy, Clock,
  CheckCircle, PauseCircle, PlayCircle, CircleDot
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cor: string; icon: any }> = {
  planejado: { label: "Planejado", cor: "#6b7280", icon: CircleDot },
  em_andamento: { label: "Em andamento", cor: "#3b82f6", icon: PlayCircle },
  pausado: { label: "Pausado", cor: "#f59e0b", icon: PauseCircle },
  concluido: { label: "Concluído", cor: "#10b981", icon: CheckCircle }
};

const corOptions = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899"
];

export default function PlanoAcao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<"projeto" | "planilha">("projeto");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Form states
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formCor, setFormCor] = useState("#3b82f6");
  const [formDataInicio, setFormDataInicio] = useState<Date | undefined>(undefined);
  const [formDataFim, setFormDataFim] = useState<Date | undefined>(undefined);
  const [formResponsavel, setFormResponsavel] = useState("");

  // Buscar projetos
  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos-plano"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos_plano")
        .select(`
          *,
          responsavel:profiles!projetos_plano_responsavel_id_fkey(id, nome),
          criador:profiles!projetos_plano_created_by_fkey(id, nome)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Buscar contagem de tarefas por projeto (para progresso)
  const { data: tarefasCount = {} } = useQuery({
    queryKey: ["projetos-tarefas-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("projeto_id, percentual");

      if (error) throw error;

      const counts: Record<string, { total: number; soma: number }> = {};
      (data || []).forEach((t: any) => {
        if (!counts[t.projeto_id]) counts[t.projeto_id] = { total: 0, soma: 0 };
        counts[t.projeto_id].total++;
        counts[t.projeto_id].soma += t.percentual || 0;
      });
      return counts;
    }
  });

  // Buscar contagem de linhas por planilha
  const { data: linhasCount = {} } = useQuery({
    queryKey: ["projetos-linhas-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilha_linhas")
        .select("projeto_id");

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((l: any) => {
        counts[l.projeto_id] = (counts[l.projeto_id] || 0) + 1;
      });
      return counts;
    }
  });

  // Buscar profiles para responsável
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  // Criar projeto/planilha
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formTitulo.trim()) throw new Error("Título é obrigatório");
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("projetos_plano")
        .insert({
          titulo: formTitulo.trim(),
          descricao: formDescricao.trim() || null,
          tipo: createType,
          cor: formCor,
          data_inicio: formDataInicio ? format(formDataInicio, "yyyy-MM-dd") : null,
          data_fim: formDataFim ? format(formDataFim, "yyyy-MM-dd") : null,
          responsavel_id: formResponsavel || null,
          created_by: user.id,
          status: "em_andamento"
        })
        .select("id")
        .single();

      if (error) throw error;

      // Se for planilha, criar colunas padrão
      if (createType === "planilha") {
        const colunasDefault = [
          { projeto_id: data.id, nome: "Ação", tipo: "texto", ordem: 0, largura: 300 },
          { projeto_id: data.id, nome: "Responsável", tipo: "responsavel", ordem: 1, largura: 150 },
          { projeto_id: data.id, nome: "Prazo", tipo: "data", ordem: 2, largura: 130 },
          { projeto_id: data.id, nome: "Status", tipo: "status", ordem: 3, largura: 130, opcoes: JSON.stringify([
            { valor: "A fazer", cor: "#6b7280" },
            { valor: "Em progresso", cor: "#3b82f6" },
            { valor: "Concluído", cor: "#10b981" }
          ])},
          { projeto_id: data.id, nome: "Concluído", tipo: "checkbox", ordem: 4, largura: 100 }
        ];

        await supabase.from("planilha_colunas").insert(colunasDefault);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projetos-plano"] });
      setShowCreateDialog(false);
      resetForm();
      toast.success(`${createType === "projeto" ? "Projeto" : "Planilha"} criado com sucesso!`);
      navigate(`/plano-acao/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar");
    }
  });

  // Duplicar projeto
  const duplicateMutation = useMutation({
    mutationFn: async (projeto: any) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("projetos_plano")
        .insert({
          titulo: `${projeto.titulo} (cópia)`,
          descricao: projeto.descricao,
          tipo: projeto.tipo,
          cor: projeto.cor,
          data_inicio: projeto.data_inicio,
          data_fim: projeto.data_fim,
          responsavel_id: projeto.responsavel_id,
          created_by: user.id,
          status: "planejado"
        })
        .select("id")
        .single();

      if (error) throw error;

      // Duplicar tarefas se for projeto
      if (projeto.tipo === "projeto") {
        const { data: tarefas } = await supabase
          .from("projeto_tarefas")
          .select("*")
          .eq("projeto_id", projeto.id);

        if (tarefas && tarefas.length > 0) {
          const novasTarefas = tarefas.map((t: any) => ({
            projeto_id: data.id,
            titulo: t.titulo,
            descricao: t.descricao,
            responsavel: t.responsavel,
            data_inicio: t.data_inicio,
            data_fim: t.data_fim,
            percentual: 0,
            cor: t.cor,
            ordem: t.ordem
          }));
          await supabase.from("projeto_tarefas").insert(novasTarefas);
        }
      }

      // Duplicar colunas e linhas se for planilha
      if (projeto.tipo === "planilha") {
        const { data: colunas } = await supabase
          .from("planilha_colunas")
          .select("*")
          .eq("projeto_id", projeto.id);

        if (colunas && colunas.length > 0) {
          const novasColunas = colunas.map((c: any) => ({
            projeto_id: data.id,
            nome: c.nome,
            tipo: c.tipo,
            ordem: c.ordem,
            largura: c.largura,
            opcoes: c.opcoes
          }));
          await supabase.from("planilha_colunas").insert(novasColunas);
        }

        const { data: linhas } = await supabase
          .from("planilha_linhas")
          .select("*")
          .eq("projeto_id", projeto.id);

        if (linhas && linhas.length > 0) {
          const novasLinhas = linhas.map((l: any) => ({
            projeto_id: data.id,
            dados: l.dados,
            ordem: l.ordem
          }));
          await supabase.from("planilha_linhas").insert(novasLinhas);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos-plano"] });
      toast.success("Duplicado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao duplicar");
    }
  });

  // Excluir
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projetos_plano").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos-plano"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-linhas-count"] });
      setDeleteTarget(null);
      toast.success("Excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir");
    }
  });

  const resetForm = () => {
    setFormTitulo("");
    setFormDescricao("");
    setFormCor("#3b82f6");
    setFormDataInicio(undefined);
    setFormDataFim(undefined);
    setFormResponsavel("");
  };

  const openCreateDialog = (tipo: "projeto" | "planilha") => {
    setCreateType(tipo);
    resetForm();
    setShowCreateDialog(true);
  };

  // Filtros
  const filtered = projetos.filter((p: any) => {
    if (searchTerm && !p.titulo.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (tipoFilter !== "all" && p.tipo !== tipoFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const getProgresso = (projeto: any): number => {
    if (projeto.tipo === "projeto") {
      const tc = tarefasCount[projeto.id];
      if (!tc || tc.total === 0) return 0;
      return Math.round(tc.soma / tc.total);
    }
    return projeto.status === "concluido" ? 100 : 0;
  };

  const getSubtitle = (projeto: any): string => {
    if (projeto.tipo === "projeto") {
      const tc = tarefasCount[projeto.id];
      if (!tc) return "Nenhuma tarefa";
      return `${tc.total} tarefa${tc.total !== 1 ? "s" : ""}`;
    } else {
      const lc = linhasCount[projeto.id] || 0;
      return `${lc} registro${lc !== 1 ? "s" : ""}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Plano de Ação</h1>
            <p className="text-muted-foreground">
              Gerencie seus projetos e planilhas de acompanhamento
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openCreateDialog("projeto")} className="gap-2">
              <GanttChart className="h-4 w-4" />
              Novo Projeto
            </Button>
            <Button onClick={() => openCreateDialog("planilha")} variant="outline" className="gap-2">
              <Table2 className="h-4 w-4" />
              Nova Planilha
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projetos e planilhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="projeto">Projetos</SelectItem>
              <SelectItem value="planilha">Planilhas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contadores */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{filtered.filter((p: any) => p.tipo === "projeto").length} projeto{filtered.filter((p: any) => p.tipo === "projeto").length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{filtered.filter((p: any) => p.tipo === "planilha").length} planilha{filtered.filter((p: any) => p.tipo === "planilha").length !== 1 ? "s" : ""}</span>
        </div>

        {/* Grid de cards */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum projeto ou planilha</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Crie um projeto para acompanhar cronogramas com Gantt, ou uma planilha para gerenciar listas e ações.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => openCreateDialog("projeto")} size="sm" className="gap-2">
                  <GanttChart className="h-4 w-4" />
                  Novo Projeto
                </Button>
                <Button onClick={() => openCreateDialog("planilha")} size="sm" variant="outline" className="gap-2">
                  <Table2 className="h-4 w-4" />
                  Nova Planilha
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((projeto: any) => {
              const sc = statusConfig[projeto.status] || statusConfig.em_andamento;
              const StatusIcon = sc.icon;
              const progresso = getProgresso(projeto);

              return (
                <Card
                  key={projeto.id}
                  className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/30 relative overflow-hidden"
                  onClick={() => navigate(`/plano-acao/${projeto.id}`)}
                >
                  {/* Barra de cor no topo */}
                  <div className="h-1.5" style={{ backgroundColor: projeto.cor || "#3b82f6" }} />

                  <CardContent className="p-5 space-y-4">
                    {/* Header do card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-muted flex-shrink-0">
                          {projeto.tipo === "projeto" ? (
                            <GanttChart className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Table2 className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {projeto.titulo}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {getSubtitle(projeto)}
                          </p>
                        </div>
                      </div>

                      {/* Menu de ações */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate(`/plano-acao/${projeto.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Abrir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(projeto)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(projeto)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Descrição */}
                    {projeto.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {projeto.descricao}
                      </p>
                    )}

                    {/* Progresso (só projetos) */}
                    {projeto.tipo === "projeto" && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{progresso}%</span>
                        </div>
                        <Progress value={progresso} className="h-1.5" />
                      </div>
                    )}

                    {/* Footer: status + datas + responsável */}
                    <div className="flex items-center justify-between pt-1">
                      <Badge
                        variant="secondary"
                        className="text-xs gap-1"
                        style={{ backgroundColor: `${sc.cor}15`, color: sc.cor, borderColor: `${sc.cor}30` }}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </Badge>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {projeto.data_inicio && projeto.data_fim && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(projeto.data_inicio + "T12:00:00"), "dd/MM")} - {format(new Date(projeto.data_fim + "T12:00:00"), "dd/MM/yy")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Responsável */}
                    {projeto.responsavel && (
                      <p className="text-xs text-muted-foreground">
                        Responsável: {projeto.responsavel.nome}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Criar */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createType === "projeto" ? (
                <GanttChart className="h-5 w-5 text-primary" />
              ) : (
                <Table2 className="h-5 w-5 text-primary" />
              )}
              {createType === "projeto" ? "Novo Projeto" : "Nova Planilha"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder={createType === "projeto" ? "Ex: Reforma da Praça Central" : "Ex: Controle de Entregas"}
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva o objetivo..."
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {corOptions.map((cor) => (
                  <button
                    key={cor}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      formCor === cor ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background" : "border-transparent"
                    }`}
                    style={{ backgroundColor: cor }}
                    onClick={() => setFormCor(cor)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formDataInicio && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDataInicio ? format(formDataInicio, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={formDataInicio} onSelect={setFormDataInicio} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formDataFim && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDataFim ? format(formDataFim, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={formDataFim} onSelect={setFormDataFim} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={formResponsavel} onValueChange={setFormResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formTitulo.trim()}>
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.tipo === "projeto" ? "projeto" : "planilha"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.titulo}"</strong>?
              Todas as tarefas, colunas e dados associados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
