import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Trash2, Edit, GanttChart, Table2,
  Calendar as CalendarIcon, CheckCircle, PlayCircle, PauseCircle,
  CircleDot, MessageSquarePlus, Clock, MoreHorizontal,
  Columns, Settings, AlertTriangle, Send, ChevronLeft, ChevronRight,
  Pencil, Expand, X, ChevronDown, ChevronUp
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, differenceInDays, parseISO, isValid, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ===== CONSTANTS =====
const statusConfig: Record<string, { label: string; cor: string; icon: any }> = {
  planejado: { label: "Planejado", cor: "#6b7280", icon: CircleDot },
  em_andamento: { label: "Em andamento", cor: "#3b82f6", icon: PlayCircle },
  pausado: { label: "Pausado", cor: "#f59e0b", icon: PauseCircle },
  concluido: { label: "Concluído", cor: "#10b981", icon: CheckCircle }
};
const corOptions = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#ec4899"];
const colunaTipoLabels: Record<string, string> = {
  texto: "Texto", data: "Data", responsavel: "Responsável",
  status: "Lista de opções", select: "Lista de opções",
  checkbox: "Checkbox", numero: "Número"
};
type SortField = "ordem" | "data_inicio" | "percentual" | "titulo";

// ===== COMPONENT =====
export default function PlanoAcaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  // --- General states ---
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showAddTarefa, setShowAddTarefa] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<any>(null);
  const [deleteTarefaId, setDeleteTarefaId] = useState<string | null>(null);
  const [hoveredTarefa, setHoveredTarefa] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [sortField, setSortField] = useState<SortField>("ordem");
  const [tarefaModalTab, setTarefaModalTab] = useState("detalhes");
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [updateTexto, setUpdateTexto] = useState("");
  const [tarefaUpdateTexto, setTarefaUpdateTexto] = useState("");

  // Tarefa form
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaResponsavel, setTarefaResponsavel] = useState("");
  const [tarefaDataInicio, setTarefaDataInicio] = useState<Date | undefined>();
  const [tarefaDataFim, setTarefaDataFim] = useState<Date | undefined>();
  const [tarefaPercentual, setTarefaPercentual] = useState(0);
  const [tarefaCor, setTarefaCor] = useState("#3b82f6");
  const [tarefaDescricao, setTarefaDescricao] = useState("");

  // Header form
  const [headerTitulo, setHeaderTitulo] = useState("");
  const [headerDescricao, setHeaderDescricao] = useState("");
  const [headerStatus, setHeaderStatus] = useState("em_andamento");
  const [headerResponsavel, setHeaderResponsavel] = useState("");
  const [headerDataInicio, setHeaderDataInicio] = useState<Date | undefined>();
  const [headerDataFim, setHeaderDataFim] = useState<Date | undefined>();

  // --- Planilha states ---
  const [showAddColuna, setShowAddColuna] = useState(false);
  const [colunaNome, setColunaNome] = useState("");
  const [colunaTipo, setColunaTipo] = useState("texto");
  const [colunaOpcoes, setColunaOpcoes] = useState<{ valor: string; cor: string }[]>([
    { valor: "A fazer", cor: "#6b7280" }, { valor: "Em progresso", cor: "#3b82f6" }, { valor: "Concluído", cor: "#10b981" }
  ]);
  const [deleteLinhaId, setDeleteLinhaId] = useState<string | null>(null);
  const [deleteColunaId, setDeleteColunaId] = useState<string | null>(null);
  const [renameColunaId, setRenameColunaId] = useState<string | null>(null);
  const [renameColunaValue, setRenameColunaValue] = useState("");
  const [editingCell, setEditingCell] = useState<{ linhaId: string; colunaId: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState("");

  // Linha modal (with LOCAL form data to avoid the bug)
  const [editingLinha, setEditingLinha] = useState<any>(null);
  const [linhaFormData, setLinhaFormData] = useState<Record<string, any>>({});
  const [linhaModalTab, setLinhaModalTab] = useState("dados");
  const [linhaUpdateTexto, setLinhaUpdateTexto] = useState("");

  // Expandable updates in table
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());
  const [inlineUpdateText, setInlineUpdateText] = useState<Record<string, string>>({});

  // Column resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  // ===== QUERIES =====
  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos_plano")
        .select(`*, responsavel:profiles!projetos_plano_responsavel_id_fkey(id, nome)`)
        .eq("id", id).single();
      if (error) throw error; return data;
    }, enabled: !!id
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projeto_tarefas").select("*").eq("projeto_id", id).order("ordem");
      if (error) throw error; return data || [];
    }, enabled: !!id && projeto?.tipo === "projeto"
  });

  const { data: colunas = [] } = useQuery({
    queryKey: ["planilha-colunas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("planilha_colunas").select("*").eq("projeto_id", id).order("ordem");
      if (error) throw error; return data || [];
    }, enabled: !!id && projeto?.tipo === "planilha"
  });

  const { data: linhas = [] } = useQuery({
    queryKey: ["planilha-linhas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("planilha_linhas").select("*").eq("projeto_id", id).order("ordem");
      if (error) throw error; return data || [];
    }, enabled: !!id && projeto?.tipo === "planilha"
  });

  const { data: atualizacoes = [] } = useQuery({
    queryKey: ["projeto-atualizacoes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projeto_atualizacoes")
        .select(`*, autor:profiles!projeto_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("projeto_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error; return data || [];
    }, enabled: !!id
  });

  const { data: tarefaAtualizacoes = [] } = useQuery({
    queryKey: ["tarefa-atualizacoes", editingTarefa?.id],
    queryFn: async () => {
      if (!editingTarefa?.id) return [];
      const { data, error } = await supabase.from("projeto_atualizacoes")
        .select(`*, autor:profiles!projeto_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("projeto_id", id).eq("tarefa_id", editingTarefa.id).order("created_at", { ascending: false });
      if (error) throw error; return data || [];
    }, enabled: !!editingTarefa?.id
  });

  // ALL line updates for the planilha (for the Atualizações column)
  const { data: allLinhaAtualizacoes = [] } = useQuery({
    queryKey: ["all-linha-atualizacoes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("planilha_linha_atualizacoes")
        .select(`*, autor:profiles!planilha_linha_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("projeto_id", id).order("created_at", { ascending: false });
      if (error) throw error; return data || [];
    }, enabled: !!id && projeto?.tipo === "planilha"
  });

  // Line updates for modal
  const { data: linhaAtualizacoes = [] } = useQuery({
    queryKey: ["linha-atualizacoes", editingLinha?.id],
    queryFn: async () => {
      if (!editingLinha?.id) return [];
      const { data, error } = await supabase.from("planilha_linha_atualizacoes")
        .select(`*, autor:profiles!planilha_linha_atualizacoes_autor_id_fkey(id, nome)`)
        .eq("linha_id", editingLinha.id).order("created_at", { ascending: false });
      if (error) throw error; return data || [];
    }, enabled: !!editingLinha?.id
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
      if (error) throw error; return data || [];
    }
  });

  // Group updates by linha_id
  const atualizacoesByLinha = useMemo(() => {
    const map: Record<string, any[]> = {};
    allLinhaAtualizacoes.forEach((a: any) => {
      if (!map[a.linha_id]) map[a.linha_id] = [];
      map[a.linha_id].push(a);
    });
    return map;
  }, [allLinhaAtualizacoes]);

  // Init colWidths from colunas
  useEffect(() => {
    const w: Record<string, number> = {};
    colunas.forEach((c: any) => { w[c.id] = colWidths[c.id] || c.largura || 150; });
    setColWidths(w);
  }, [colunas]);

  // ===== MUTATIONS =====
  const updateProjeto = useMutation({
    mutationFn: async (updates: any) => { const { error } = await supabase.from("projetos_plano").update(updates).eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projeto-detalhe", id] }); queryClient.invalidateQueries({ queryKey: ["projetos-plano"] }); }
  });

  const addTarefa = useMutation({
    mutationFn: async (data: any) => { const { error } = await supabase.from("projeto_tarefas").insert({ ...data, projeto_id: id }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] }); queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] }); setShowAddTarefa(false); resetTarefaForm(); toast.success("Tarefa adicionada!"); }
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ tarefaId, updates }: { tarefaId: string; updates: any }) => { const { error } = await supabase.from("projeto_tarefas").update(updates).eq("id", tarefaId); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] }); queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] }); }
  });

  const deleteTarefa = useMutation({
    mutationFn: async (tid: string) => { const { error } = await supabase.from("projeto_tarefas").delete().eq("id", tid); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", id] }); queryClient.invalidateQueries({ queryKey: ["projetos-tarefas-count"] }); setDeleteTarefaId(null); toast.success("Tarefa excluída!"); }
  });

  const addColuna = useMutation({
    mutationFn: async () => {
      if (!colunaNome.trim()) throw new Error("Nome obrigatório");
      const insert: any = { projeto_id: id, nome: colunaNome.trim(), tipo: colunaTipo, ordem: colunas.length, largura: colunaTipo === "checkbox" ? 100 : 150 };
      if (colunaTipo === "status") insert.opcoes = JSON.stringify(colunaOpcoes.filter(o => o.valor.trim()));
      const { error } = await supabase.from("planilha_colunas").insert(insert); if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] }); setShowAddColuna(false); resetColunaForm(); toast.success("Coluna adicionada!"); }
  });

  const deleteColuna = useMutation({
    mutationFn: async (cid: string) => { const { error } = await supabase.from("planilha_colunas").delete().eq("id", cid); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] }); setDeleteColunaId(null); toast.success("Coluna excluída!"); }
  });

  const renameColuna = useMutation({
    mutationFn: async ({ colunaId, nome }: { colunaId: string; nome: string }) => { const { error } = await supabase.from("planilha_colunas").update({ nome }).eq("id", colunaId); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] }); setRenameColunaId(null); toast.success("Coluna renomeada!"); }
  });

  const reorderColuna = useMutation({
    mutationFn: async ({ colunaId, direction }: { colunaId: string; direction: "left" | "right" }) => {
      const idx = colunas.findIndex((c: any) => c.id === colunaId); if (idx < 0) return;
      const si = direction === "left" ? idx - 1 : idx + 1; if (si < 0 || si >= colunas.length) return;
      for (const u of [{ id: colunas[idx].id, ordem: colunas[si].ordem }, { id: colunas[si].id, ordem: colunas[idx].ordem }]) {
        const { error } = await supabase.from("planilha_colunas").update({ ordem: u.ordem }).eq("id", u.id); if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] }); }
  });

  const updateColunaWidth = useMutation({
    mutationFn: async ({ colunaId, largura }: { colunaId: string; largura: number }) => {
      const { error } = await supabase.from("planilha_colunas").update({ largura }).eq("id", colunaId); if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-colunas", id] }); }
  });

  const addLinha = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("planilha_linhas").insert({ projeto_id: id, dados: {}, ordem: linhas.length }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] }); }
  });

  const updateLinha = useMutation({
    mutationFn: async ({ linhaId, dados }: { linhaId: string; dados: any }) => {
      const { error } = await supabase.from("planilha_linhas").update({ dados, updated_at: new Date().toISOString() }).eq("id", linhaId); if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] }); }
  });

  const deleteLinha = useMutation({
    mutationFn: async (lid: string) => { const { error } = await supabase.from("planilha_linhas").delete().eq("id", lid); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planilha-linhas", id] }); setDeleteLinhaId(null); }
  });

  const addAtualizacao = useMutation({
    mutationFn: async ({ texto, tarefaId }: { texto: string; tarefaId?: string }) => {
      if (!texto.trim()) throw new Error("Texto obrigatório");
      const { error } = await supabase.from("projeto_atualizacoes").insert({ projeto_id: id, tarefa_id: tarefaId || null, texto: texto.trim(), autor_id: user?.id }); if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projeto-atualizacoes", id] }); queryClient.invalidateQueries({ queryKey: ["tarefa-atualizacoes", editingTarefa?.id] }); setShowAddUpdate(false); setUpdateTexto(""); setTarefaUpdateTexto(""); toast.success("Atualização registrada!"); }
  });

  const addLinhaAtualizacao = useMutation({
    mutationFn: async ({ linhaId, texto }: { linhaId: string; texto: string }) => {
      if (!texto.trim()) throw new Error("Texto obrigatório");
      const { error } = await supabase.from("planilha_linha_atualizacoes").insert({ linha_id: linhaId, projeto_id: id, texto: texto.trim(), autor_id: user?.id }); if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-linha-atualizacoes", id] });
      queryClient.invalidateQueries({ queryKey: ["linha-atualizacoes", editingLinha?.id] });
      setLinhaUpdateTexto("");
      setInlineUpdateText(prev => ({ ...prev, [variables.linhaId]: "" }));
      toast.success("Atualização registrada!");
    }
  });

  // ===== HELPERS: TAREFA =====
  const resetTarefaForm = () => { setTarefaTitulo(""); setTarefaResponsavel(""); setTarefaDataInicio(undefined); setTarefaDataFim(undefined); setTarefaPercentual(0); setTarefaCor("#3b82f6"); setTarefaDescricao(""); setTarefaModalTab("detalhes"); setTarefaUpdateTexto(""); };

  const openEditTarefa = (t: any) => {
    setEditingTarefa(t); setTarefaTitulo(t.titulo); setTarefaResponsavel(t.responsavel || "");
    setTarefaDataInicio(t.data_inicio ? parseISO(t.data_inicio) : undefined);
    setTarefaDataFim(t.data_fim ? parseISO(t.data_fim) : undefined);
    setTarefaPercentual(t.percentual || 0); setTarefaCor(t.cor || "#3b82f6");
    setTarefaDescricao(t.descricao || ""); setTarefaModalTab("detalhes"); setTarefaUpdateTexto("");
  };

  const openEditHeader = () => {
    if (!projeto) return;
    setHeaderTitulo(projeto.titulo); setHeaderDescricao(projeto.descricao || ""); setHeaderStatus(projeto.status);
    setHeaderResponsavel(projeto.responsavel_id || ""); setHeaderDataInicio(projeto.data_inicio ? parseISO(projeto.data_inicio) : undefined);
    setHeaderDataFim(projeto.data_fim ? parseISO(projeto.data_fim) : undefined); setShowEditHeader(true);
  };

  const saveHeader = () => {
    updateProjeto.mutate({ titulo: headerTitulo, descricao: headerDescricao || null, status: headerStatus, responsavel_id: headerResponsavel || null, data_inicio: headerDataInicio ? format(headerDataInicio, "yyyy-MM-dd") : null, data_fim: headerDataFim ? format(headerDataFim, "yyyy-MM-dd") : null, updated_at: new Date().toISOString() });
    setShowEditHeader(false); toast.success("Atualizado!");
  };

  const saveTarefa = () => {
    if (!tarefaTitulo.trim() || !tarefaDataInicio || !tarefaDataFim) { toast.error("Preencha título, data início e data fim"); return; }
    const d = { titulo: tarefaTitulo.trim(), responsavel: tarefaResponsavel || null, data_inicio: format(tarefaDataInicio, "yyyy-MM-dd"), data_fim: format(tarefaDataFim, "yyyy-MM-dd"), percentual: tarefaPercentual, cor: tarefaCor, descricao: tarefaDescricao || null, ordem: tarefas.length };
    if (editingTarefa) { updateTarefa.mutate({ tarefaId: editingTarefa.id, updates: d }); setEditingTarefa(null); resetTarefaForm(); toast.success("Tarefa atualizada!"); }
    else { addTarefa.mutate(d); }
  };

  const today = startOfDay(new Date());
  const isOverdue = (t: any) => !t.data_fim || (t.percentual || 0) >= 100 ? false : isBefore(parseISO(t.data_fim), today);
  const isComplete = (t: any) => (t.percentual || 0) >= 100;

  const progresso = useMemo(() => {
    if (tarefas.length === 0) return 0;
    return Math.round(tarefas.reduce((a: number, t: any) => a + (t.percentual || 0), 0) / tarefas.length);
  }, [tarefas]);

  const sortedTarefas = useMemo(() => {
    const s = [...tarefas];
    switch (sortField) {
      case "data_inicio": return s.sort((a, b) => (a.data_inicio || "").localeCompare(b.data_inicio || ""));
      case "percentual": return s.sort((a, b) => (a.percentual || 0) - (b.percentual || 0));
      case "titulo": return s.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
      default: return s.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
  }, [tarefas, sortField]);

  // ===== HELPERS: PLANILHA =====
  const resetColunaForm = () => { setColunaNome(""); setColunaTipo("texto"); setColunaOpcoes([{ valor: "A fazer", cor: "#6b7280" }, { valor: "Em progresso", cor: "#3b82f6" }, { valor: "Concluído", cor: "#10b981" }]); };
  const parseOpcoes = (col: any): { valor: string; cor: string }[] => { try { return typeof col.opcoes === "string" ? JSON.parse(col.opcoes) : (col.opcoes || []); } catch { return []; } };

  // Inline cell editing
  const startEditCell = (linhaId: string, colunaId: string, val: any) => { setEditingCell({ linhaId, colunaId }); setEditCellValue(val?.toString() || ""); };
  const saveCellEdit = () => {
    if (!editingCell) return;
    const linha = linhas.find((l: any) => l.id === editingCell.linhaId);
    if (linha) updateLinha.mutate({ linhaId: editingCell.linhaId, dados: { ...(linha.dados || {}), [editingCell.colunaId]: editCellValue } });
    setEditingCell(null);
  };
  const toggleCheckbox = (linhaId: string, colunaId: string, val: any) => {
    const linha = linhas.find((l: any) => l.id === linhaId);
    if (linha) updateLinha.mutate({ linhaId, dados: { ...(linha.dados || {}), [colunaId]: !val } });
  };
  const setCellSelectValue = (linhaId: string, colunaId: string, value: string) => {
    const linha = linhas.find((l: any) => l.id === linhaId);
    if (linha) updateLinha.mutate({ linhaId, dados: { ...(linha.dados || {}), [colunaId]: value } });
  };

  // Linha modal — LOCAL state (fixes the typing bug)
  const openLinhaModal = (linha: any) => {
    setEditingLinha(linha);
    setLinhaFormData({ ...(linha.dados || {}) });
    setLinhaModalTab("dados"); setLinhaUpdateTexto("");
  };

  // Update local form only (no DB call)
  const updateLocalField = (colunaId: string, value: any) => {
    setLinhaFormData(prev => ({ ...prev, [colunaId]: value }));
  };

  // Persist field to DB (called on blur for text, immediately for selects)
  const persistField = (colunaId: string, value: any) => {
    if (!editingLinha) return;
    const newDados = { ...linhaFormData, [colunaId]: value };
    setLinhaFormData(newDados);
    updateLinha.mutate({ linhaId: editingLinha.id, dados: newDados });
  };

  // Save all modal data and close
  const saveAndCloseLinhaModal = () => {
    if (editingLinha) updateLinha.mutate({ linhaId: editingLinha.id, dados: linhaFormData });
    setEditingLinha(null);
  };

  // Toggle expanded row
  const toggleExpanded = (linhaId: string) => {
    setExpandedLinhas(prev => { const n = new Set(prev); n.has(linhaId) ? n.delete(linhaId) : n.add(linhaId); return n; });
  };

  // Column resizing handlers
  const onResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault(); e.stopPropagation();
    const startW = colWidths[colId] || 150;
    resizeRef.current = { colId, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = ev.clientX - resizeRef.current.startX;
      const newW = Math.max(60, resizeRef.current.startW + diff);
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colId]: newW }));
    };
    const onUp = () => {
      if (resizeRef.current) {
        const finalW = colWidths[resizeRef.current.colId] || 150;
        updateColunaWidth.mutate({ colunaId: resizeRef.current.colId, largura: finalW });
      }
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const getColWidth = (colId: string, fallback: number = 150) => colWidths[colId] || fallback;

  // ===== GANTT DATA =====
  const ganttData = useMemo(() => {
    if (tarefas.length === 0) return null;
    const allDates = tarefas.flatMap((t: any) => { const d: Date[] = []; if (t.data_inicio) d.push(parseISO(t.data_inicio)); if (t.data_fim) d.push(parseISO(t.data_fim)); return d; }).filter(d => isValid(d));
    if (allDates.length === 0) return null;
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = Math.max(differenceInDays(maxDate, minDate) + 1, 1);
    const pxPerDay = Math.max(20, Math.min(40, 800 / totalDays));
    const timelineWidth = totalDays * pxPerDay;
    const months: { label: string; left: number; width: number }[] = [];
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) { const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); const s = Math.max(0, differenceInDays(cur, minDate)); const e = Math.min(totalDays, differenceInDays(next, minDate)); months.push({ label: format(cur, "MMM yyyy", { locale: ptBR }), left: s * pxPerDay, width: (e - s) * pxPerDay }); cur = next; }
    const todayOffset = differenceInDays(today, minDate);
    const todayPx = (todayOffset >= 0 && todayOffset <= totalDays) ? todayOffset * pxPerDay : null;
    return { minDate, maxDate, totalDays, pxPerDay, timelineWidth, months, todayPx };
  }, [tarefas]);

  useEffect(() => { if (ganttData?.todayPx != null && ganttScrollRef.current) ganttScrollRef.current.scrollLeft = Math.max(0, ganttData.todayPx - 200); }, [ganttData?.todayPx]);

  // ===== RENDER HELPERS =====
  const renderColMenu = (col: any, idx: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100 flex-shrink-0"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-xs text-muted-foreground" disabled>Tipo: {colunaTipoLabels[col.tipo] || col.tipo}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setRenameColunaId(col.id); setRenameColunaValue(col.nome); }}><Pencil className="h-3.5 w-3.5 mr-2" /> Renomear</DropdownMenuItem>
        {idx > 0 && <DropdownMenuItem onClick={() => reorderColuna.mutate({ colunaId: col.id, direction: "left" })}><ChevronLeft className="h-3.5 w-3.5 mr-2" /> Mover para esquerda</DropdownMenuItem>}
        {idx < colunas.length - 1 && <DropdownMenuItem onClick={() => reorderColuna.mutate({ colunaId: col.id, direction: "right" })}><ChevronRight className="h-3.5 w-3.5 mr-2" /> Mover para direita</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteColunaId(col.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Table cell renderer
  const renderCell = (col: any, linha: any) => {
    const valor = linha.dados?.[col.id];
    const isEd = editingCell?.linhaId === linha.id && editingCell?.colunaId === col.id;

    if (col.tipo === "checkbox") return <div className="flex items-center justify-center h-8 px-3"><Checkbox checked={!!valor} onCheckedChange={() => toggleCheckbox(linha.id, col.id, valor)} /></div>;

    if (col.tipo === "status" || col.tipo === "select") {
      const opcoes = parseOpcoes(col); const sel = opcoes.find((o: any) => o.valor === valor);
      return <Select value={valor || ""} onValueChange={(v) => setCellSelectValue(linha.id, col.id, v)}>
        <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/50 overflow-hidden">{sel ? <Badge variant="secondary" className="text-[11px] px-1.5 py-0 truncate max-w-full" style={{ backgroundColor: `${sel.cor}15`, color: sel.cor }}>{sel.valor}</Badge> : <SelectValue placeholder="—" />}</SelectTrigger>
        <SelectContent>{opcoes.map((o: any, i: number) => <SelectItem key={i} value={o.valor}><div className="flex items-center gap-2">{o.cor && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: o.cor }} />}{o.valor}</div></SelectItem>)}</SelectContent>
      </Select>;
    }

    if (col.tipo === "responsavel") return <Select value={valor || ""} onValueChange={(v) => setCellSelectValue(linha.id, col.id, v)}><SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/50 overflow-hidden"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}</SelectContent></Select>;

    if (isEd) return <Input autoFocus value={editCellValue} onChange={(e) => setEditCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setEditingCell(null); }} type={col.tipo === "numero" ? "number" : col.tipo === "data" ? "date" : "text"} className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset" />;

    return <div className="cursor-pointer hover:bg-muted/30 transition-colors px-2 h-8 flex items-center text-sm overflow-hidden" onClick={() => startEditCell(linha.id, col.id, valor)}>
      <span className="truncate">{col.tipo === "data" && valor ? (() => { try { return format(parseISO(valor), "dd/MM/yyyy"); } catch { return valor; } })() : valor || <span className="text-muted-foreground/40">—</span>}</span>
    </div>;
  };

  // Modal field renderer (uses LOCAL state)
  const renderModalField = (col: any) => {
    const valor = linhaFormData[col.id];

    if (col.tipo === "checkbox") return <div className="flex items-center py-1.5"><Checkbox checked={!!valor} onCheckedChange={(checked) => { updateLocalField(col.id, !!checked); persistField(col.id, !!checked); }} /></div>;

    if (col.tipo === "status" || col.tipo === "select") {
      const opcoes = parseOpcoes(col);
      return <Select value={valor || ""} onValueChange={(v) => { updateLocalField(col.id, v); persistField(col.id, v); }}><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{opcoes.map((o: any, i: number) => <SelectItem key={i} value={o.valor}><div className="flex items-center gap-2">{o.cor && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.cor }} />}{o.valor}</div></SelectItem>)}</SelectContent></Select>;
    }

    if (col.tipo === "responsavel") return <Select value={valor || ""} onValueChange={(v) => { updateLocalField(col.id, v); persistField(col.id, v); }}><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}</SelectContent></Select>;

    // Text, number, date — local state, save on blur
    return <Input value={valor || ""} onChange={(e) => updateLocalField(col.id, e.target.value)} onBlur={() => persistField(col.id, linhaFormData[col.id])} type={col.tipo === "numero" ? "number" : col.tipo === "data" ? "date" : "text"} />;
  };

  // ===== LOADING / NOT FOUND =====
  if (isLoading) return <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!projeto) return <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center"><div className="text-center space-y-4"><p className="text-muted-foreground">Projeto não encontrado</p><Button onClick={() => navigate("/plano-acao")} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button></div></div>;

  const sc = statusConfig[projeto.status] || statusConfig.em_andamento;
  const StatusIcon = sc.icon;

  // =============== JSX ===============
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* ====== HEADER ====== */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/plano-acao")} className="gap-2 -ml-2"><ArrowLeft className="h-4 w-4" /> Plano de Ação</Button>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${projeto.cor}15` }}>{projeto.tipo === "projeto" ? <GanttChart className="h-5 w-5" style={{ color: projeto.cor }} /> : <Table2 className="h-5 w-5" style={{ color: projeto.cor }} />}</div>
                <div><h1 className="text-2xl font-bold">{projeto.titulo}</h1>{projeto.descricao && <p className="text-sm text-muted-foreground mt-0.5">{projeto.descricao}</p>}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge style={{ backgroundColor: `${sc.cor}15`, color: sc.cor, borderColor: `${sc.cor}30` }}><StatusIcon className="h-3 w-3 mr-1" /> {sc.label}</Badge>
                {projeto.responsavel && <span className="text-sm text-muted-foreground">Responsável: {projeto.responsavel.nome}</span>}
                {projeto.data_inicio && projeto.data_fim && <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(parseISO(projeto.data_inicio), "dd/MM/yyyy")} → {format(parseISO(projeto.data_fim), "dd/MM/yyyy")}</span>}
                {projeto.tipo === "projeto" && <span className="text-sm font-medium">{progresso}% concluído</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddUpdate(true)} className="gap-1"><MessageSquarePlus className="h-4 w-4" /> Atualização</Button>
              <Button variant="outline" size="sm" onClick={openEditHeader} className="gap-1"><Edit className="h-4 w-4" /> Editar</Button>
            </div>
          </div>
          {projeto.tipo === "projeto" && <Progress value={progresso} className="h-2" />}
        </div>

        {/* ====== PROJETO (GANTT) — unchanged ====== */}
        {projeto.tipo === "projeto" && (
          <div className="space-y-6">
            {ganttData && sortedTarefas.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><GanttChart className="h-4 w-4" /> Cronograma</CardTitle><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Ordenar:</span><Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}><SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ordem">Ordem padrão</SelectItem><SelectItem value="data_inicio">Data início</SelectItem><SelectItem value="percentual">Progresso</SelectItem><SelectItem value="titulo">Nome</SelectItem></SelectContent></Select></div></div></CardHeader>
                <CardContent className="p-0">
                  <div className="flex border-t">
                    <div className="flex-shrink-0 w-[280px] border-r bg-muted/20">
                      <div className="h-10 border-b px-3 flex items-center"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarefa</span></div>
                      {sortedTarefas.map((t: any) => { const ov = isOverdue(t); const cp = isComplete(t); return (
                        <div key={t.id} className={cn("h-11 px-3 flex items-center gap-2 border-b cursor-pointer hover:bg-muted/50 transition-colors", cp && "opacity-60")} onClick={() => openEditTarefa(t)}>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 relative" style={{ backgroundColor: t.cor || "#3b82f6" }}>{cp && <CheckCircle className="h-3 w-3 text-green-500 absolute -top-0.5 -right-0.5" />}{ov && <AlertTriangle className="h-3 w-3 text-red-500 absolute -top-0.5 -right-0.5" />}</div>
                          <div className="min-w-0 flex-1"><p className={cn("text-sm font-medium truncate", cp && "line-through text-muted-foreground")}>{t.titulo}</p><p className="text-[10px] text-muted-foreground truncate">{t.responsavel && `${t.responsavel} · `}{t.data_inicio && format(parseISO(t.data_inicio), "dd/MM")} → {t.data_fim && format(parseISO(t.data_fim), "dd/MM/yy")}</p></div>
                          <span className={cn("text-xs font-medium flex-shrink-0", ov && "text-red-500")}>{t.percentual || 0}%</span>
                        </div>); })}
                    </div>
                    <div className="flex-1 overflow-x-auto" ref={ganttScrollRef}>
                      <div style={{ width: ganttData.timelineWidth, minWidth: "100%" }}>
                        <div className="h-10 border-b relative bg-muted/10">
                          {ganttData.months.map((m, i) => <div key={i} className="absolute top-0 h-full flex items-center px-2 text-xs font-medium text-muted-foreground border-l border-border/40" style={{ left: m.left, width: m.width }}>{m.width > 50 ? m.label : ""}</div>)}
                          {ganttData.todayPx != null && <div className="absolute top-0 h-full z-20" style={{ left: ganttData.todayPx }}><div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b shadow-sm">HOJE</div></div>}
                        </div>
                        <div className="relative">
                          {ganttData.todayPx != null && <div className="absolute top-0 bottom-0 w-[2px] bg-red-500/70 z-10 pointer-events-none" style={{ left: ganttData.todayPx, height: `${sortedTarefas.length * 44}px` }}><div className="absolute top-0 left-0 w-4 h-full bg-gradient-to-r from-red-500/10 to-transparent" /></div>}
                          {ganttData.months.map((m, i) => <div key={i} className="absolute top-0 border-l border-border/20" style={{ left: m.left, height: `${sortedTarefas.length * 44}px` }} />)}
                          {sortedTarefas.map((tarefa: any) => { const ini = parseISO(tarefa.data_inicio); const fim = parseISO(tarefa.data_fim); if (!isValid(ini) || !isValid(fim)) return null; const off = differenceInDays(ini, ganttData.minDate); const dur = Math.max(differenceInDays(fim, ini) + 1, 1); const left = off * ganttData.pxPerDay; const width = dur * ganttData.pxPerDay; const cp = isComplete(tarefa); const ov = isOverdue(tarefa); const pct = tarefa.percentual || 0; return (
                            <div key={tarefa.id} className="h-11 flex items-center border-b relative">
                              <div className={cn("absolute h-7 rounded-md flex items-center overflow-hidden cursor-pointer transition-all hover:shadow-md hover:brightness-110", cp && "opacity-50", ov && "ring-2 ring-red-500/60 ring-offset-1 ring-offset-background")} style={{ left, width: Math.max(width, 12), backgroundColor: tarefa.cor || "#3b82f6" }} onClick={() => openEditTarefa(tarefa)} onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPos({ x: r.left + r.width / 2, y: r.top - 8 }); setHoveredTarefa(tarefa); }} onMouseLeave={() => setHoveredTarefa(null)}>
                                <div className="absolute inset-0 bg-black/20" style={{ left: `${pct}%`, right: 0 }} /><span className="relative z-10 text-[11px] text-white font-medium px-2 truncate">{width > 50 ? `${pct}%` : ""}</span>
                                {cp && <CheckCircle className="relative z-10 h-3.5 w-3.5 text-white ml-auto mr-1 flex-shrink-0" />}{ov && width > 30 && <AlertTriangle className="relative z-10 h-3.5 w-3.5 text-white ml-auto mr-1 flex-shrink-0" />}
                              </div>
                            </div>); })}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {hoveredTarefa && <div className="fixed z-50 pointer-events-none" style={{ left: Math.min(hoverPos.x, window.innerWidth - 260), top: hoverPos.y, transform: "translate(-50%, -100%)" }}><div className="bg-popover border rounded-lg shadow-lg p-3 w-[240px] text-sm"><div className="flex items-center gap-2 mb-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredTarefa.cor || "#3b82f6" }} /><span className="font-semibold truncate">{hoveredTarefa.titulo}</span></div>{hoveredTarefa.responsavel && <p className="text-xs text-muted-foreground mb-1">Responsável: {hoveredTarefa.responsavel}</p>}<p className="text-xs text-muted-foreground mb-2">{hoveredTarefa.data_inicio && format(parseISO(hoveredTarefa.data_inicio), "dd/MM/yyyy")} → {hoveredTarefa.data_fim && format(parseISO(hoveredTarefa.data_fim), "dd/MM/yyyy")}</p><div className="flex items-center gap-2"><Progress value={hoveredTarefa.percentual || 0} className="h-1.5 flex-1" /><span className="text-xs font-medium">{hoveredTarefa.percentual || 0}%</span></div>{isOverdue(hoveredTarefa) && <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Atrasada</p>}{isComplete(hoveredTarefa) && <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Concluída</p>}</div></div>}
            <Card><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Tarefas ({tarefas.length})</CardTitle><Button size="sm" onClick={() => { resetTarefaForm(); setShowAddTarefa(true); }} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button></div></CardHeader><CardContent>{tarefas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa criada.</p> : <div className="space-y-2">{sortedTarefas.map((t: any) => { const ov = isOverdue(t); const cp = isComplete(t); return (<div key={t.id} className={cn("flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group", ov && "border-red-500/30 bg-red-50/50 dark:bg-red-950/10", cp && "opacity-60")}><div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: t.cor || "#3b82f6" }} /><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className={cn("font-medium text-sm truncate", cp && "line-through text-muted-foreground")}>{t.titulo}</span>{ov && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasada</Badge>}{cp && <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Concluída</Badge>}{t.responsavel && <span className="text-xs text-muted-foreground">· {t.responsavel}</span>}</div><div className="flex items-center gap-3 mt-1"><span className="text-xs text-muted-foreground">{t.data_inicio && format(parseISO(t.data_inicio), "dd/MM")} → {t.data_fim && format(parseISO(t.data_fim), "dd/MM/yy")}</span><Progress value={t.percentual || 0} className="h-1.5 flex-1 max-w-[100px]" /><span className="text-xs font-medium">{t.percentual || 0}%</span></div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTarefa(t)}><Edit className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarefaId(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>); })}</div>}</CardContent></Card>
          </div>
        )}

        {/* ====== PLANILHA (REDESIGNED) ====== */}
        {projeto.tipo === "planilha" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Columns className="h-4 w-4" /> Dados ({linhas.length} registro{linhas.length !== 1 ? "s" : ""})</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { resetColunaForm(); setShowAddColuna(true); }} className="gap-1"><Settings className="h-4 w-4" /> Coluna</Button>
                  <Button size="sm" onClick={() => addLinha.mutate()} className="gap-1"><Plus className="h-4 w-4" /> Linha</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {colunas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8 px-6">Nenhuma coluna configurada.</p> : (
                <div className="overflow-x-auto border-t">
                  <table className="w-max min-w-full border-collapse" style={{ tableLayout: "fixed" }}>
                    <thead>
                      <tr className="bg-muted/30">
                        {/* Sticky: # + first column + expand */}
                        <th className="sticky left-0 z-30 bg-muted/30 border-b border-r w-10 text-center text-xs font-medium text-muted-foreground p-0" style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.06)" }}>
                          <div className="px-2 py-2.5">#</div>
                        </th>
                        {colunas[0] && (
                          <th className="sticky z-30 bg-muted/30 border-b border-r p-0 group" style={{ left: 40, width: getColWidth(colunas[0].id), minWidth: getColWidth(colunas[0].id), boxShadow: "2px 0 4px -2px rgba(0,0,0,0.06)" }}>
                            <div className="flex items-center justify-between px-2 py-2 relative">
                              <span className="text-xs font-medium truncate">{colunas[0].nome}</span>
                              {renderColMenu(colunas[0], 0)}
                              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors" onMouseDown={(e) => onResizeStart(e, colunas[0].id)} />
                            </div>
                          </th>
                        )}
                        {/* Scrollable columns */}
                        {colunas.slice(1).map((col: any, i: number) => (
                          <th key={col.id} className="border-b border-r p-0 group" style={{ width: getColWidth(col.id), minWidth: getColWidth(col.id), maxWidth: getColWidth(col.id) }}>
                            <div className="flex items-center justify-between px-2 py-2 relative">
                              <span className="text-xs font-medium truncate">{col.nome}</span>
                              {renderColMenu(col, i + 1)}
                              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors" onMouseDown={(e) => onResizeStart(e, col.id)} />
                            </div>
                          </th>
                        ))}
                        {/* Atualizações column */}
                        <th className="border-b border-r p-0" style={{ width: 280, minWidth: 280 }}>
                          <div className="px-2 py-2 text-xs font-medium">Atualizações</div>
                        </th>
                        {/* Actions */}
                        <th className="border-b w-10 p-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha: any, idx: number) => {
                        const updates = atualizacoesByLinha[linha.id] || [];
                        const isExpanded = expandedLinhas.has(linha.id);
                        const firstCol = colunas[0];

                        return (
                          <tr key={linha.id} className="group hover:bg-muted/20">
                            {/* # (sticky) */}
                            <td className="sticky left-0 z-20 bg-background group-hover:bg-muted/20 border-b border-r text-center text-xs text-muted-foreground px-2 h-9" style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.06)" }}>{idx + 1}</td>
                            {/* First column (sticky) — with expand button inside */}
                            {firstCol && (
                              <td className="sticky z-20 bg-background group-hover:bg-muted/20 border-b border-r p-0 overflow-hidden" style={{ left: 40, width: getColWidth(firstCol.id), minWidth: getColWidth(firstCol.id), maxWidth: getColWidth(firstCol.id), boxShadow: "2px 0 4px -2px rgba(0,0,0,0.06)" }}>
                                <div className="flex items-center h-8">
                                  <div className="flex-1 min-w-0">{renderCell(firstCol, linha)}</div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mr-0.5" onClick={() => openLinhaModal(linha)}><Expand className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            )}
                            {/* Scrollable columns */}
                            {colunas.slice(1).map((col: any) => (
                              <td key={col.id} className="border-b border-r p-0 overflow-hidden" style={{ width: getColWidth(col.id), minWidth: getColWidth(col.id), maxWidth: getColWidth(col.id) }}>
                                {renderCell(col, linha)}
                              </td>
                            ))}
                            {/* Atualizações cell */}
                            <td className="border-b border-r p-0 align-top" style={{ width: 280, minWidth: 280, maxWidth: 280 }}>
                              <div className="px-2 py-1.5">
                                {updates.length === 0 && !isExpanded ? (
                                  <button className="text-xs text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1" onClick={() => toggleExpanded(linha.id)}>
                                    <Plus className="h-3 w-3" /> Adicionar
                                  </button>
                                ) : (
                                  <div>
                                    <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-1" onClick={() => toggleExpanded(linha.id)}>
                                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      <span className="font-medium">{updates.length} atualização{updates.length !== 1 ? "ões" : ""}</span>
                                    </button>
                                    {/* Always show latest update preview */}
                                    {!isExpanded && updates.length > 0 && (
                                      <p className="text-[11px] text-muted-foreground truncate">{format(new Date(updates[0].created_at), "dd/MM")} — {updates[0].texto}</p>
                                    )}
                                    {/* Expanded: all updates + add */}
                                    {isExpanded && (
                                      <div className="space-y-1.5 mt-1">
                                        {/* Add input */}
                                        <div className="flex gap-1">
                                          <Input value={inlineUpdateText[linha.id] || ""} onChange={(e) => setInlineUpdateText(p => ({ ...p, [linha.id]: e.target.value }))}
                                            placeholder="Nova atualização..." className="h-6 text-xs"
                                            onKeyDown={(e) => { if (e.key === "Enter" && (inlineUpdateText[linha.id] || "").trim()) addLinhaAtualizacao.mutate({ linhaId: linha.id, texto: inlineUpdateText[linha.id] }); }} />
                                          <Button size="icon" className="h-6 w-6 flex-shrink-0" disabled={!(inlineUpdateText[linha.id] || "").trim()} onClick={() => addLinhaAtualizacao.mutate({ linhaId: linha.id, texto: inlineUpdateText[linha.id] || "" })}><Send className="h-3 w-3" /></Button>
                                        </div>
                                        {/* List */}
                                        {updates.map((a: any) => (
                                          <div key={a.id} className="flex gap-1.5 text-[11px]">
                                            <span className="text-muted-foreground flex-shrink-0 font-medium">{format(new Date(a.created_at), "dd/MM")}</span>
                                            <span className="text-foreground">{a.texto}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            {/* Delete */}
                            <td className="border-b p-0">
                              <div className="flex items-center justify-center py-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setDeleteLinhaId(linha.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ====== ATUALIZAÇÕES DO PROJETO ====== */}
        {atualizacoes.length > 0 && <Card><CardHeader className="pb-3"><CardTitle className="text-base">Atualizações do Projeto</CardTitle></CardHeader><CardContent><div className="space-y-3">{atualizacoes.map((a: any) => <div key={a.id} className="flex gap-3 text-sm"><div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" /><div><p>{a.texto}</p><p className="text-xs text-muted-foreground mt-1">{a.autor?.nome || "Sistema"} · {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}{a.tarefa_id && <span className="italic"> · vinculada a uma tarefa</span>}</p></div></div>)}</div></CardContent></Card>}
      </div>

      {/* ====================== DIALOGS ====================== */}

      {/* --- Edit Header --- */}
      <Dialog open={showEditHeader} onOpenChange={setShowEditHeader}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Editar {projeto.tipo === "projeto" ? "Projeto" : "Planilha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={headerTitulo} onChange={(e) => setHeaderTitulo(e.target.value)} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={headerDescricao} onChange={(e) => setHeaderDescricao(e.target.value)} rows={3} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={headerStatus} onValueChange={setHeaderStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusConfig).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Responsável</Label><Select value={headerResponsavel} onValueChange={setHeaderResponsavel}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data início</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !headerDataInicio && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{headerDataInicio ? format(headerDataInicio, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={headerDataInicio} onSelect={setHeaderDataInicio} locale={ptBR} /></PopoverContent></Popover></div>
              <div className="space-y-2"><Label>Data fim</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !headerDataFim && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{headerDataFim ? format(headerDataFim, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={headerDataFim} onSelect={setHeaderDataFim} locale={ptBR} /></PopoverContent></Popover></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEditHeader(false)}>Cancelar</Button><Button onClick={saveHeader}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Tarefa modal --- */}
      <Dialog open={showAddTarefa || !!editingTarefa} onOpenChange={(o) => { if (!o) { setShowAddTarefa(false); setEditingTarefa(null); resetTarefaForm(); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0"><DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
          <Tabs value={editingTarefa ? tarefaModalTab : "detalhes"} onValueChange={setTarefaModalTab} className="flex-1 min-h-0 flex flex-col">
            {editingTarefa && <TabsList className="grid w-full grid-cols-2 flex-shrink-0"><TabsTrigger value="detalhes">Detalhes</TabsTrigger><TabsTrigger value="atualizacoes">Atualizações{tarefaAtualizacoes.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{tarefaAtualizacoes.length}</Badge>}</TabsTrigger></TabsList>}
            <TabsContent value="detalhes" className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 px-1 -mx-1">
              <div className="space-y-2"><Label>Título *</Label><Input value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)} placeholder="Ex: Licitação" /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={tarefaDescricao} onChange={(e) => setTarefaDescricao(e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Responsável</Label><Input value={tarefaResponsavel} onChange={(e) => setTarefaResponsavel(e.target.value)} placeholder="Nome" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Início *</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !tarefaDataInicio && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{tarefaDataInicio ? format(tarefaDataInicio, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={tarefaDataInicio} onSelect={setTarefaDataInicio} locale={ptBR} /></PopoverContent></Popover></div>
                <div className="space-y-2"><Label>Fim *</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !tarefaDataFim && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{tarefaDataFim ? format(tarefaDataFim, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={tarefaDataFim} onSelect={setTarefaDataFim} locale={ptBR} /></PopoverContent></Popover></div>
              </div>
              <div className="space-y-2"><Label>Progresso: {tarefaPercentual}%</Label><Slider value={[tarefaPercentual]} onValueChange={([v]) => setTarefaPercentual(v)} max={100} step={5} /></div>
              <div className="space-y-2"><Label>Cor</Label><div className="flex gap-2">{corOptions.map(c => <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${tarefaCor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setTarefaCor(c)} />)}</div></div>
            </TabsContent>
            {editingTarefa && <TabsContent value="atualizacoes" className="flex-1 min-h-0 flex flex-col mt-4">
              <div className="flex gap-2 mb-4 flex-shrink-0"><Input placeholder="Registrar atualização..." value={tarefaUpdateTexto} onChange={(e) => setTarefaUpdateTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tarefaUpdateTexto.trim()) addAtualizacao.mutate({ texto: tarefaUpdateTexto, tarefaId: editingTarefa.id }); }} /><Button size="icon" disabled={!tarefaUpdateTexto.trim()} onClick={() => addAtualizacao.mutate({ texto: tarefaUpdateTexto, tarefaId: editingTarefa.id })}><Send className="h-4 w-4" /></Button></div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">{tarefaAtualizacoes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atualização.</p> : tarefaAtualizacoes.map((a: any) => <div key={a.id} className="flex gap-3 text-sm border-b pb-3 last:border-0"><div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" /><div><p>{a.texto}</p><p className="text-xs text-muted-foreground mt-1">{a.autor?.nome || "Sistema"} · {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div></div>)}</div>
            </TabsContent>}
          </Tabs>
          <DialogFooter className="flex-shrink-0 pt-4 border-t"><Button variant="outline" onClick={() => { setShowAddTarefa(false); setEditingTarefa(null); resetTarefaForm(); }}>Cancelar</Button><Button onClick={saveTarefa} disabled={addTarefa.isPending || updateTarefa.isPending}>{editingTarefa ? "Salvar" : "Adicionar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Add Column --- */}
      <Dialog open={showAddColuna} onOpenChange={setShowAddColuna}>
        <DialogContent className="sm:max-w-[450px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0"><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-1 -mx-1">
            <div className="space-y-2"><Label>Nome *</Label><Input value={colunaNome} onChange={(e) => setColunaNome(e.target.value)} placeholder="Ex: Observações" /></div>
            <div className="space-y-2"><Label>Tipo</Label><Select value={colunaTipo} onValueChange={setColunaTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(colunaTipoLabels).filter(([k]) => k !== "select").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            {colunaTipo === "status" && (
              <div className="space-y-3"><Label>Opções da lista</Label>
                {colunaOpcoes.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Popover><PopoverTrigger asChild><button className="w-7 h-7 rounded-full border-2 border-border flex-shrink-0" style={{ backgroundColor: opt.cor }} /></PopoverTrigger>
                    <PopoverContent className="w-auto p-2"><div className="flex gap-1.5 flex-wrap max-w-[180px]">{["#6b7280","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#f97316","#ec4899","#84cc16"].map(c => <button key={c} className={`w-6 h-6 rounded-full border-2 ${opt.cor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => { const n = [...colunaOpcoes]; n[i] = { ...n[i], cor: c }; setColunaOpcoes(n); }} />)}</div></PopoverContent></Popover>
                    <Input value={opt.valor} onChange={(e) => { const n = [...colunaOpcoes]; n[i] = { ...n[i], valor: e.target.value }; setColunaOpcoes(n); }} className="h-8 text-sm" placeholder="Nome da opção" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setColunaOpcoes(colunaOpcoes.filter((_, j) => j !== i))} disabled={colunaOpcoes.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setColunaOpcoes([...colunaOpcoes, { valor: "", cor: "#6b7280" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar opção</Button>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t"><Button variant="outline" onClick={() => setShowAddColuna(false)}>Cancelar</Button><Button onClick={() => addColuna.mutate()} disabled={!colunaNome.trim() || addColuna.isPending}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Rename Column --- */}
      <Dialog open={!!renameColunaId} onOpenChange={(o) => !o && setRenameColunaId(null)}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader><DialogTitle>Renomear Coluna</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Novo nome</Label><Input value={renameColunaValue} onChange={(e) => setRenameColunaValue(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && renameColunaValue.trim() && renameColunaId) renameColuna.mutate({ colunaId: renameColunaId, nome: renameColunaValue.trim() }); }} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRenameColunaId(null)}>Cancelar</Button><Button onClick={() => renameColunaId && renameColuna.mutate({ colunaId: renameColunaId, nome: renameColunaValue.trim() })} disabled={!renameColunaValue.trim()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Linha Detail Modal (FIXED: local state for typing) --- */}
      <Dialog open={!!editingLinha} onOpenChange={(o) => { if (!o) saveAndCloseLinhaModal(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Expand className="h-4 w-4" /> Detalhes do Registro
              {editingLinha && colunas[0] && linhaFormData[colunas[0].id] && <span className="text-muted-foreground font-normal"> — {linhaFormData[colunas[0].id]}</span>}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={linhaModalTab} onValueChange={setLinhaModalTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="atualizacoes">Atualizações{linhaAtualizacoes.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{linhaAtualizacoes.length}</Badge>}</TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 px-1 -mx-1">
              {colunas.map((col: any) => (
                <div key={col.id} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">{col.nome}</Label>
                  {renderModalField(col)}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="atualizacoes" className="flex-1 min-h-0 flex flex-col mt-4">
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <Input placeholder="Registrar atualização..." value={linhaUpdateTexto} onChange={(e) => setLinhaUpdateTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && linhaUpdateTexto.trim() && editingLinha) addLinhaAtualizacao.mutate({ linhaId: editingLinha.id, texto: linhaUpdateTexto }); }} />
                <Button size="icon" disabled={!linhaUpdateTexto.trim()} onClick={() => editingLinha && addLinhaAtualizacao.mutate({ linhaId: editingLinha.id, texto: linhaUpdateTexto })}><Send className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                {linhaAtualizacoes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atualização.</p> : linhaAtualizacoes.map((a: any) => (
                  <div key={a.id} className="flex gap-3 text-sm border-b pb-3 last:border-0"><div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" /><div><p>{a.texto}</p><p className="text-xs text-muted-foreground mt-1">{a.autor?.nome || "Sistema"} · {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div></div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="flex-shrink-0 pt-4 border-t"><Button variant="outline" onClick={saveAndCloseLinhaModal}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Project Update --- */}
      <Dialog open={showAddUpdate} onOpenChange={setShowAddUpdate}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Registrar Atualização</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>O que mudou?</Label><Textarea value={updateTexto} onChange={(e) => setUpdateTexto(e.target.value)} placeholder="Ex: Licitação publicada..." rows={4} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddUpdate(false)}>Cancelar</Button><Button onClick={() => addAtualizacao.mutate({ texto: updateTexto })} disabled={!updateTexto.trim()}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Alert Dialogs --- */}
      <AlertDialog open={!!deleteTarefaId} onOpenChange={(o) => !o && setDeleteTarefaId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir tarefa?</AlertDialogTitle><AlertDialogDescription>Ação irreversível.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTarefaId && deleteTarefa.mutate(deleteTarefaId)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deleteLinhaId} onOpenChange={(o) => !o && setDeleteLinhaId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir linha?</AlertDialogTitle><AlertDialogDescription>Os dados serão removidos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteLinhaId && deleteLinha.mutate(deleteLinhaId)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deleteColunaId} onOpenChange={(o) => !o && setDeleteColunaId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir coluna?</AlertDialogTitle><AlertDialogDescription>Coluna e dados associados serão removidos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteColunaId && deleteColuna.mutate(deleteColunaId)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
