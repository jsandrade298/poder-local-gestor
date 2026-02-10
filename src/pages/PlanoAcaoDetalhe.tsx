import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Trash2, Edit, GanttChart, Table2,
  Calendar as CalendarIcon, CheckCircle, PlayCircle, PauseCircle,
  CircleDot, MessageSquarePlus, Clock, MoreHorizontal,
  Columns, Settings, AlertTriangle, ArrowUpDown, Send
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, differenceInDays, parseISO, isValid, isBefore, startOfDay } from "date-fns";
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

const colunaTipoLabels: Record<string, string> = {
  texto: "Texto",
  data: "Data",
  responsavel: "Responsável",
  status: "Status",
  checkbox: "Checkbox",
  numero: "Número",
  select: "Seleção"
};

type SortField = "ordem" | "data_inicio" | "percentual" | "titulo";

export default function PlanoAcaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  // === STATES ===
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showAddTarefa, setShowAddTarefa] = useState(false);
  const [showAddColuna, setShowAddColuna] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<any>(null);
  const [deleteTarefaId, setDeleteTarefaId] = useState<string | null>(null);
  const [deleteLinhaId, setDeleteLinhaId] = useState<string | null>(null);
  const [deleteColunaId, setDeleteColunaId] = useState<string | null>(null);
  const [hoveredTarefa, setHoveredTarefa] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sortField, setSortField] = useState<SortField>("ordem");
  const [tarefaModalTab, setTarefaModalTab] = useState("detalhes");

  // Form tarefa
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaResponsavel, setTarefaResponsavel] = useState("");
  const [tarefaDataInicio, setTarefaDataInicio] = useState<Date | undefined>();
  const [tarefaDataFim, setTarefaDataFim] = useState<Date | undefined>();
  const [tarefaPercentual, setTarefaPercentual] = useState(0);
  const [tarefaCor, setTarefaCor] = useState("#3b82f6");
  const [tarefaDescricao, setTarefaDescricao] = useState("");

  // Form header
  const [headerTitulo, setHeaderTitulo] = useState("");
  const [headerDescricao, setHeaderDescricao] = useState("");
  const [headerStatus, setHeaderStatus] = useState("em_andamento");
  const [headerResponsavel, setHeaderResponsavel] = useState("");
  const [headerDataInicio, setHeaderDataInicio] = useState<Date | undefined>();
  const [headerDataFim, setHeaderDataFim] = useState<Date | undefined>();

  // Form coluna
  const [colunaNome, setColunaNome] = useState("");
  const [colunaTipo, setColunaTipo] = useState("texto");

  // Atualizações
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [updateTexto, setUpdateTexto] = useState("");
  const [tarefaUpdateTexto, setTarefaUpdateTexto] = useState("");

  // === QUERIES ===
  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos_plano")
        .select(`*, responsavel:profiles!projetos_plano_responsavel_id_fkey(id, nome)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("*")
        .eq("projeto_id", id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && projeto?.tipo === "projeto"
  });

  const { data: colunas = [] } = useQuery({
    queryKey: ["planilha-colunas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilha_colunas")
        .select("*")
        .eq("projeto_id", id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && projeto?.tipo === "planilha"
  });

  const { data: linhas = [] } = useQuery({
    queryKey: ["planilha-linhas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilha_linhas")
        .select("*")
        .eq("projeto_id", id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && projeto?.tipo === "planilha"
  });

  const { data: atualizacoes = [] } = useQuery({
    queryKey: ["projeto-atualizacoes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_atualizacoes")
        .select(`*, autor:profiles!projeto_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("projeto_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  // Atualizações por tarefa (para modal)
  const { data: tarefaAtualizacoes = [] } = useQuery({
    queryKey: ["tarefa-atualizacoes", editingTarefa?.id],
    queryFn: async () => {
      if (!editingTarefa?.id) return [];
      const { data, error } = await supabase
        .from("projeto_atualizacoes")
        .select(`*, autor:profiles!projeto_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("projeto_id", id)
        .eq("tarefa_id", editingTarefa.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!editingTarefa?.id
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    }
  });

  // === MUTATIONS ===
  const updateProjeto = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("projetos_plano").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["projetos-plano"] });
    }
  });

  const addTarefa = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("projeto_tarefas").insert({ ...data, projeto_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] });
      queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] });
      setShowAddTarefa(false);
      resetTarefaForm();
      toast.success("Tarefa adicionada!");
    }
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ tarefaId, updates }: { tarefaId: string; updates: any }) => {
      const { error } = await supabase.from("projeto_tarefas").update(updates).eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] });
      queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] });
    }
  });

  const deleteTarefa = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase.from("projeto_tarefas").delete().eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] });
      queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] });
      setDeleteTarefaId(null);
      toast.success("Tarefa excluída!");
    }
  });

  // Planilha mutations
  const addColuna = useMutation({
    mutationFn: async () => {
      if (!colunaNome.trim()) throw new Error("Nome obrigatório");
      const novaOrdem = colunas.length;
      const insert: any = {
        projeto_id: id, nome: colunaNome.trim(), tipo: colunaTipo,
        ordem: novaOrdem, largura: 150
      };
      if (colunaTipo === "status") {
        insert.opcoes = JSON.stringify([
          { valor: "A fazer", cor: "#6b7280" },
          { valor: "Em progresso", cor: "#3b82f6" },
          { valor: "Concluído", cor: "#10b981" }
        ]);
      }
      const { error } = await supabase.from("planilha_colunas").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] });
      setShowAddColuna(false);
      setColunaNome("");
      setColunaTipo("texto");
      toast.success("Coluna adicionada!");
    }
  });

  const deleteColuna = useMutation({
    mutationFn: async (colunaId: string) => {
      const { error } = await supabase.from("planilha_colunas").delete().eq("id", colunaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] });
      setDeleteColunaId(null);
      toast.success("Coluna excluída!");
    }
  });

  const addLinha = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("planilha_linhas").insert({
        projeto_id: id, dados: {}, ordem: linhas.length
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] }); }
  });

  const updateLinha = useMutation({
    mutationFn: async ({ linhaId, dados }: { linhaId: string; dados: any }) => {
      const { error } = await supabase.from("planilha_linhas").update({ dados, updated_at: new Date().toISOString() }).eq("id", linhaId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] }); }
  });

  const deleteLinha = useMutation({
    mutationFn: async (linhaId: string) => {
      const { error } = await supabase.from("planilha_linhas").delete().eq("id", linhaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] });
      setDeleteLinhaId(null);
    }
  });

  // Atualizações
  const addAtualizacao = useMutation({
    mutationFn: async ({ texto, tarefaId }: { texto: string; tarefaId?: string }) => {
      if (!texto.trim()) throw new Error("Texto obrigatório");
      const { error } = await supabase.from("projeto_atualizacoes").insert({
        projeto_id: id,
        tarefa_id: tarefaId || null,
        texto: texto.trim(),
        autor_id: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-atualizacoes", id] });
      queryClient.invalidateQueries({ queryKey: ["tarefa-atualizacoes", editingTarefa?.id] });
      setShowAddUpdate(false);
      setUpdateTexto("");
      setTarefaUpdateTexto("");
      toast.success("Atualização registrada!");
    }
  });

  // === HELPERS ===
  const resetTarefaForm = () => {
    setTarefaTitulo(""); setTarefaResponsavel(""); setTarefaDataInicio(undefined);
    setTarefaDataFim(undefined); setTarefaPercentual(0); setTarefaCor("#3b82f6");
    setTarefaDescricao(""); setTarefaModalTab("detalhes"); setTarefaUpdateTexto("");
  };

  const openEditTarefa = (t: any) => {
    setEditingTarefa(t);
    setTarefaTitulo(t.titulo);
    setTarefaResponsavel(t.responsavel || "");
    setTarefaDataInicio(t.data_inicio ? parseISO(t.data_inicio) : undefined);
    setTarefaDataFim(t.data_fim ? parseISO(t.data_fim) : undefined);
    setTarefaPercentual(t.percentual || 0);
    setTarefaCor(t.cor || "#3b82f6");
    setTarefaDescricao(t.descricao || "");
    setTarefaModalTab("detalhes");
    setTarefaUpdateTexto("");
  };

  const openEditHeader = () => {
    if (!projeto) return;
    setHeaderTitulo(projeto.titulo);
    setHeaderDescricao(projeto.descricao || "");
    setHeaderStatus(projeto.status);
    setHeaderResponsavel(projeto.responsavel_id || "");
    setHeaderDataInicio(projeto.data_inicio ? parseISO(projeto.data_inicio) : undefined);
    setHeaderDataFim(projeto.data_fim ? parseISO(projeto.data_fim) : undefined);
    setShowEditHeader(true);
  };

  const saveHeader = () => {
    updateProjeto.mutate({
      titulo: headerTitulo, descricao: headerDescricao || null,
      status: headerStatus, responsavel_id: headerResponsavel || null,
      data_inicio: headerDataInicio ? format(headerDataInicio, "yyyy-MM-dd") : null,
      data_fim: headerDataFim ? format(headerDataFim, "yyyy-MM-dd") : null,
      updated_at: new Date().toISOString()
    });
    setShowEditHeader(false);
    toast.success("Atualizado!");
  };

  const saveTarefa = () => {
    if (!tarefaTitulo.trim() || !tarefaDataInicio || !tarefaDataFim) {
      toast.error("Preencha título, data início e data fim");
      return;
    }
    const data = {
      titulo: tarefaTitulo.trim(), responsavel: tarefaResponsavel || null,
      data_inicio: format(tarefaDataInicio, "yyyy-MM-dd"),
      data_fim: format(tarefaDataFim, "yyyy-MM-dd"),
      percentual: tarefaPercentual, cor: tarefaCor,
      descricao: tarefaDescricao || null, ordem: tarefas.length
    };
    if (editingTarefa) {
      updateTarefa.mutate({ tarefaId: editingTarefa.id, updates: data });
      setEditingTarefa(null); resetTarefaForm();
      toast.success("Tarefa atualizada!");
    } else {
      addTarefa.mutate(data);
    }
  };

  const today = startOfDay(new Date());

  const isOverdue = (t: any) => {
    if (!t.data_fim || (t.percentual || 0) >= 100) return false;
    return isBefore(parseISO(t.data_fim), today);
  };

  const isComplete = (t: any) => (t.percentual || 0) >= 100;

  // Progresso geral
  const progresso = useMemo(() => {
    if (tarefas.length === 0) return 0;
    const soma = tarefas.reduce((acc: number, t: any) => acc + (t.percentual || 0), 0);
    return Math.round(soma / tarefas.length);
  }, [tarefas]);

  // Tarefas ordenadas
  const sortedTarefas = useMemo(() => {
    const sorted = [...tarefas];
    switch (sortField) {
      case "data_inicio":
        return sorted.sort((a, b) => (a.data_inicio || "").localeCompare(b.data_inicio || ""));
      case "percentual":
        return sorted.sort((a, b) => (a.percentual || 0) - (b.percentual || 0));
      case "titulo":
        return sorted.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
      default:
        return sorted.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
  }, [tarefas, sortField]);

  // === GANTT CHART DATA ===
  const ganttData = useMemo(() => {
    if (tarefas.length === 0) return null;
    const allDates = tarefas.flatMap((t: any) => {
      const dates: Date[] = [];
      if (t.data_inicio) dates.push(parseISO(t.data_inicio));
      if (t.data_fim) dates.push(parseISO(t.data_fim));
      return dates;
    }).filter((d: Date) => isValid(d));
    if (allDates.length === 0) return null;

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = Math.max(differenceInDays(maxDate, minDate) + 1, 1);

    // Px por dia — mínimo 20px para que barras curtas sejam visíveis
    const pxPerDay = Math.max(20, Math.min(40, 800 / totalDays));
    const timelineWidth = totalDays * pxPerDay;

    // Marcadores de meses
    const months: { label: string; left: number; width: number }[] = [];
    let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (currentMonth <= maxDate) {
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      const startOffset = Math.max(0, differenceInDays(currentMonth, minDate));
      const endOffset = Math.min(totalDays, differenceInDays(nextMonth, minDate));
      months.push({
        label: format(currentMonth, "MMM yyyy", { locale: ptBR }),
        left: startOffset * pxPerDay,
        width: (endOffset - startOffset) * pxPerDay
      });
      currentMonth = nextMonth;
    }

    // Hoje
    const todayOffset = differenceInDays(today, minDate);
    const todayPx = (todayOffset >= 0 && todayOffset <= totalDays) ? todayOffset * pxPerDay : null;

    return { minDate, maxDate, totalDays, pxPerDay, timelineWidth, months, todayPx };
  }, [tarefas]);

  // Scroll Gantt para hoje ao montar
  useEffect(() => {
    if (ganttData?.todayPx != null && ganttScrollRef.current) {
      const scrollTo = Math.max(0, ganttData.todayPx - 200);
      ganttScrollRef.current.scrollLeft = scrollTo;
    }
  }, [ganttData?.todayPx]);

  // === CELL EDITOR (PLANILHA) ===
  const [editingCell, setEditingCell] = useState<{ linhaId: string; colunaId: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState("");

  const startEditCell = (linhaId: string, colunaId: string, currentValue: any) => {
    setEditingCell({ linhaId, colunaId });
    setEditCellValue(currentValue?.toString() || "");
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    const linha = linhas.find((l: any) => l.id === editingCell.linhaId);
    if (!linha) return;
    const newDados = { ...(linha.dados || {}), [editingCell.colunaId]: editCellValue };
    updateLinha.mutate({ linhaId: editingCell.linhaId, dados: newDados });
    setEditingCell(null);
  };

  const toggleCheckbox = (linhaId: string, colunaId: string, currentValue: any) => {
    const linha = linhas.find((l: any) => l.id === linhaId);
    if (!linha) return;
    const newDados = { ...(linha.dados || {}), [colunaId]: !currentValue };
    updateLinha.mutate({ linhaId, dados: newDados });
  };

  const setSelectValue = (linhaId: string, colunaId: string, value: string) => {
    const linha = linhas.find((l: any) => l.id === linhaId);
    if (!linha) return;
    const newDados = { ...(linha.dados || {}), [colunaId]: value };
    updateLinha.mutate({ linhaId, dados: newDados });
  };

  // === LOADING / NOT FOUND ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button onClick={() => navigate("/plano-acao")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const sc = statusConfig[projeto.status] || statusConfig.em_andamento;
  const StatusIcon = sc.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* ====== HEADER ====== */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/plano-acao")} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Plano de Ação
          </Button>

          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${projeto.cor}15` }}>
                  {projeto.tipo === "projeto" ? (
                    <GanttChart className="h-5 w-5" style={{ color: projeto.cor }} />
                  ) : (
                    <Table2 className="h-5 w-5" style={{ color: projeto.cor }} />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{projeto.titulo}</h1>
                  {projeto.descricao && <p className="text-sm text-muted-foreground mt-0.5">{projeto.descricao}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge style={{ backgroundColor: `${sc.cor}15`, color: sc.cor, borderColor: `${sc.cor}30` }}>
                  <StatusIcon className="h-3 w-3 mr-1" /> {sc.label}
                </Badge>
                {projeto.responsavel && <span className="text-sm text-muted-foreground">Responsável: {projeto.responsavel.nome}</span>}
                {projeto.data_inicio && projeto.data_fim && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(parseISO(projeto.data_inicio), "dd/MM/yyyy")} → {format(parseISO(projeto.data_fim), "dd/MM/yyyy")}
                  </span>
                )}
                {projeto.tipo === "projeto" && <span className="text-sm font-medium">{progresso}% concluído</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddUpdate(true)} className="gap-1">
                <MessageSquarePlus className="h-4 w-4" /> Atualização
              </Button>
              <Button variant="outline" size="sm" onClick={openEditHeader} className="gap-1">
                <Edit className="h-4 w-4" /> Editar
              </Button>
            </div>
          </div>
          {projeto.tipo === "projeto" && <Progress value={progresso} className="h-2" />}
        </div>

        {/* ====== PROJETO (GANTT) ====== */}
        {projeto.tipo === "projeto" && (
          <div className="space-y-6">

            {/* Gráfico de Gantt */}
            {ganttData && sortedTarefas.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GanttChart className="h-4 w-4" /> Cronograma
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ordenar:</span>
                      <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                        <SelectTrigger className="h-7 text-xs w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordem">Ordem padrão</SelectItem>
                          <SelectItem value="data_inicio">Data início</SelectItem>
                          <SelectItem value="percentual">Progresso</SelectItem>
                          <SelectItem value="titulo">Nome</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex border-t">
                    {/* Coluna fixa esquerda */}
                    <div className="flex-shrink-0 w-[280px] border-r bg-muted/20">
                      {/* Header da coluna fixa */}
                      <div className="h-10 border-b px-3 flex items-center">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarefa</span>
                      </div>
                      {/* Linhas das tarefas */}
                      {sortedTarefas.map((t: any) => {
                        const overdue = isOverdue(t);
                        const complete = isComplete(t);
                        return (
                          <div
                            key={t.id}
                            className={cn(
                              "h-11 px-3 flex items-center gap-2 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                              complete && "opacity-60"
                            )}
                            onClick={() => openEditTarefa(t)}
                          >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 relative" style={{ backgroundColor: t.cor || "#3b82f6" }}>
                              {complete && <CheckCircle className="h-3 w-3 text-green-500 absolute -top-0.5 -right-0.5" />}
                              {overdue && <AlertTriangle className="h-3 w-3 text-red-500 absolute -top-0.5 -right-0.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-sm font-medium truncate", complete && "line-through text-muted-foreground")}>
                                {t.titulo}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {t.responsavel && `${t.responsavel} · `}
                                {t.data_inicio && format(parseISO(t.data_inicio), "dd/MM")} → {t.data_fim && format(parseISO(t.data_fim), "dd/MM/yy")}
                              </p>
                            </div>
                            <span className={cn("text-xs font-medium flex-shrink-0", overdue && "text-red-500")}>
                              {t.percentual || 0}%
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline com scroll horizontal */}
                    <div className="flex-1 overflow-x-auto" ref={ganttScrollRef}>
                      <div style={{ width: ganttData.timelineWidth, minWidth: "100%" }}>
                        {/* Header de meses */}
                        <div className="h-10 border-b relative bg-muted/10">
                          {ganttData.months.map((m, i) => (
                            <div
                              key={i}
                              className="absolute top-0 h-full flex items-center px-2 text-xs font-medium text-muted-foreground border-l border-border/40"
                              style={{ left: m.left, width: m.width }}
                            >
                              {m.width > 50 ? m.label : ""}
                            </div>
                          ))}
                          {/* Marcador HOJE no header */}
                          {ganttData.todayPx != null && (
                            <div className="absolute top-0 h-full z-20" style={{ left: ganttData.todayPx }}>
                              <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b shadow-sm">
                                HOJE
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Barras */}
                        <div className="relative">
                          {/* Linha vertical HOJE */}
                          {ganttData.todayPx != null && (
                            <div
                              className="absolute top-0 bottom-0 w-[2px] bg-red-500/70 z-10 pointer-events-none"
                              style={{ left: ganttData.todayPx, height: `${sortedTarefas.length * 44}px` }}
                            >
                              <div className="absolute top-0 left-0 w-4 h-full bg-gradient-to-r from-red-500/10 to-transparent" />
                            </div>
                          )}

                          {/* Grid vertical de meses */}
                          {ganttData.months.map((m, i) => (
                            <div
                              key={i}
                              className="absolute top-0 border-l border-border/20"
                              style={{ left: m.left, height: `${sortedTarefas.length * 44}px` }}
                            />
                          ))}

                          {sortedTarefas.map((tarefa: any) => {
                            const inicio = parseISO(tarefa.data_inicio);
                            const fim = parseISO(tarefa.data_fim);
                            if (!isValid(inicio) || !isValid(fim)) return null;

                            const offsetDays = differenceInDays(inicio, ganttData.minDate);
                            const durationDays = Math.max(differenceInDays(fim, inicio) + 1, 1);
                            const left = offsetDays * ganttData.pxPerDay;
                            const width = durationDays * ganttData.pxPerDay;
                            const complete = isComplete(tarefa);
                            const overdue = isOverdue(tarefa);
                            const pct = tarefa.percentual || 0;

                            return (
                              <div key={tarefa.id} className="h-11 flex items-center border-b relative">
                                <div
                                  className={cn(
                                    "absolute h-7 rounded-md flex items-center overflow-hidden cursor-pointer transition-all hover:shadow-md hover:brightness-110",
                                    complete && "opacity-50",
                                    overdue && "ring-2 ring-red-500/60 ring-offset-1 ring-offset-background"
                                  )}
                                  style={{
                                    left, width: Math.max(width, 12),
                                    backgroundColor: tarefa.cor || "#3b82f6"
                                  }}
                                  onClick={() => openEditTarefa(tarefa)}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoverPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                                    setHoveredTarefa(tarefa);
                                  }}
                                  onMouseLeave={() => setHoveredTarefa(null)}
                                >
                                  {/* Fundo de progresso */}
                                  <div
                                    className="absolute inset-0 bg-black/20"
                                    style={{ left: `${pct}%`, right: 0 }}
                                  />
                                  {/* Label */}
                                  <span className="relative z-10 text-[11px] text-white font-medium px-2 truncate">
                                    {width > 50 ? `${pct}%` : ""}
                                  </span>
                                  {/* Check icon para concluídas */}
                                  {complete && (
                                    <CheckCircle className="relative z-10 h-3.5 w-3.5 text-white ml-auto mr-1 flex-shrink-0" />
                                  )}
                                  {overdue && width > 30 && (
                                    <AlertTriangle className="relative z-10 h-3.5 w-3.5 text-white ml-auto mr-1 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tooltip flutuante */}
            {hoveredTarefa && (
              <div
                className="fixed z-50 pointer-events-none"
                style={{
                  left: Math.min(hoverPos.x, window.innerWidth - 260),
                  top: hoverPos.y,
                  transform: "translate(-50%, -100%)"
                }}
              >
                <div className="bg-popover border rounded-lg shadow-lg p-3 w-[240px] text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredTarefa.cor || "#3b82f6" }} />
                    <span className="font-semibold truncate">{hoveredTarefa.titulo}</span>
                  </div>
                  {hoveredTarefa.responsavel && (
                    <p className="text-xs text-muted-foreground mb-1">Responsável: {hoveredTarefa.responsavel}</p>
                  )}
                  <p className="text-xs text-muted-foreground mb-2">
                    {hoveredTarefa.data_inicio && format(parseISO(hoveredTarefa.data_inicio), "dd/MM/yyyy")} → {hoveredTarefa.data_fim && format(parseISO(hoveredTarefa.data_fim), "dd/MM/yyyy")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Progress value={hoveredTarefa.percentual || 0} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">{hoveredTarefa.percentual || 0}%</span>
                  </div>
                  {isOverdue(hoveredTarefa) && (
                    <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Atrasada
                    </p>
                  )}
                  {isComplete(hoveredTarefa) && (
                    <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Concluída
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lista de tarefas */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Tarefas ({tarefas.length})</CardTitle>
                  <Button size="sm" onClick={() => { resetTarefaForm(); setShowAddTarefa(true); }} className="gap-1">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tarefas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma tarefa criada. Clique em "Adicionar" para começar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortedTarefas.map((t: any) => {
                      const overdue = isOverdue(t);
                      const complete = isComplete(t);
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group",
                            overdue && "border-red-500/30 bg-red-50/50 dark:bg-red-950/10",
                            complete && "opacity-60"
                          )}
                        >
                          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: t.cor || "#3b82f6" }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-medium text-sm truncate", complete && "line-through text-muted-foreground")}>
                                {t.titulo}
                              </span>
                              {overdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasada</Badge>}
                              {complete && <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Concluída</Badge>}
                              {t.responsavel && <span className="text-xs text-muted-foreground">· {t.responsavel}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {t.data_inicio && format(parseISO(t.data_inicio), "dd/MM")} → {t.data_fim && format(parseISO(t.data_fim), "dd/MM/yy")}
                              </span>
                              <Progress value={t.percentual || 0} className="h-1.5 flex-1 max-w-[100px]" />
                              <span className="text-xs font-medium">{t.percentual || 0}%</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTarefa(t)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarefaId(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ====== PLANILHA ====== */}
        {projeto.tipo === "planilha" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Columns className="h-4 w-4" /> Dados ({linhas.length} registro{linhas.length !== 1 ? "s" : ""})
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAddColuna(true)} className="gap-1">
                    <Settings className="h-4 w-4" /> Coluna
                  </Button>
                  <Button size="sm" onClick={() => addLinha.mutate()} className="gap-1">
                    <Plus className="h-4 w-4" /> Linha
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {colunas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-6">
                  Nenhuma coluna configurada. Clique em "Coluna" para adicionar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        {colunas.map((col: any) => (
                          <TableHead key={col.id} style={{ width: col.largura || 150 }}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{col.nome}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                                    Tipo: {colunaTipoLabels[col.tipo] || col.tipo}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteColunaId(col.id)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir coluna
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((linha: any, idx: number) => (
                        <TableRow key={linha.id}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          {colunas.map((col: any) => {
                            const valor = linha.dados?.[col.id];
                            const isEditing = editingCell?.linhaId === linha.id && editingCell?.colunaId === col.id;

                            if (col.tipo === "checkbox") {
                              return (
                                <TableCell key={col.id}>
                                  <Checkbox checked={!!valor} onCheckedChange={() => toggleCheckbox(linha.id, col.id, valor)} />
                                </TableCell>
                              );
                            }

                            if (col.tipo === "status" || col.tipo === "select") {
                              let opcoes: any[] = [];
                              try { opcoes = typeof col.opcoes === "string" ? JSON.parse(col.opcoes) : (col.opcoes || []); } catch { opcoes = []; }
                              const selectedOption = opcoes.find((o: any) => o.valor === valor);
                              return (
                                <TableCell key={col.id}>
                                  <Select value={valor || ""} onValueChange={(v) => setSelectValue(linha.id, col.id, v)}>
                                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50">
                                      {selectedOption ? (
                                        <Badge variant="secondary" className="text-xs" style={selectedOption.cor ? { backgroundColor: `${selectedOption.cor}15`, color: selectedOption.cor } : {}}>
                                          {selectedOption.valor}
                                        </Badge>
                                      ) : <SelectValue placeholder="—" />}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {opcoes.map((opt: any, i: number) => (
                                        <SelectItem key={i} value={opt.valor}>
                                          <div className="flex items-center gap-2">
                                            {opt.cor && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.cor }} />}
                                            {opt.valor}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              );
                            }

                            if (col.tipo === "responsavel") {
                              return (
                                <TableCell key={col.id}>
                                  <Select value={valor || ""} onValueChange={(v) => setSelectValue(linha.id, col.id, v)}>
                                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {profiles.map((p: any) => (
                                        <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              );
                            }

                            if (isEditing) {
                              return (
                                <TableCell key={col.id}>
                                  <Input autoFocus value={editCellValue} onChange={(e) => setEditCellValue(e.target.value)}
                                    onBlur={saveCellEdit}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setEditingCell(null); }}
                                    type={col.tipo === "numero" ? "number" : col.tipo === "data" ? "date" : "text"} className="h-7 text-xs" />
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell key={col.id} className="cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                                onClick={() => startEditCell(linha.id, col.id, valor)}>
                                {col.tipo === "data" && valor
                                  ? (() => { try { return format(parseISO(valor), "dd/MM/yyyy"); } catch { return valor; } })()
                                  : valor || <span className="text-muted-foreground/50">—</span>}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-50 hover:opacity-100" onClick={() => setDeleteLinhaId(linha.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ====== ATUALIZAÇÕES DO PROJETO ====== */}
        {atualizacoes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Atualizações do Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {atualizacoes.map((a: any) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p>{a.texto}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.autor?.nome || "Sistema"} · {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {a.tarefa_id && <span className="italic"> · vinculada a uma tarefa</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====== DIALOGS ====== */}

      {/* Dialog Editar Header */}
      <Dialog open={showEditHeader} onOpenChange={setShowEditHeader}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar {projeto.tipo === "projeto" ? "Projeto" : "Planilha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={headerTitulo} onChange={(e) => setHeaderTitulo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={headerDescricao} onChange={(e) => setHeaderDescricao(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={headerStatus} onValueChange={setHeaderStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={headerResponsavel} onValueChange={setHeaderResponsavel}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !headerDataInicio && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {headerDataInicio ? format(headerDataInicio, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={headerDataInicio} onSelect={setHeaderDataInicio} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !headerDataFim && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {headerDataFim ? format(headerDataFim, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={headerDataFim} onSelect={setHeaderDataFim} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditHeader(false)}>Cancelar</Button>
            <Button onClick={saveHeader}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tarefa com Abas (Detalhes + Atualizações) */}
      <Dialog open={showAddTarefa || !!editingTarefa} onOpenChange={(open) => { if (!open) { setShowAddTarefa(false); setEditingTarefa(null); resetTarefaForm(); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>

          <Tabs value={editingTarefa ? tarefaModalTab : "detalhes"} onValueChange={setTarefaModalTab} className="flex-1 min-h-0 flex flex-col">
            {editingTarefa && (
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="atualizacoes">
                  Atualizações
                  {tarefaAtualizacoes.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{tarefaAtualizacoes.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="detalhes" className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)} placeholder="Ex: Licitação da obra" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={tarefaDescricao} onChange={(e) => setTarefaDescricao(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={tarefaResponsavel} onChange={(e) => setTarefaResponsavel(e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !tarefaDataInicio && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tarefaDataInicio ? format(tarefaDataInicio, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={tarefaDataInicio} onSelect={setTarefaDataInicio} locale={ptBR} /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Fim *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !tarefaDataFim && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tarefaDataFim ? format(tarefaDataFim, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={tarefaDataFim} onSelect={setTarefaDataFim} locale={ptBR} /></PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Progresso: {tarefaPercentual}%</Label>
                <Slider value={[tarefaPercentual]} onValueChange={([v]) => setTarefaPercentual(v)} max={100} step={5} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {corOptions.map((cor) => (
                    <button key={cor} className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${tarefaCor === cor ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: cor }} onClick={() => setTarefaCor(cor)} />
                  ))}
                </div>
              </div>
            </TabsContent>

            {editingTarefa && (
              <TabsContent value="atualizacoes" className="flex-1 min-h-0 flex flex-col mt-4">
                {/* Input para nova atualização */}
                <div className="flex gap-2 mb-4 flex-shrink-0">
                  <Input
                    placeholder="Registrar uma atualização..."
                    value={tarefaUpdateTexto}
                    onChange={(e) => setTarefaUpdateTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tarefaUpdateTexto.trim()) {
                        addAtualizacao.mutate({ texto: tarefaUpdateTexto, tarefaId: editingTarefa.id });
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    disabled={!tarefaUpdateTexto.trim() || addAtualizacao.isPending}
                    onClick={() => addAtualizacao.mutate({ texto: tarefaUpdateTexto, tarefaId: editingTarefa.id })}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Lista de atualizações */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                  {tarefaAtualizacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma atualização registrada para esta tarefa.
                    </p>
                  ) : (
                    tarefaAtualizacoes.map((a: any) => (
                      <div key={a.id} className="flex gap-3 text-sm border-b pb-3 last:border-0">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div>
                          <p>{a.texto}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {a.autor?.nome || "Sistema"} · {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowAddTarefa(false); setEditingTarefa(null); resetTarefaForm(); }}>
              Cancelar
            </Button>
            <Button onClick={saveTarefa} disabled={addTarefa.isPending || updateTarefa.isPending}>
              {editingTarefa ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar Coluna */}
      <Dialog open={showAddColuna} onOpenChange={setShowAddColuna}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da coluna *</Label>
              <Input value={colunaNome} onChange={(e) => setColunaNome(e.target.value)} placeholder="Ex: Observações" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={colunaTipo} onValueChange={setColunaTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(colunaTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddColuna(false)}>Cancelar</Button>
            <Button onClick={() => addColuna.mutate()} disabled={!colunaNome.trim() || addColuna.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Atualização do Projeto */}
      <Dialog open={showAddUpdate} onOpenChange={setShowAddUpdate}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Registrar Atualização</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>O que mudou?</Label>
            <Textarea value={updateTexto} onChange={(e) => setUpdateTexto(e.target.value)}
              placeholder="Ex: Licitação publicada no diário oficial..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUpdate(false)}>Cancelar</Button>
            <Button onClick={() => addAtualizacao.mutate({ texto: updateTexto })} disabled={!updateTexto.trim() || addAtualizacao.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialogs de exclusão */}
      <AlertDialog open={!!deleteTarefaId} onOpenChange={(open) => !open && setDeleteTarefaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTarefaId && deleteTarefa.mutate(deleteTarefaId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLinhaId} onOpenChange={(open) => !open && setDeleteLinhaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir linha?</AlertDialogTitle>
            <AlertDialogDescription>Os dados desta linha serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteLinhaId && deleteLinha.mutate(deleteLinhaId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteColunaId} onOpenChange={(open) => !open && setDeleteColunaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>A coluna e todos os dados associados serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteColunaId && deleteColuna.mutate(deleteColunaId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
