import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Calendar, MapPin, User, AlertTriangle, Trash2, X, ChevronDown, CheckSquare, MessageSquare, Clock, Route, History, FileText, ListTodo, MoreHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateTime, formatDateOnly } from '@/lib/dateUtils';
import { logError } from '@/lib/errorUtils';
import { registrarHistorico, capturarSnapshotTarefa } from '@/lib/kanbanHistoricoUtils';
import { AdicionarDemandasKanbanDialog } from "@/components/forms/AdicionarDemandasKanbanDialog";
import { AdicionarTarefaDialog } from "@/components/forms/AdicionarTarefaDialog";
import { AdicionarRotasKanbanDialog } from "@/components/forms/AdicionarRotasKanbanDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { ViewTarefaDialog } from "@/components/forms/ViewTarefaDialog";
import { ViewRotaKanbanDialog } from "@/components/forms/ViewRotaKanbanDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { EditTarefaDialog } from "@/components/forms/EditTarefaDialog";
import { HistoricoView } from "@/components/kanban/HistoricoView";
import { BoardGallery } from "@/components/kanban/BoardGallery";
import { BoardView } from "@/components/kanban/BoardView";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { KanbanBoard } from "@/hooks/useKanbanBoards";
import { FEATURES } from "@/lib/featureFlags";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { fetchAll } from "@/lib/fetchAll";
import { normalizarBusca } from "@/lib/busca";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ConfirmarStatusDemandaDialog,
  MovimentoDemandaKanban,
  sugerirStatusParaColuna,
} from "@/components/kanban/ConfirmarStatusDemandaDialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface KanbanItem {
  id: string;
  titulo: string;
  protocolo: string;
  descricao: string;
  status: string;
  kanban_position: string;
  prioridade: string;
  data_prazo: string | null;
  created_at: string;
  posicao_desde?: string;
  areas?: { nome: string };
  municipes?: { nome: string };
  responsavel_id?: string;
  municipe_id?: string | null;
  tipo?: 'demanda' | 'tarefa' | 'rota';
  tarefa_responsavel_id?: string;
  eixo_id?: string;
  checklist_total?: number;
  checklist_done?: number;
  comentarios_count?: number;
  // Campos de rota
  rota_status?: string;
  data_programada?: string;
  pontos_count?: number;
  pontos_visitados?: number;
  usuario_nome?: string;
  observacoes?: string;
  observacoes_conclusao?: string;
  rota_pontos?: any[];
}

type ViewMode = 'board' | 'historico';

const statusColumns = [
  { id: 'a_fazer', title: 'A Fazer', color: 'hsl(var(--chart-1))' },
  { id: 'em_progresso', title: 'Em Progresso', color: 'hsl(var(--chart-2))' },
  { id: 'feito', title: 'Feito', color: 'hsl(var(--chart-4))' },
];

export default function Kanban() {
  const [selectedDemanda, setSelectedDemanda] = useState<KanbanItem | null>(null);
  const [selectedTarefa, setSelectedTarefa] = useState<any>(null);
  const [selectedRota, setSelectedRota] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewTarefaDialogOpen, setIsViewTarefaDialogOpen] = useState(false);
  const [isEditTarefaDialogOpen, setIsEditTarefaDialogOpen] = useState(false);
  const [isViewRotaDialogOpen, setIsViewRotaDialogOpen] = useState(false);
  const [isAdicionarDialogOpen, setIsAdicionarDialogOpen] = useState(false);
  const [isAdicionarRotasDialogOpen, setIsAdicionarRotasDialogOpen] = useState(false);
  // Quadro aberto: vem de /kanban?quadro=... (galeria dos Quadros) ou o da equipe
  const [selectedUser, setSelectedUser] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get('quadro') || "producao-legislativa"; } catch { return "producao-legislativa"; }
  });
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [activeColumn, setActiveColumn] = useState('a_fazer');
  const [isAdicionarTarefaOpen, setIsAdicionarTarefaOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isDraggingRef = useRef(false);
  
  // ── Estado das abas (Pessoal / Projetos) ──
  const [activeTab, setActiveTab] = useState<'pessoal' | 'projetos'>('pessoal');
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoard | null>(null);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);

  // ── Confirmação de status ao mover demanda de coluna ──
  const { statusList } = useDemandaStatus();
  const [movimentoDemanda, setMovimentoDemanda] = useState<MovimentoDemandaKanban | null>(null);
  // ── Filtros do quadro ──
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'demanda' | 'tarefa'>('todos');
  const [soAtrasados, setSoAtrasados] = useState(false);
  // "Feito": por padrão só os concluídos recentemente; o resto fica recolhido
  const [verFeitoAntigo, setVerFeitoAntigo] = useState(false);

  // Exclusão de tarefa sempre confirmada (apaga checklist e comentários junto)
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<any>(null);

  const processedTaskIdRef = useRef<string | null>(null);
  const isClosingModalRef = useRef(false);

  // ══════════════════════════════════════════════
  //  QUERY: Buscar demandas, tarefas E rotas
  // ══════════════════════════════════════════════
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-kanban', selectedUser],
    queryFn: async () => {
      // ── 1. Demandas ──
      // Junção feita pelo banco (antes: lista de IDs na URL, que quebraria
      // perto de ~850 cartões) e paginada (sem o limite de 1.000).
      let kanbanData: any[];
      try {
        kanbanData = await fetchAll((from, to) =>
          supabase
            .from('demanda_kanbans')
            .select(`
              id, kanban_position, updated_at,
              demandas!inner(*, areas(nome), municipes(nome))
            `)
            .eq('kanban_type', selectedUser)
            .order('id')
            .range(from, to) as any
        );
      } catch (kanbanError) {
        logError('Erro ao buscar kanban:', kanbanError);
        throw kanbanError;
      }

      const demandasCompletas: any[] = kanbanData
        .map((k: any) => ({
          ...k.demandas,
          kanban_position: k.kanban_position || 'a_fazer',
          // quando o cartão chegou na coluna atual (última movimentação)
          posicao_desde: k.updated_at,
          tipo: 'demanda',
        }))
        .sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));

      // ── 2. Tarefas ── (filtradas no banco: antes vinham as do gabinete inteiro)
      let tarefasData: any[] = [];
      let qTarefas = supabase
        .from('tarefas')
        .select(`
          *,
          tarefa_colaboradores(
            colaborador:profiles(id, nome)
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedUser === "producao-legislativa") {
        qTarefas = qTarefas.eq('kanban_type', selectedUser);
      } else {
        const { data: colab, error: colabError } = await supabase
          .from('tarefa_colaboradores')
          .select('tarefa_id')
          .eq('colaborador_id', selectedUser);
        if (colabError) throw colabError;
        const idsColab = (colab || []).map((c: any) => c.tarefa_id);
        qTarefas = idsColab.length > 0
          ? qTarefas.or(`kanban_type.eq.${selectedUser},id.in.(${idsColab.join(',')})`)
          : qTarefas.eq('kanban_type', selectedUser);
      }

      const { data, error } = await qTarefas;
      if (error) {
        logError('Erro ao buscar tarefas:', error);
        throw error;
      }
      tarefasData = data || [];

      // Batch fetch checklist + comentários
      const tarefaIds = tarefasData.map(t => t.id);
      let checklistCounts: Record<string, { total: number; done: number }> = {};
      let commentCounts: Record<string, number> = {};

      if (tarefaIds.length > 0) {
        const { data: checklistData } = await supabase
          .from('tarefa_checklist_items')
          .select('tarefa_id, concluido')
          .in('tarefa_id', tarefaIds);

        if (checklistData) {
          for (const item of checklistData) {
            if (!checklistCounts[item.tarefa_id]) {
              checklistCounts[item.tarefa_id] = { total: 0, done: 0 };
            }
            checklistCounts[item.tarefa_id].total++;
            if (item.concluido) checklistCounts[item.tarefa_id].done++;
          }
        }

        const { data: commentData } = await supabase
          .from('tarefa_comentarios')
          .select('tarefa_id')
          .in('tarefa_id', tarefaIds);

        if (commentData) {
          for (const item of commentData) {
            commentCounts[item.tarefa_id] = (commentCounts[item.tarefa_id] || 0) + 1;
          }
        }
      }
      
      const tarefasFormatadas = tarefasData?.map(tarefa => ({
        id: tarefa.id,
        titulo: tarefa.titulo,
        protocolo: `TAREFA-${tarefa.id.slice(0, 8)}`,
        descricao: tarefa.descricao || '',
        status: tarefa.completed ? 'atendido' : 'solicitada',
        kanban_position: tarefa.kanban_position,
        prioridade: tarefa.prioridade,
        data_prazo: tarefa.data_prazo || null,
        created_at: tarefa.created_at,
        // quando chegou na coluna atual: conclusão (Feito) ou última alteração
        posicao_desde: tarefa.completed_at || tarefa.updated_at,
        responsavel_id: tarefa.responsavel_id || tarefa.created_by,
        tipo: 'tarefa' as const,
        cor: tarefa.cor || '#3B82F6',
        colaboradores: tarefa.tarefa_colaboradores?.map((tc: any) => tc.colaborador) || [],
        checklist_total: checklistCounts[tarefa.id]?.total || 0,
        checklist_done: checklistCounts[tarefa.id]?.done || 0,
        comentarios_count: commentCounts[tarefa.id] || 0,
      })) || [];
      
      // ── 3. Rotas ──
      const { data: kanbanRotasData, error: kanbanRotasError } = await supabase
        .from('kanban_rotas')
        .select('rota_id, kanban_position')
        .eq('kanban_type', selectedUser);

      if (kanbanRotasError) {
        logError('Erro ao buscar kanban_rotas:', kanbanRotasError);
      }

      let rotasFormatadas: any[] = [];

      if (kanbanRotasData && kanbanRotasData.length > 0) {
        const rotaIds = kanbanRotasData.map(k => k.rota_id);
        const { data: rotasData, error: rotasError } = await supabase
          .from('rotas')
          .select(`
            *,
            rota_pontos(id, ordem, nome, endereco, latitude, longitude, tipo, visitado, horario_agendado, duracao_estimada, referencia_id, observacao_visita)
          `)
          .in('id', rotaIds)
          .order('data_programada', { ascending: true });

        if (rotasError) {
          logError('Erro ao buscar rotas:', rotasError);
        } else if (rotasData) {
          const usuarioIds = [...new Set(rotasData.map(r => r.usuario_id))];
          let profilesMap = new Map<string, string>();
          if (usuarioIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, nome')
              .in('id', usuarioIds);
            profilesMap = new Map(profiles?.map((p: any) => [p.id, p.nome]) || []);
          }

          rotasFormatadas = rotasData.map(rota => {
            const kanbanInfo = kanbanRotasData.find(k => k.rota_id === rota.id);
            const pontos = (rota.rota_pontos || []).sort((a: any, b: any) => a.ordem - b.ordem);
            const pontosVisitados = pontos.filter((p: any) => p.visitado).length;

            return {
              id: rota.id,
              titulo: rota.titulo,
              protocolo: `ROTA-${rota.id.slice(0, 8)}`,
              descricao: rota.observacoes || '',
              status: rota.status,
              rota_status: rota.status,
              kanban_position: kanbanInfo?.kanban_position || 'a_fazer',
              prioridade: 'media',
              data_prazo: null,
              data_programada: rota.data_programada,
              created_at: rota.created_at,
              responsavel_id: rota.usuario_id,
              tipo: 'rota' as const,
              pontos_count: pontos.length,
              pontos_visitados: pontosVisitados,
              usuario_nome: profilesMap.get(rota.usuario_id) || 'Usuário',
              observacoes: rota.observacoes,
              observacoes_conclusao: rota.observacoes_conclusao,
              rota_pontos: pontos,
            };
          });
        }
      }

      return [...demandasCompletas, ...tarefasFormatadas, ...rotasFormatadas];
    }
  });

  // Buscar responsáveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) {
        logError('Erro ao buscar responsáveis:', error);
        throw error;
      }
      return data || [];
    }
  });

  // ══════════════════════════════════════════════
  //  Redirecionamento de notificação
  // ══════════════════════════════════════════════
  useEffect(() => {
    const tarefaId = searchParams.get('tarefa');
    
    if (isClosingModalRef.current) return;
    
    if (tarefaId && tarefaId !== processedTaskIdRef.current && demandas.length > 0) {
      processedTaskIdRef.current = tarefaId;
      
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('tarefa');
      setSearchParams(newSearchParams, { replace: true });
      
      // Garantir que estamos no modo board
      setViewMode('board');
      
      const tarefaEncontrada = demandas.find(d => d.id === tarefaId && d.tipo === 'tarefa');
      
      if (tarefaEncontrada) {
        setSelectedTarefa(tarefaEncontrada);
        setIsViewTarefaDialogOpen(true);
      } else {
        const buscarTarefaEspecifica = async () => {
          try {
            const { data: user } = await supabase.auth.getUser();
            if (!user?.user?.id) return;
            
            const { data: tarefa, error } = await supabase
              .from('tarefas')
              .select(`*, tarefa_colaboradores(colaborador_id)`)
              .eq('id', tarefaId)
              .single();
            
            if (error || !tarefa) {
              toast.error("Tarefa não encontrada");
              return;
            }
            
            const isColaborador = tarefa.tarefa_colaboradores?.some(
              (tc: any) => tc.colaborador_id === user.user.id
            );
            
            const selectedUserCorreto = isColaborador ? user.user.id : tarefa.kanban_type;
            
            if (selectedUserCorreto !== selectedUser) {
              setSelectedUser(selectedUserCorreto);
            } else {
              toast.error("Tarefa não encontrada neste kanban");
            }
          } catch (error) {
            logError('Erro ao processar redirecionamento:', error);
            toast.error("Erro ao abrir tarefa");
          }
        };
        buscarTarefaEspecifica();
      }
    }
    
    if (!tarefaId && processedTaskIdRef.current) {
      processedTaskIdRef.current = null;
    }
  }, [searchParams, demandas, selectedUser]);

  const handleCloseViewTarefaDialog = (open: boolean) => {
    if (!open) {
      isClosingModalRef.current = true;
      setIsViewTarefaDialogOpen(false);
      setSelectedTarefa(null);
      
      const tarefaId = searchParams.get('tarefa');
      if (tarefaId) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('tarefa');
        setSearchParams(newSearchParams, { replace: true });
      }
      
      setTimeout(() => {
        isClosingModalRef.current = false;
      }, 100);
    } else {
      setIsViewTarefaDialogOpen(true);
    }
  };

  // ══════════════════════════════════════════════
  //  Mutations (com registro de histórico)
  // ══════════════════════════════════════════════
  // "Limpar Kanban": tira os cartões de DEMANDA (e rotas) do quadro.
  // As demandas continuam existindo; tarefas NÃO são apagadas (antes eram,
  // junto com checklist e comentários, sem como desfazer).
  const limparKanbanMutation = useMutation({
    mutationFn: async () => {
      const itensParaRegistrar = demandas
        .filter(item => (item.tipo || 'demanda') !== 'tarefa')
        .map(item => ({
          item_id: item.id,
          item_tipo: (item.tipo || 'demanda') as 'demanda' | 'tarefa' | 'rota',
          item_titulo: item.titulo,
          kanban_type: selectedUser,
          posicao_anterior: item.kanban_position,
          posicao_nova: null as string | null,
          acao: 'removido' as const,
          snapshot: null,
        }));

      if (itensParaRegistrar.length > 0) {
        const { registrarHistoricoBatch } = await import('@/lib/kanbanHistoricoUtils');
        registrarHistoricoBatch(itensParaRegistrar);
      }

      const { error } = await supabase
        .from('demanda_kanbans')
        .delete()
        .eq('kanban_type', selectedUser);
      if (error) throw error;

      const { error: rotasError } = await supabase
        .from('kanban_rotas')
        .delete()
        .eq('kanban_type', selectedUser);
      if (rotasError) throw rotasError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico-removidos'] }); queryClient.invalidateQueries({ queryKey: ['kanban-historico-trajetoria'] });
      toast.success("Demandas retiradas do quadro. As tarefas foram mantidas.");
    },
    onError: (error) => {
      logError('Erro ao limpar kanban:', error);
      toast.error(`Erro ao limpar kanban: ${error.message}`);
    }
  });

  const removerDemandaMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      // Encontrar o item para registrar no histórico
      const item = demandas.find(d => d.id === demandaId);
      if (item) {
        registrarHistorico({
          item_id: demandaId,
          item_tipo: 'demanda',
          item_titulo: item.titulo,
          kanban_type: selectedUser,
          posicao_anterior: item.kanban_position,
          acao: 'removido',
        });
      }

      const { error } = await supabase
        .from('demanda_kanbans').delete()
        .eq('demanda_id', demandaId).eq('kanban_type', selectedUser);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico-removidos'] }); queryClient.invalidateQueries({ queryKey: ['kanban-historico-trajetoria'] });
      toast.success("Demanda removida do kanban!");
    },
    onError: (error) => {
      logError('Erro ao remover demanda:', error);
      toast.error("Erro ao remover demanda");
    }
  });

  const removerTarefaMutation = useMutation({
    mutationFn: async (tarefaId: string) => {
      const item = demandas.find(d => d.id === tarefaId);

      // Capturar snapshot completo ANTES de deletar
      const snapshot = await capturarSnapshotTarefa(tarefaId);

      if (item) {
        registrarHistorico({
          item_id: tarefaId,
          item_tipo: 'tarefa',
          item_titulo: item.titulo,
          kanban_type: selectedUser,
          posicao_anterior: item.kanban_position,
          acao: 'removido',
          snapshot,
        });
      }

      const { error } = await supabase.from('tarefas').delete().eq('id', tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico-removidos'] }); queryClient.invalidateQueries({ queryKey: ['kanban-historico-trajetoria'] });
      toast.success("Tarefa removida!");
    },
    onError: (error) => {
      logError('Erro ao remover tarefa:', error);
      toast.error("Erro ao remover tarefa");
    }
  });

  const removerRotaMutation = useMutation({
    mutationFn: async (rotaId: string) => {
      const item = demandas.find(d => d.id === rotaId);
      if (item) {
        registrarHistorico({
          item_id: rotaId,
          item_tipo: 'rota',
          item_titulo: item.titulo,
          kanban_type: selectedUser,
          posicao_anterior: item.kanban_position,
          acao: 'removido',
        });
      }

      const { error } = await supabase
        .from('kanban_rotas').delete()
        .eq('rota_id', rotaId).eq('kanban_type', selectedUser);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico-removidos'] }); queryClient.invalidateQueries({ queryKey: ['kanban-historico-trajetoria'] });
      toast.success("Rota removida do kanban!");
    },
    onError: (error) => {
      logError('Erro ao remover rota:', error);
      toast.error("Erro ao remover rota");
    }
  });

  // ══════════════════════════════════════════════
  //  Helpers
  // ══════════════════════════════════════════════
  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))';
      case 'media': return 'hsl(var(--chart-2))';
      case 'alta': return 'hsl(var(--chart-1))';
      case 'urgente': return 'hsl(var(--chart-5))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return prioridade;
    }
  };

  const getRotaStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const isOverdue = (dataPrazo: string | null) => {
    if (!dataPrazo) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = new Date(dataPrazo.includes('T') ? dataPrazo : dataPrazo + 'T00:00:00');
    return today > prazo;
  };

  const getResponsavelNome = (responsavelId: string | undefined) => {
    if (!responsavelId) return '';
    const responsavel = responsaveis.find(r => r.id === responsavelId);
    return responsavel?.nome || '';
  };

  const getCardBorderColor = (item: any) => {
    if (item.tipo === 'rota') return '#10B981';
    if (item.tipo === 'tarefa') return item.cor || '#3B82F6';
    return 'hsl(var(--primary))';
  };

  // Mutation para atualizar posição (com histórico)
  const updatePositionMutation = useMutation({
    mutationFn: async ({ itemId, newPosition, tipo }: { itemId: string, newPosition: string, tipo: string }) => {
      // Encontrar item para registrar histórico
      const item = demandas.find(d => d.id === itemId);
      if (item) {
        registrarHistorico({
          item_id: itemId,
          item_tipo: (tipo || 'demanda') as 'demanda' | 'tarefa' | 'rota',
          item_titulo: item.titulo,
          kanban_type: selectedUser,
          posicao_anterior: item.kanban_position,
          posicao_nova: newPosition,
          acao: 'movido',
        });
      }

      if (tipo === 'tarefa') {
        // Coluna "Feito" = tarefa concluída (antes só o formulário marcava,
        // e arrastar deixava a tarefa em Feito como "não concluída").
        const concluida = newPosition === 'feito';
        const mudouConclusao = item && (item.kanban_position === 'feito') !== concluida;
        const { error } = await supabase
          .from('tarefas')
          .update({
            kanban_position: newPosition,
            ...(mudouConclusao ? { completed: concluida, completed_at: concluida ? new Date().toISOString() : null } : {}),
          })
          .eq('id', itemId);
        if (error) throw error;
      } else if (tipo === 'rota') {
        const { error } = await supabase
          .from('kanban_rotas').update({ kanban_position: newPosition })
          .eq('rota_id', itemId).eq('kanban_type', selectedUser);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('demanda_kanbans').update({ kanban_position: newPosition })
          .eq('demanda_id', itemId).eq('kanban_type', selectedUser);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['kanban-historico-removidos'] }); queryClient.invalidateQueries({ queryKey: ['kanban-historico-trajetoria'] });
      setTimeout(() => { isDraggingRef.current = false; }, 100);
    },
    onError: (error) => {
      logError('Erro ao atualizar posição:', error);
      toast.error("Erro ao atualizar posição do item");
      isDraggingRef.current = false;
    }
  });

  /** Move um item de coluna — usado pelo arrastar e pelo menu "Mover para…". */
  const moverItem = (item: any, destino: string) => {
    if (!item || item.kanban_position === destino) return;
    const tipo = item.tipo || 'demanda';
    updatePositionMutation.mutate({ itemId: item.id, newPosition: destino, tipo });

    // Demanda mudou de coluna: perguntar se o status da demanda também deve mudar.
    // Não pergunta quando a sugestão já é o status atual (nada a sincronizar).
    if (tipo === 'demanda') {
      const sugestao = sugerirStatusParaColuna(destino, statusList);
      if (sugestao && sugestao !== item.status) {
        setMovimentoDemanda({
          demanda: {
            id: item.id,
            titulo: item.titulo,
            protocolo: item.protocolo,
            status: item.status,
            municipe_id: item.municipe_id,
          },
          colunaDestino: destino,
          colunaDestinoTitulo: statusColumns.find(c => c.id === destino)?.title || destino,
        });
      }
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    isDraggingRef.current = true;

    if (!destination || destination.droppableId === source.droppableId) {
      // Reordenar dentro da coluna não é salvo (a ordem é por data); nada a fazer
      setTimeout(() => { isDraggingRef.current = false; }, 100);
      return;
    }

    const item = demandas.find(d => d.id === draggableId);
    if (!item) { isDraggingRef.current = false; return; }
    moverItem(item, destination.droppableId);
  };

  // ── Filtros aplicados aos cartões ──
  const filtrosAtivos = !!filtroTexto.trim() || filtroResponsavel !== "todos" || filtroTipo !== "todos" || soAtrasados;
  const itensFiltrados = useMemo(() => {
    const palavras = normalizarBusca(filtroTexto).split(/\s+/).filter(Boolean);
    return demandas.filter((item: any) => {
      if (filtroTipo !== 'todos' && (item.tipo || 'demanda') !== filtroTipo) return false;
      if (soAtrasados && !(isOverdue(item.data_prazo) && item.kanban_position !== 'feito')) return false;
      if (filtroResponsavel !== 'todos') {
        const pessoas = [item.responsavel_id, item.tarefa_responsavel_id, ...(item.colaboradores || []).map((c: any) => c?.id)];
        if (!pessoas.includes(filtroResponsavel)) return false;
      }
      if (palavras.length) {
        const alvo = normalizarBusca([item.titulo, item.protocolo, item.descricao, item.municipes?.nome, item.areas?.nome].filter(Boolean).join(' '));
        if (!palavras.every((p) => alvo.includes(p))) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandas, filtroTexto, filtroResponsavel, filtroTipo, soAtrasados]);

  const DIAS_FEITO_VISIVEL = 30;
  const limiteFeito = Date.now() - DIAS_FEITO_VISIVEL * 86400000;
  const ehFeitoAntigo = (item: any) =>
    item.kanban_position === 'feito' && !!item.posicao_desde && new Date(item.posicao_desde).getTime() < limiteFeito;
  const feitoAntigos = itensFiltrados.filter(ehFeitoAntigo).length;

  /** Cartões da coluna (respeita filtros; em Feito, esconde os antigos até pedir). */
  const getDemandsByStatus = (kanbanPosition: string) => {
    const daColuna = itensFiltrados.filter((item: KanbanItem) => item.kanban_position === kanbanPosition);
    if (kanbanPosition !== 'feito' || verFeitoAntigo) return daColuna;
    return daColuna.filter((item) => !ehFeitoAntigo(item));
  };
  /** Total da coluna para o contador (inclui os recolhidos de Feito). */
  const totalDaColuna = (kanbanPosition: string) =>
    itensFiltrados.filter((item: KanbanItem) => item.kanban_position === kanbanPosition).length;

  const handleEditDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleEditTarefa = (tarefa: any) => {
    setSelectedTarefa(tarefa);
    setIsViewTarefaDialogOpen(false);
    setIsEditTarefaDialogOpen(true);
  };

  // ══════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando kanban...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-3 py-3 md:p-6">
        {/* ═══════════════════════════════════════════════════
            TÍTULO + ABAS (Pessoal / Projetos)
            ═══════════════════════════════════════════════════ */}
        <div className="flex items-center gap-4 mb-4 md:mb-6">
          <Link to="/quadros" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-label="Voltar aos Quadros">
            <ArrowLeft className="h-4 w-4" /> Quadros
          </Link>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Kanban</h1>
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            <button
              className={`px-3 py-1.5 text-xs md:text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'pessoal'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('pessoal')}
            >
              📋 Pessoal
            </button>
            <button
              className={`px-3 py-1.5 text-xs md:text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'projetos'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => { setActiveTab('projetos'); setSelectedBoard(null); }}
            >
              📂 Projetos
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            ABA PROJETOS
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'projetos' && (
          <>
            {selectedBoard ? (
              <BoardView
                board={selectedBoard}
                onBack={() => setSelectedBoard(null)}
              />
            ) : (
              <BoardGallery
                onSelectBoard={(board) => setSelectedBoard(board)}
                onCreateBoard={() => setIsCreateBoardOpen(true)}
              />
            )}
            <CreateBoardDialog
              open={isCreateBoardOpen}
              onOpenChange={setIsCreateBoardOpen}
            />
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            ABA PESSOAL (conteúdo original do kanban)
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'pessoal' && (
        <>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-6">
          <div className="space-y-1 md:space-y-2">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              
              <div className="flex items-center gap-2 md:gap-3">
                {/* Dropdown de usuário */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-0 md:min-w-[200px] max-w-[160px] md:max-w-none justify-between bg-background/50 backdrop-blur border shadow-sm hover:shadow-md text-xs md:text-sm h-8 md:h-9">
                      <span className="truncate">
                      {selectedUser === "producao-legislativa" 
                        ? "Produção Legislativa" 
                        : responsaveis.find(r => r.id === selectedUser)?.nome || "Selecionar usuário"
                      }
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 opacity-50 shrink-0 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px] bg-background/95 backdrop-blur border shadow-lg">
                    <DropdownMenuItem 
                      onClick={() => setSelectedUser("producao-legislativa")}
                      className={selectedUser === "producao-legislativa" ? "bg-accent" : ""}
                    >
                      Produção Legislativa
                    </DropdownMenuItem>
                    {responsaveis.map((responsavel) => (
                      <DropdownMenuItem 
                        key={responsavel.id}
                        onClick={() => setSelectedUser(responsavel.id)}
                        className={selectedUser === responsavel.id ? "bg-accent" : ""}
                      >
                        {responsavel.nome}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* ── Toggle Board | Histórico ── */}
                <div className="flex rounded-lg border bg-muted/30 p-0.5">
                  <button
                    className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                      viewMode === 'board'
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setViewMode('board')}
                  >
                    Board
                  </button>
                  <button
                    className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                      viewMode === 'historico'
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setViewMode('historico')}
                  >
                    <History className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    <span className="hidden md:inline">Histórico</span>
                  </button>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground hidden md:block">
              {viewMode === 'board' 
                ? 'Visualize e gerencie as tarefas, demandas e rotas em formato kanban'
                : 'Consulte o histórico de movimentações por período'
              }
            </p>
          </div>

          {/* Botões de ação (só no modo board) */}
          {viewMode === 'board' && (
            <>
            {/* Desktop: botões originais */}
            <div className="hidden md:flex items-center gap-3">
              <AdicionarTarefaDialog kanbanType={selectedUser} />
              
              <Button onClick={() => setIsAdicionarDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Demanda
              </Button>

              {FEATURES.rotas && (
                <Button
                  onClick={() => setIsAdicionarRotasDialogOpen(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Route className="h-4 w-4" />
                  Adicionar Rota
                </Button>
              )}
              
              <AdicionarDemandasKanbanDialog 
                open={isAdicionarDialogOpen}
                onOpenChange={setIsAdicionarDialogOpen}
                selectedUser={selectedUser}
              />

              <AdicionarRotasKanbanDialog
                open={isAdicionarRotasDialogOpen}
                onOpenChange={setIsAdicionarRotasDialogOpen}
                selectedUser={selectedUser}
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Limpar Kanban
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza do kanban</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os {demandas.filter(d => d.tipo !== 'tarefa').length} cartões de demanda saem deste quadro.
                      As demandas em si não são apagadas e continuam em Demandas, com o mesmo status.
                      As tarefas do quadro são mantidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => limparKanbanMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Mobile: menu compacto */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsAdicionarTarefaOpen(true)}>
                    <ListTodo className="h-4 w-4 mr-2" />
                    Nova Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAdicionarDialogOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Adicionar Demanda
                  </DropdownMenuItem>
                  {FEATURES.rotas && (
                    <DropdownMenuItem onClick={() => setIsAdicionarRotasDialogOpen(true)}>
                      <Route className="h-4 w-4 mr-2" />
                      Adicionar Rota
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <AdicionarTarefaDialog kanbanType={selectedUser} open={isAdicionarTarefaOpen} onOpenChange={setIsAdicionarTarefaOpen} />
              <AdicionarDemandasKanbanDialog open={isAdicionarDialogOpen} onOpenChange={setIsAdicionarDialogOpen} selectedUser={selectedUser} />
              <AdicionarRotasKanbanDialog open={isAdicionarRotasDialogOpen} onOpenChange={setIsAdicionarRotasDialogOpen} selectedUser={selectedUser} />
            </div>
            </>
          )}
        </div>

        {/* ══════════════ Conteúdo condicional ══════════════ */}
        {viewMode === 'historico' ? (
          <HistoricoView 
            selectedUser={selectedUser} 
            responsaveis={responsaveis} 
          />
        ) : (
          /* ══════════════ Board ══════════════ */
          <>
          {/* Filtros do quadro */}
          <div className="flex flex-wrap items-center gap-2 mb-3 md:mb-4">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Input
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar no quadro (título, protocolo, munícipe)…"
                className="h-9"
                aria-label="Buscar no quadro"
              />
            </div>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por pessoa"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as pessoas</SelectItem>
                {responsaveis.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Tipo de cartão">
              {([['todos', 'Todos'], ['demanda', 'Demandas'], ['tarefa', 'Tarefas']] as const).map(([v, r]) => (
                <button
                  key={v} type="button" role="radio" aria-checked={filtroTipo === v}
                  onClick={() => setFiltroTipo(v)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filtroTipo === v ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >{r}</button>
              ))}
            </div>
            <Button
              variant={soAtrasados ? "default" : "outline"} size="sm" className="h-9 gap-1.5"
              onClick={() => setSoAtrasados(!soAtrasados)} aria-pressed={soAtrasados}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Só atrasados
            </Button>
            {filtrosAtivos && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFiltroTexto(""); setFiltroResponsavel("todos"); setFiltroTipo("todos"); setSoAtrasados(false); }}>
                Limpar filtros
              </Button>
            )}
            {filtrosAtivos && (
              <span className="text-xs text-muted-foreground">{itensFiltrados.length} de {demandas.length} cartões</span>
            )}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Mobile: tab bar para alternar colunas */}
            <div className="md:hidden flex rounded-xl bg-muted/50 p-1 mb-3 gap-1">
              {statusColumns.map((col) => {
                const count = totalDaColuna(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveColumn(col.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      activeColumn === col.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="truncate">{col.title}</span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">{count}</Badge>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {statusColumns.map((column) => {
                const columnItems = getDemandsByStatus(column.id);
                
                return (
                  <div key={column.id} className={`space-y-4 ${activeColumn !== column.id ? 'hidden md:block' : ''}`}>
                    <div className="hidden md:flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                        {column.title}
                        <Badge variant="secondary" className="ml-2">{totalDaColuna(column.id)}</Badge>
                      </h2>
                    </div>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[300px] space-y-3 p-3 rounded-lg border-2 border-dashed transition-colors ${
                            snapshot.isDraggingOver ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20'
                          }`}
                        >
                          {columnItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-pointer transition-all duration-200 hover:shadow-md relative group border-l-4 ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2 z-50' : ''
                                  }`}
                                  style={{
                                    borderLeftColor: getCardBorderColor(item),
                                    ...provided.draggableProps.style
                                  }}
                                  onClick={() => {
                                    if (!snapshot.isDragging && !isDraggingRef.current) {
                                      if (item.tipo === 'tarefa') {
                                        setSelectedTarefa(item);
                                        setIsViewTarefaDialogOpen(true);
                                      } else if (item.tipo === 'rota') {
                                        setSelectedRota(item);
                                        setIsViewRotaDialogOpen(true);
                                      } else {
                                        setSelectedDemanda(item);
                                        setIsViewDialogOpen(true);
                                      }
                                    }
                                  }}
                                >
                                  {/* Ações do cartão: mover (funciona no celular), tirar do quadro, excluir */}
                                  <div
                                    className="absolute top-1 right-1 z-10 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Ações do cartão">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Mover para</DropdownMenuLabel>
                                        {statusColumns.filter(c => c.id !== item.kanban_position).map(c => (
                                          <DropdownMenuItem key={c.id} onClick={() => moverItem(item, c.id)}>
                                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                                            {c.title}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        {item.tipo === 'tarefa' ? (
                                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setTarefaParaExcluir(item)}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Excluir tarefa…
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => item.tipo === 'rota' ? removerRotaMutation.mutate(item.id) : removerDemandaMutation.mutate(item.id)}>
                                            <X className="h-4 w-4 mr-2" /> Tirar do quadro
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  
                                  <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1 flex-1">
                                        <CardTitle className="text-sm font-medium leading-tight">
                                          {item.titulo}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                          {item.protocolo}
                                        </p>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  
                                  <CardContent className="pt-0 space-y-2">
                                    {/* ── Badge de tipo ── */}
                                    {item.tipo === 'tarefa' && (
                                      <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-[10px]">
                                        <ListTodo className="h-3 w-3 mr-1" />
                                        Tarefa
                                      </Badge>
                                    )}
                                    {item.tipo === 'demanda' && (
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px]">
                                        <FileText className="h-3 w-3 mr-1" />
                                        Demanda
                                      </Badge>
                                    )}

                                    {/* Descrição (demandas e tarefas) */}
                                    {item.tipo !== 'rota' && item.descricao && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {item.descricao}
                                      </p>
                                    )}

                                    {/* ── Card de ROTA ── */}
                                    {item.tipo === 'rota' && (
                                      <>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]">
                                            <Route className="h-3 w-3 mr-1" />
                                            Rota
                                          </Badge>
                                          <Badge variant="outline" className="text-[10px]">
                                            {getRotaStatusLabel(item.rota_status || '')}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            <span>{(item as any).pontos_count || 0} pontos</span>
                                            {(item as any).pontos_visitados > 0 && (
                                              <span className="text-emerald-600">
                                                ({(item as any).pontos_visitados} visitados)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {item.data_programada && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {formatDateOnly(item.data_programada)}
                                          </div>
                                        )}
                                        {item.usuario_nome && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <User className="h-3 w-3" />
                                            {item.usuario_nome}
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* ── Card de TAREFA: checklist ── */}
                                    {item.tipo === 'tarefa' && (item as any).checklist_total > 0 && (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <div className="flex items-center gap-1">
                                            <CheckSquare className="h-3 w-3" />
                                            <span>{(item as any).checklist_done}/{(item as any).checklist_total}</span>
                                          </div>
                                          <span>{Math.round(((item as any).checklist_done / (item as any).checklist_total) * 100)}%</span>
                                        </div>
                                        <Progress 
                                          value={Math.round(((item as any).checklist_done / (item as any).checklist_total) * 100)} 
                                          className="h-1.5" 
                                        />
                                      </div>
                                    )}

                                    {/* ── Prioridade + Prazo ── */}
                                    {item.tipo !== 'rota' && (
                                      <div className="flex items-center justify-between">
                                        <Badge 
                                          variant="outline" 
                                          style={{ 
                                            borderColor: getPrioridadeColor(item.prioridade),
                                            color: getPrioridadeColor(item.prioridade)
                                          }}
                                          className="text-xs"
                                        >
                                          {getPrioridadeLabel(item.prioridade)}
                                        </Badge>
                                        
                                        {item.data_prazo && (
                                          <div className={`flex items-center gap-1 text-xs ${
                                            isOverdue(item.data_prazo) && item.kanban_position !== 'feito' ? 'text-destructive' : 'text-muted-foreground'
                                          }`}>
                                            <Calendar className="h-3 w-3" />
                                            {formatDateOnly(item.data_prazo)}
                                            {isOverdue(item.data_prazo) && item.kanban_position !== 'feito' && <AlertTriangle className="h-3 w-3 ml-1" />}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* ── Área e munícipe (demandas) ── */}
                                    {item.tipo === 'demanda' && (
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        {item.areas?.nome && (
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {item.areas.nome}
                                          </div>
                                        )}
                                        {item.municipes?.nome && (
                                          <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {item.municipes.nome}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* ── Responsável ── */}
                                    {item.tipo !== 'rota' && getResponsavelNome(item.responsavel_id || item.tarefa_responsavel_id) && (
                                      <div className="text-xs text-muted-foreground">
                                        <strong>Responsável:</strong> {getResponsavelNome(item.responsavel_id || item.tarefa_responsavel_id)}
                                      </div>
                                    )}
                                    
                                    {/* ── Colaboradores (tarefas) ── */}
                                    {item.tipo === 'tarefa' && (item as any).colaboradores?.length > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        <strong>Colaboradores:</strong> {(item as any).colaboradores.map((c: any) => c.nome).join(', ')}
                                      </div>
                                    )}

                                    {/* ── Comentários (tarefas) ── */}
                                    {item.tipo === 'tarefa' && (item as any).comentarios_count > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3 w-3" />
                                        <span>{(item as any).comentarios_count} comentário{(item as any).comentarios_count !== 1 ? 's' : ''}</span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {column.id === 'feito' && feitoAntigos > 0 && (
                            <button
                              type="button"
                              onClick={() => setVerFeitoAntigo(!verFeitoAntigo)}
                              className="w-full rounded-md border border-dashed py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                              {verFeitoAntigo
                                ? `Recolher os ${feitoAntigos} concluídos há mais de ${DIAS_FEITO_VISIVEL} dias`
                                : `Mostrar ${feitoAntigos} concluídos há mais de ${DIAS_FEITO_VISIVEL} dias`}
                            </button>
                          )}

                          {columnItems.length === 0 && !(column.id === 'feito' && feitoAntigos > 0) && (
                            <div className="text-center text-muted-foreground py-8">
                              {filtrosAtivos ? 'Nenhum cartão com esses filtros' : 'Nenhum item nesta coluna'}
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
          </>
        )}

        {/* ══════════════ Dialogs ══════════════ */}
        <ViewDemandaDialog
          demanda={selectedDemanda}
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          onEdit={() => handleEditDemanda(selectedDemanda!)}
        />

        <EditDemandaDialog
          demanda={selectedDemanda}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />

        <ViewTarefaDialog
          tarefa={selectedTarefa}
          open={isViewTarefaDialogOpen}
          onOpenChange={handleCloseViewTarefaDialog}
          onEdit={() => handleEditTarefa(selectedTarefa!)}
        />

        <EditTarefaDialog
          tarefa={selectedTarefa}
          open={isEditTarefaDialogOpen}
          onOpenChange={setIsEditTarefaDialogOpen}
        />

        <ViewRotaKanbanDialog
          rota={selectedRota}
          open={isViewRotaDialogOpen}
          onOpenChange={setIsViewRotaDialogOpen}
        />

        <ConfirmarStatusDemandaDialog
          movimento={movimentoDemanda}
          onClose={() => setMovimentoDemanda(null)}
        />

        <AlertDialog open={!!tarefaParaExcluir} onOpenChange={(open) => !open && setTarefaParaExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir a tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                "{tarefaParaExcluir?.titulo}" será excluída de vez, junto com
                {tarefaParaExcluir?.checklist_total ? ` ${tarefaParaExcluir.checklist_total} itens de checklist,` : " o checklist,"}
                {tarefaParaExcluir?.comentarios_count ? ` ${tarefaParaExcluir.comentarios_count} comentário(s)` : " os comentários"} e os colaboradores.
                Para só tirar do caminho, mova para "Feito".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { removerTarefaMutation.mutate(tarefaParaExcluir.id); setTarefaParaExcluir(null); }}
              >
                Excluir tarefa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </>
        )}
      </div>
    </div>
  );
}
