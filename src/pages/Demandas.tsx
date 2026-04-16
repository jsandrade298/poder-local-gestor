import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2, Download, Upload, FileText, Activity, Settings, BarChart3, ChevronDown, ChevronUp, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { HumorBadge } from "@/components/forms/HumorSelector";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { ConfigurarStatusDialog } from "@/components/forms/ConfigurarStatusDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { ImportCSVDialogDemandas } from "@/components/forms/ImportCSVDialogDemandas";
import { ValidarMunicipesDialog } from "@/components/forms/ValidarMunicipesDialog";
import { geocodificarEndereco } from "@/hooks/useBrasilAPI";
import { toast } from "sonner";
import { formatInTimeZone } from 'date-fns-tz';
import { formatDateOnly, formatDateTime } from '@/lib/dateUtils';
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";

export default function Demandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [municipeFilter, setMunicipeFilter] = useState<string[]>([]);
  const [responsavelFilter, setResponsavelFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [bairroFilter, setBairroFilter] = useState<string[]>([]);
  const [atrasoFilter, setAtrasoFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState<{
    fase: 'importando' | 'geocodificando';
    atual: number;
    total: number;
  } | undefined>(undefined);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para paginação
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Estado para ordenação
  const [orderBy, setOrderBy] = useState<
    'mais_recente' | 'mais_antigo' | 'titulo_asc' | 'titulo_desc' | 'prazo_proximo' | 'prioridade'
  >('mais_recente');

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isConfigStatusOpen, setIsConfigStatusOpen] = useState(false);
  
  // Hook de status dinâmicos
  const { statusList, getStatusLabel, getStatusColor } = useDemandaStatus();

  // Debounce do termo de busca — 600ms para não disparar query a cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const statusKey = statusFilter.join(",");
  const areaKey = areaFilter.join(",");
  const municipeKey = municipeFilter.join(",");
  const responsavelKey = responsavelFilter.join(",");
  const cidadeKey = cidadeFilter.join(",");
  const bairroKey = bairroFilter.join(",");

  // Buscar demandas com paginação eficiente
  const { data: demandasData = { demandas: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['demandas', pageSize, currentPage, statusKey, areaKey, municipeKey, responsavelKey, cidadeKey, bairroKey, atrasoFilter, dateFrom, dateTo, debouncedSearchTerm, orderBy],
    queryFn: async () => {
      // Se há termo de busca, resolver IDs de munícipes que correspondem ao nome (em lotes)
      let municipeIdsFromSearch: string[] = [];
      if (debouncedSearchTerm) {
        const term = `%${debouncedSearchTerm}%`;
        const BATCH = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: matchingMunicipes } = await supabase
            .from('municipes')
            .select('id')
            .ilike('nome', term)
            .range(from, from + BATCH - 1);
          if (matchingMunicipes && matchingMunicipes.length > 0) {
            municipeIdsFromSearch.push(...matchingMunicipes.map((m: any) => m.id));
            from += BATCH;
            hasMore = matchingMunicipes.length === BATCH;
          } else {
            hasMore = false;
          }
        }
      }

      // Construir query com filtros server-side
      const buildQuery = () => {
        let query = supabase
          .from('demandas')
          .select(`
            *,
            areas(nome),
            municipes(nome)
          `, { count: 'exact' });

        // Ordenação dinâmica
        switch (orderBy) {
          case 'mais_antigo':
            query = query.order('created_at', { ascending: true });
            break;
          case 'titulo_asc':
            query = query.order('titulo', { ascending: true });
            break;
          case 'titulo_desc':
            query = query.order('titulo', { ascending: false });
            break;
          case 'prazo_proximo':
            // Prazo mais próximo primeiro (nulls por último)
            query = query.order('data_prazo', { ascending: true, nullsFirst: false });
            break;
          case 'prioridade':
            // Prioridade é text, então ordenamos por urgente > alta > media > baixa via created_at como fallback
            // Supabase PostgREST não suporta CASE diretamente, então usamos created_at como secundário
            query = query.order('prioridade', { ascending: false }).order('created_at', { ascending: false });
            break;
          case 'mais_recente':
          default:
            query = query.order('created_at', { ascending: false });
            break;
        }

        // Filtros: delegar ao PostgreSQL
        if (statusFilter.length > 0) query = query.in('status', statusFilter);
        if (areaFilter.length > 0) query = query.in('area_id', areaFilter);
        if (municipeFilter.length > 0) query = query.in('municipe_id', municipeFilter);
        if (responsavelFilter.length > 0) query = query.in('responsavel_id', responsavelFilter);
        if (cidadeFilter.length > 0) query = query.in('cidade', cidadeFilter);
        if (bairroFilter.length > 0) query = query.in('bairro', bairroFilter);

        // Filtro de atraso
        if (atrasoFilter !== "all") {
          const todayStr = new Date().toISOString().split('T')[0];
          const closedSlugs = ['atendido', 'devolvido', 'concluido', 'arquivado'];
          query = query
            .not('status', 'in', `(${closedSlugs.join(',')})`)
            .not('data_prazo', 'is', null);
          
          if (atrasoFilter === "overdue") {
            query = query.lt('data_prazo', todayStr);
          } else if (["30", "60", "90"].includes(atrasoFilter)) {
            const minDays = parseInt(atrasoFilter);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - minDays);
            query = query.lt('data_prazo', cutoffDate.toISOString().split('T')[0]);
          }
        }

        // Filtro de período (data de criação)
        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

        // Busca por texto — OR entre título, protocolo e IDs de munícipes que batem no nome
        if (debouncedSearchTerm) {
          const term = `%${debouncedSearchTerm}%`;
          if (municipeIdsFromSearch.length > 0) {
            // Há munícipes com esse nome: OR entre título, protocolo e municipe_id
            const municipeOrClauses = municipeIdsFromSearch
              .map(id => `municipe_id.eq.${id}`)
              .join(',');
            query = query.or(`titulo.ilike.${term},protocolo.ilike.${term},${municipeOrClauses}`);
          } else {
            query = query.or(`titulo.ilike.${term},protocolo.ilike.${term}`);
          }
        }

        return query;
      };

      if (pageSize === "all") {
        // Buscar todas com filtros server-side (em lotes eficientes)
        const BATCH_SIZE = 1000;
        let allDemandas: any[] = [];
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const { data, error } = await buildQuery()
            .range(offset, offset + BATCH_SIZE - 1);
          
          if (error) {
            console.error('❌ Demandas: Erro ao buscar lote:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allDemandas.push(...data);
            offset += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }
        
        return { demandas: allDemandas, total: allDemandas.length };
      }

      // Busca paginada normal com filtros
      const itemsPerPage = pageSize as number;
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error, count } = await buildQuery()
        .range(from, to);
      
      if (error) {
        console.error('❌ Demandas: Erro ao buscar página:', error);
        throw error;
      }
      
      return { demandas: data || [], total: count || 0 };
    }
  });
  
  const demandas = demandasData.demandas;
  const totalDemandas = demandasData.total;
  
  useEffect(() => {
    const atrasoParam = searchParams.get('atraso');
    const areaParam = searchParams.get('area');
    const protocolo = searchParams.get('protocolo');
    const demandaId = searchParams.get('id');
    const atividadeId = searchParams.get('atividade');
    const responsavelParam = searchParams.get('responsavel');

    const hasAnyParam = atrasoParam || areaParam || protocolo || demandaId || responsavelParam;
    if (!hasAnyParam) return;

    // Aplicar filtros vindos de outras páginas
    if (atrasoParam) setAtrasoFilter(atrasoParam);
    if (areaParam) setAreaFilter([areaParam]);
    if (responsavelParam) setResponsavelFilter([responsavelParam]);

    // Processar redirecionamento de notificação ou de outros locais
    if ((protocolo || demandaId) && demandas.length > 0) {
      const demanda = demandas?.find(d =>
        protocolo ? d.protocolo === protocolo : d.id === demandaId
      );
      if (demanda) {
        setSelectedDemanda(demanda);
        setIsViewDialogOpen(true);
        if (atividadeId) {
          setHighlightedActivityId(atividadeId);
        }
      } else if (protocolo || demandaId) {
        // Demanda não encontrada na lista local — buscar diretamente no banco
        (async () => {
          const { data, error } = await supabase
            .from('demandas')
            .select('*, areas(nome), municipes(nome)')
            .eq(protocolo ? 'protocolo' : 'id', protocolo || demandaId)
            .single();
          if (data && !error) {
            setSelectedDemanda(data);
            setIsViewDialogOpen(true);
            if (atividadeId) setHighlightedActivityId(atividadeId);
          }
        })();
      }
    }

    // Limpar apenas filtros da URL (area, atraso, responsavel)
    // NÃO limpa protocolo/id — o link fica compartilhável e é limpo ao fechar o modal
    const needsDemandas = protocolo || demandaId;
    if (!needsDemandas) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, demandas, setSearchParams]);


  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Criar mapa de responsáveis para busca rápida pelo ID
  const responsaveisMap = useMemo(() => {
    const map = new Map<string, string>();
    responsaveis.forEach((r: any) => {
      map.set(r.id, r.nome);
    });
    return map;
  }, [responsaveis]);

  // Função para obter nome do responsável
  const getResponsavelNome = (responsavelId: string | null) => {
    if (!responsavelId) return 'Sem responsável';
    return responsaveisMap.get(responsavelId) || 'Sem responsável';
  };

  // Buscar valores únicos para cidade (via RPC para ultrapassar limite de 1000)
  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades-demandas'],
    queryFn: async () => {
      // Tentar RPC primeiro
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_distinct_cidades_demandas');
      
      if (!rpcError && rpcData) {
        return (rpcData as any[]).map((item: any) => item.cidade).filter(Boolean);
      }

      // Fallback: buscar em lotes
      console.warn('⚠️ RPC get_distinct_cidades_demandas não disponível, usando fallback');
      const BATCH = 1000;
      const allCidades = new Set<string>();
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('demandas')
          .select('cidade')
          .not('cidade', 'is', null)
          .order('cidade')
          .range(from, from + BATCH - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          data.forEach(item => { if (item.cidade) allCidades.add(item.cidade); });
          from += BATCH;
          hasMore = data.length === BATCH;
        } else {
          hasMore = false;
        }
      }
      return Array.from(allCidades).sort();
    }
  });

  // Query de munícipes para o filtro (via RPC para ultrapassar limite de 1000)
  const { data: municipesList = [] } = useQuery({
    queryKey: ['municipes-filtro-demandas'],
    queryFn: async () => {
      // Tentar RPC primeiro
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_municipes_para_filtro');
      
      if (!rpcError && rpcData) {
        return rpcData as any[];
      }

      // Fallback: buscar em lotes
      console.warn('⚠️ RPC get_municipes_para_filtro não disponível, usando fallback');
      const BATCH = 1000;
      let all: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('municipes')
          .select('id, nome')
          .order('nome')
          .range(from, from + BATCH - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          all.push(...data);
          from += BATCH;
          hasMore = data.length === BATCH;
        } else {
          hasMore = false;
        }
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar bairros únicos das demandas (via RPC para ultrapassar limite de 1000)
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-demandas'],
    queryFn: async () => {
      // Tentar RPC primeiro
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_distinct_bairros_demandas');
      
      if (!rpcError && rpcData) {
        return (rpcData as any[]).map((item: any) => item.bairro).filter(Boolean);
      }

      // Fallback: buscar em lotes
      console.warn('⚠️ RPC get_distinct_bairros_demandas não disponível, usando fallback');
      const BATCH = 1000;
      const allBairros = new Set<string>();
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('demandas')
          .select('bairro')
          .not('bairro', 'is', null)
          .order('bairro')
          .range(from, from + BATCH - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          data.forEach(item => { if (item.bairro) allBairros.add(item.bairro); });
          from += BATCH;
          hasMore = data.length === BATCH;
        } else {
          hasMore = false;
        }
      }
      return Array.from(allBairros).sort();
    }
  });

  const getStatusVariant = (status: string) => {
    return 'outline'; // Sempre outline, a cor vem do hook
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))'; // Verde
      case 'media': return 'hsl(var(--chart-2))'; // Laranja
      case 'alta': return 'hsl(var(--chart-1))'; // Azul
      case 'urgente': return 'hsl(var(--chart-5))'; // Vermelho
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

  // Busca já é totalmente server-side (título + protocolo + municipe_id)
  // filteredDemandas é igual a demandas — mantido por compatibilidade com o restante do código
  const filteredDemandas = demandas;

  // Paginação
  const paginatedDemandas = filteredDemandas;
  const totalPages = pageSize === "all" ? 1 : Math.ceil(totalDemandas / (pageSize as number));

  // Resetar página quando mudar filtros ou pageSize
  useEffect(() => {
    setCurrentPage(1);
  }, [statusKey, areaKey, municipeKey, responsavelKey, cidadeKey, bairroKey, atrasoFilter, dateFrom, dateTo, pageSize, orderBy]);


  // Mutação para excluir demanda
  const deleteMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      // Primeiro, deletar os anexos relacionados
      const { data: anexos } = await supabase
        .from('anexos')
        .select('url_arquivo')
        .eq('demanda_id', demandaId);

      if (anexos && anexos.length > 0) {
        // Deletar arquivos do storage
        const filePaths = anexos.map(anexo => anexo.url_arquivo);
        await supabase.storage
          .from('demanda-anexos')
          .remove(filePaths);

        // Deletar registros da tabela anexos
        await supabase
          .from('anexos')
          .delete()
          .eq('demanda_id', demandaId);
      }

      // Depois deletar a demanda
      const { error } = await supabase
        .from('demandas')
        .delete()
        .eq('id', demandaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      toast.success("Demanda excluída com sucesso!");
    },
    onError: (error) => {
      console.error('Erro ao excluir demanda:', error);
      toast.error("Erro ao excluir demanda: " + error.message);
    }
  });

  const handleViewDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(true);
    // Atualizar URL com protocolo para link compartilhável
    if (demanda.protocolo) {
      setSearchParams({ protocolo: demanda.protocolo }, { replace: true });
    }
  };

  const handleEditDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleEditFromView = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleDeleteDemanda = (demandaId: string) => {
    deleteMutation.mutate(demandaId);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setStatusFilter([]);
    setAreaFilter([]);
    setMunicipeFilter([]);
    setResponsavelFilter([]);
    setCidadeFilter([]);
    setBairroFilter([]);
    setAtrasoFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Contagem de filtros ativos (para badge mobile)
  const activeFilterCount = [
    statusFilter.length > 0,
    areaFilter.length > 0,
    municipeFilter.length > 0,
    responsavelFilter.length > 0,
    cidadeFilter.length > 0,
    bairroFilter.length > 0,
    atrasoFilter !== "all",
    dateFrom !== "",
    dateTo !== "",
  ].filter(Boolean).length;

  // Função para exportar CSV
  const exportToCSV = () => {
    const headers = [
      'protocolo',
      'titulo',
      'descricao',
      'municipe_nome',
      'area_nome',
      'responsavel_nome',
      'status',
      'prioridade',
      'logradouro',
      'numero',
      'bairro',
      'cidade',
      'cep',
      'complemento',
      'data_prazo',
      'observacoes',
      'created_at'
    ];

    const csvData = paginatedDemandas.map(demanda => [
      demanda.protocolo || '',
      demanda.titulo || '',
      demanda.descricao || '',
      demanda.municipes?.nome || '',
      demanda.areas?.nome || '',
      '', // responsavel_nome - buscar depois se necessário
      demanda.status || '',
      demanda.prioridade || '',
      demanda.logradouro || '',
      demanda.numero || '',
      demanda.bairro || '',
      demanda.cidade || '',
      demanda.cep || '',
      demanda.complemento || '',
      demanda.data_prazo ? formatDateOnly(demanda.data_prazo) : '',
      demanda.observacoes || '',
      formatDateTime(demanda.created_at)
    ]);

    // Usar ponto e vírgula como separador para melhor compatibilidade
    const csvContent = [
      headers.join(';'),
      ...csvData.map(row => 
        row.map(field => {
          const escaped = field.toString().replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(';')
      )
    ].join('\r\n');

    // Adicionar BOM para UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `demandas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`CSV exportado com sucesso! ${paginatedDemandas.length} demandas exportadas.`);
  };

  // Função para processar demandas em lotes com geocodificação
  const importDemandas = useMutation({
    mutationFn: async (demandas: any[]) => {
      console.log(`📥 Iniciando importação de ${demandas.length} demandas`);
      
      const results: Array<{
        success: boolean;
        titulo: string;
        error?: string;
        id?: string;
        geocodificado?: boolean;
        action?: 'criado' | 'atualizado';
      }> = [];
      
      // FASE 1: Importar demandas
      setImportProgress({ fase: 'importando', atual: 0, total: demandas.length });
      
      const BATCH_SIZE = 50;
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      for (let i = 0; i < demandas.length; i += BATCH_SIZE) {
        const batch = demandas.slice(i, i + BATCH_SIZE);
        console.log(`🔄 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(demandas.length / BATCH_SIZE)} (${batch.length} demandas)`);
        
        for (let j = 0; j < batch.length; j++) {
          const demanda = batch[j];
          const currentIndex = i + j;
          setImportProgress({ fase: 'importando', atual: currentIndex + 1, total: demandas.length });
          
          try {
            const prioridadeMap: Record<string, string> = {
              'alta': 'alta',
              'média': 'media',
              'media': 'media',
              'baixa': 'baixa',
              'urgente': 'urgente'
            };
            
            const prioridadeNormalizada = demanda.prioridade 
              ? prioridadeMap[demanda.prioridade.toLowerCase()] || 'media'
              : 'media';
              
            // Status já vem resolvido do parsing (dinâmico)
            const statusFinal = demanda.status || 'solicitada';

            // ====== VERIFICAR SE É UPDATE OU INSERT ======
            if (demanda.existingId) {
              // ATUALIZAR demanda existente
              console.log(`🔄 Atualizando demanda existente: ${demanda.protocolo} (${demanda.existingId})`);
              
              const updateData: any = {
                titulo: demanda.titulo,
                descricao: demanda.descricao,
                municipe_id: demanda.municipeId,
                status: statusFinal,
                prioridade: prioridadeNormalizada,
                updated_at: new Date().toISOString()
              };

              // Só atualizar campos opcionais se tiverem valor
              if (demanda.areaId) updateData.area_id = demanda.areaId;
              if (demanda.responsavelId) updateData.responsavel_id = demanda.responsavelId;
              if (demanda.logradouro) updateData.logradouro = demanda.logradouro;
              if (demanda.numero) updateData.numero = demanda.numero;
              if (demanda.bairro) updateData.bairro = demanda.bairro;
              if (demanda.cidade) updateData.cidade = demanda.cidade;
              if (demanda.cep) updateData.cep = demanda.cep;
              if (demanda.complemento) updateData.complemento = demanda.complemento;
              if (demanda.data_prazo) updateData.data_prazo = demanda.data_prazo;
              if (demanda.observacoes) updateData.observacoes = demanda.observacoes;

              const { error } = await supabase
                .from('demandas')
                .update(updateData)
                .eq('id', demanda.existingId);

              if (error) {
                results.push({ success: false, titulo: demanda.titulo, error: error.message });
              } else {
                results.push({ 
                  success: true, 
                  titulo: demanda.titulo, 
                  id: demanda.existingId,
                  geocodificado: false,
                  action: 'atualizado',
                  ...demanda
                });
              }
            } else {
              // CRIAR nova demanda
              const { data, error } = await supabase
                .from('demandas')
                .insert({
                  titulo: demanda.titulo,
                  descricao: demanda.descricao,
                  municipe_id: demanda.municipeId,
                  area_id: demanda.areaId || null,
                  responsavel_id: demanda.responsavelId || null,
                  status: statusFinal,
                  prioridade: prioridadeNormalizada,
                  logradouro: demanda.logradouro || null,
                  numero: demanda.numero || null,
                  bairro: demanda.bairro || null,
                  cidade: demanda.cidade || null,
                  cep: demanda.cep || null,
                  complemento: demanda.complemento || null,
                  data_prazo: demanda.data_prazo || null,
                  observacoes: demanda.observacoes || null,
                  criado_por: userId,
                  geocodificado: false
                })
                .select('id')
                .single();

              if (error) {
                results.push({ success: false, titulo: demanda.titulo, error: error.message });
              } else {
                results.push({ 
                  success: true, 
                  titulo: demanda.titulo, 
                  id: data.id,
                  geocodificado: false,
                  action: 'criado',
                  ...demanda
                });
              }
            }
          } catch (err) {
            results.push({ success: false, titulo: demanda.titulo, error: 'Erro inesperado' });
          }
        }
        
        if (i + BATCH_SIZE < demandas.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // FASE 2: Geocodificar demandas importadas com sucesso
      const demandasParaGeocoding = results.filter(r => r.success && r.id);
      const demandasComEndereco = demandasParaGeocoding.filter((r: any) => 
        r.logradouro || r.bairro || r.cidade
      );
      
      if (demandasComEndereco.length > 0) {
        console.log(`🗺️ Iniciando geocodificação de ${demandasComEndereco.length} demandas...`);
        setImportProgress({ fase: 'geocodificando', atual: 0, total: demandasComEndereco.length });
        
        for (let i = 0; i < demandasComEndereco.length; i++) {
          const demanda: any = demandasComEndereco[i];
          setImportProgress({ fase: 'geocodificando', atual: i + 1, total: demandasComEndereco.length });
          
          try {
            // A geocodificação funciona melhor com endereço completo
            // O Mapbox/Nominatim conseguem determinar o estado automaticamente
            const coordenadas = await geocodificarEndereco(
              demanda.logradouro || '',
              demanda.numero || '',
              demanda.bairro || '',
              demanda.cidade || '',
              '' // Estado será inferido pela API de geocodificação
            );
            
            if (coordenadas) {
              // Atualizar a demanda com as coordenadas
              const { error: updateError } = await supabase
                .from('demandas')
                .update({
                  latitude: coordenadas.latitude,
                  longitude: coordenadas.longitude,
                  geocodificado: true
                })
                .eq('id', demanda.id);
              
              if (!updateError) {
                // Atualizar resultado
                const resultIndex = results.findIndex(r => r.id === demanda.id);
                if (resultIndex !== -1) {
                  results[resultIndex].geocodificado = true;
                }
                console.log(`✅ Geocodificada: ${demanda.titulo} (${coordenadas.fonte})`);
              }
            } else {
              console.log(`⚠️ Não foi possível geocodificar: ${demanda.titulo}`);
            }
            
            // Pequena pausa entre geocodificações para não sobrecarregar APIs
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (err) {
            console.error(`❌ Erro ao geocodificar ${demanda.titulo}:`, err);
          }
        }
      }
      
      setImportProgress(undefined);
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      const geocodificadosCount = results.filter(r => r.success && r.geocodificado).length;
      
      setImportResults(results);
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      
      console.log(`✅ Importação concluída: ${successCount} sucessos, ${errorCount} erros, ${geocodificadosCount} geocodificadas`);
      
      if (geocodificadosCount > 0) {
        toast.success(`${successCount} demandas importadas, ${geocodificadosCount} geocodificadas!`);
      }
    },
    onError: (error) => {
      setImportProgress(undefined);
      setImportResults([{ success: false, titulo: 'Erro', error: error.message }]);
      console.error('❌ Erro na importação:', error);
    }
  });

  // Função para processar arquivo CSV
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚀 Iniciando importação de CSV...');
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error("Por favor, selecione um arquivo CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        
        // Parser CSV mais robusto para lidar com aspas e quebras de linha
        function parseCSVLine(line: string, separator: string): string[] {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          let quoteChar = '';
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes && (char === '"' || char === "'")) {
              inQuotes = true;
              quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
              if (nextChar === quoteChar) {
                current += char;
                i++; // Skip next quote
              } else {
                inQuotes = false;
                quoteChar = '';
              }
            } else if (!inQuotes && char === separator) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        }

        // Primeiro passo: dividir linhas respeitando aspas
        const rawLines = [];
        let currentLine = '';
        let insideQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < csv.length; i++) {
          const char = csv[i];
          const nextChar = csv[i + 1];
          
          if ((char === '"' || char === "'") && !insideQuotes) {
            insideQuotes = true;
            quoteChar = char;
            currentLine += char;
          } else if (char === quoteChar && insideQuotes) {
            if (nextChar === quoteChar) {
              currentLine += char + nextChar;
              i++;
            } else {
              insideQuotes = false;
              quoteChar = '';
              currentLine += char;
            }
          } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (currentLine.trim()) {
              rawLines.push(currentLine.trim());
            }
            currentLine = '';
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
          } else {
            currentLine += char;
          }
        }
        
        if (currentLine.trim()) {
          rawLines.push(currentLine.trim());
        }

        // Filtrar linhas vazias ou inválidas
        const lines = rawLines.filter(line => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          
          // Verificar se tem pelo menos um separador válido
          const hasSeparator = trimmed.includes(';') || trimmed.includes(',');
          if (!hasSeparator) {
            console.warn(`⚠️ Linha descartada (sem separador): "${trimmed.substring(0, 50)}..."`);
            return false;
          }
          
          return true;
        });
        
        console.log(`📁 Total de linhas válidas encontradas: ${lines.length - 1} (excluindo header)`);
        
        if (lines.length < 2) {
          toast.error("O arquivo CSV está vazio ou não possui dados válidos.");
          return;
        }

        // Detectar separador mais preciso
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const separator = semicolonCount >= commaCount ? ';' : ',';
        
        // Usar parser robusto para o header
        const headers = parseCSVLine(firstLine, separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        
        console.log(`📋 Headers encontrados: ${headers.join(', ')}`);
        console.log(`📋 Separador detectado: "${separator}"`);
        console.log(`📋 Total de colunas no header: ${headers.length}`);
        
        // Verificar se temos a estrutura básica esperada
        if (headers.length < 3) {
          toast.error("CSV deve ter pelo menos 3 colunas (Título, Descrição, Munícipe)");
          return;
        }

        // Detectar formato pelo NOME dos headers:
        // - CSV exportado do sistema: tem coluna "protocolo" → ativa modo upsert
        // - CSV novo (planilha do cliente): sem "protocolo" → só cria novas demandas
        const hasProtocolo = headers.some(h => 
          ['protocolo', 'protocol', 'protocolo_demanda'].includes(h.replace(/[^a-z_]/g, ''))
        );
        
        // Construir posições baseadas nos headers reais
        const columnPositions: Record<string, number> = {};
        
        if (hasProtocolo) {
          // Formato exportado: protocolo, titulo, descricao, municipe_nome, ...
          console.log('📋 Formato exportado detectado (com protocolo) - modo ATUALIZAÇÃO ativado');
          const exportOrder = ['protocolo', 'titulo', 'descricao', 'municipe_nome', 'area_nome', 'responsavel_nome', 'status', 'prioridade', 'logradouro', 'numero', 'bairro', 'cidade', 'cep', 'complemento', 'data_prazo', 'observacoes', 'created_at'];
          exportOrder.forEach((key, idx) => {
            if (idx < headers.length) columnPositions[key] = idx;
          });
        } else {
          // Formato importação nova: titulo, descricao, municipe_nome, ...
          console.log('📋 Formato novo detectado (sem protocolo) - modo CRIAÇÃO');
          columnPositions.protocolo = -1; // Marca como inexistente
          const importOrder = ['titulo', 'descricao', 'municipe_nome', 'area_nome', 'responsavel_nome', 'status', 'prioridade', 'logradouro', 'numero', 'bairro', 'cidade', 'cep', 'complemento', 'data_prazo', 'observacoes'];
          importOrder.forEach((key, idx) => {
            if (idx < headers.length) columnPositions[key] = idx;
          });
        }
        
        const isOldFormat = !hasProtocolo;

        // Buscar dados existentes usando carregamento em lotes
        console.log('🔍 Carregando dados do sistema...');
        
        // Função para carregar todos os munícipes em lotes
        const carregarTodosMunicipes = async () => {
          let allMunicipes: Array<{ id: string; nome: string }> = [];
          let from = 0;
          const pageSize = 1000;
          let hasMore = true;
          
          while (hasMore) {
            console.log(`📦 Carregando lote ${Math.floor(from / pageSize) + 1} de munícipes (registros ${from + 1}-${from + pageSize})...`);
            
            const { data, error } = await supabase
              .from('municipes')
              .select('id, nome')
              .order('nome')
              .range(from, from + pageSize - 1);
              
            if (error) {
              console.error('❌ Erro ao buscar munícipes:', error);
              throw error;
            }
            
            if (data && data.length > 0) {
              allMunicipes = [...allMunicipes, ...data];
              console.log(`✅ Lote carregado: ${data.length} munícipes (total: ${allMunicipes.length})`);
              
              // Se retornou menos que o pageSize, chegamos ao fim
              hasMore = data.length === pageSize;
              from += pageSize;
            } else {
              hasMore = false;
            }
          }
          
          return allMunicipes;
        };

        const [allMunicipes, existingAreas, existingResponsaveis, existingStatusList, existingDemandasProtocolo] = await Promise.all([
          carregarTodosMunicipes(),
          supabase.from('areas').select('id, nome'),
          supabase.from('profiles').select('id, nome'),
          supabase.from('demanda_status').select('slug, nome').eq('ativo', true),
          supabase.from('demandas').select('id, protocolo')
        ]);

        console.log(`📊 Dados carregados: ${allMunicipes?.length || 0} munícipes (em lotes), ${existingAreas.data?.length || 0} áreas, ${existingResponsaveis.data?.length || 0} responsáveis, ${existingStatusList.data?.length || 0} status, ${existingDemandasProtocolo.data?.length || 0} demandas existentes`);

        // Map de protocolos existentes → demanda id
        const protocoloMap = new Map<string, string>();
        existingDemandasProtocolo.data?.forEach((d: any) => {
          if (d.protocolo) {
            protocoloMap.set(d.protocolo.toLowerCase().trim(), d.id);
          }
        });

        // Map de slugs de status válidos (para aceitar qualquer status dinâmico)
        const validStatusSlugs = new Set<string>();
        existingStatusList.data?.forEach((s: any) => {
          validStatusSlugs.add(s.slug);
          // Também mapear pelo nome (case-insensitive)
          validStatusSlugs.add(s.nome.toLowerCase().trim());
        });

        // Map nome → slug para resolução
        const statusNameToSlug = new Map<string, string>();
        existingStatusList.data?.forEach((s: any) => {
          statusNameToSlug.set(s.slug, s.slug);
          statusNameToSlug.set(s.nome.toLowerCase().trim(), s.slug);
        });

        // Criar maps normalizados
        const municipeMap = new Map();
        allMunicipes?.forEach(m => {
          // Normalizar removendo espaços extras e convertendo para minúsculas
          const normalized = m.nome.toLowerCase().trim().replace(/\s+/g, ' ');
          municipeMap.set(normalized, m.id);
          
          // Adicionar versão sem acentos também
          const semAcentos = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (semAcentos !== normalized) {
            municipeMap.set(semAcentos, m.id);
          }
        });

        const areaMap = new Map();
        existingAreas.data?.forEach(a => {
          const normalized = a.nome.toLowerCase().trim().replace(/\s+/g, ' ');
          areaMap.set(normalized, a.id);
        });

        const responsavelMap = new Map();
        existingResponsaveis.data?.forEach(r => {
          const normalized = r.nome.toLowerCase().trim().replace(/\s+/g, ' ');
          responsavelMap.set(normalized, r.id);
        });

        // Coletar munícipes únicos para criar e analisar
        const municipesNaoEncontrados = new Map();
        const demandasComDados = [];
        
        // Primeira passada: identificar dados e munícipes novos
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          
          const values = parseCSVLine(line, separator).map(v => 
            v.replace(/^["']|["']$/g, '').trim()
          );
          
          console.log(`🔍 Processando linha ${i + 1}:`, {
            totalColunas: values.length,
            protocolo: values[0] || '(vazio)',
            titulo: values[1] || '(vazio)',
            descricao: values[2] || '(vazio)',
            municipe: values[3] || '(vazio)',
            raw_line: line.substring(0, 100) + (line.length > 100 ? '...' : '')
          });
          
          // Verificar se há colunas suficientes
          const expectedCols = isOldFormat ? 15 : 16;
          if (values.length < expectedCols) {
            console.log(`⚠️ Linha ${i + 1} tem apenas ${values.length} colunas, esperado ${expectedCols}. Adicionando colunas vazias.`);
            while (values.length < expectedCols) {
              values.push('');
            }
          }
          
          // Auto-detecção de deslocamento de colunas quando título está vazio
          let adjustedPositions = { ...columnPositions };
          
          if (!values[columnPositions.titulo] || !values[columnPositions.titulo].trim()) {
            // Verificar se a descrição parece ser um nome (indicativo de deslocamento)
            const possibleName = values[columnPositions.descricao]?.trim();
            const possibleDesc = values[columnPositions.municipe_nome]?.trim();
            
            if (possibleName && possibleName.includes(' ') && possibleName.length < 100) {
              console.warn(`🔄 Linha ${i + 1}: Detectado deslocamento - ajustando posições das colunas`);
              console.log(`   Original: titulo="${values[0]}" | desc="${values[1]}" | municipe="${values[2]}"`);
              
              // Ajustar todas as posições uma coluna para frente (exceto posições negativas)
              Object.keys(adjustedPositions).forEach(key => {
                if (adjustedPositions[key] >= 0 && adjustedPositions[key] < values.length - 1) {
                  adjustedPositions[key] += 1;
                }
              });
              
              console.log(`   Ajustado: titulo="${values[adjustedPositions.titulo]}" | desc="${values[adjustedPositions.descricao]}" | municipe="${values[adjustedPositions.municipe_nome]}"`);
            } else {
              console.log(`⚠️ Linha ${i + 1} ignorada: sem título válido - valor: "${values[columnPositions.titulo] || ''}"`, {
                linha_completa: line,
                valores_separados: values
              });
              continue;
            }
          }
          
          const demanda: any = { linha: i + 1 };
          
          // Processar campos usando posições ajustadas
          Object.keys(adjustedPositions).forEach(key => {
            const columnIndex = adjustedPositions[key];
            // Pular colunas com posição inválida (ex: protocolo=-1 no formato antigo)
            if (columnIndex < 0 || columnIndex >= values.length) return;
            
            const value = values[columnIndex];
            
            // Debug específico para título e descrição
            if (key === 'titulo' || key === 'descricao') {
              console.log(`📝 Linha ${i + 1} - ${key} (col ${columnIndex}): "${value || '(vazio)'}"`);
            }
            
            if (value && value.trim()) {
              
              if (key === 'protocolo') {
                // Guardar protocolo para detecção de demanda existente
                const protocoloVal = value.trim();
                if (protocoloVal) {
                  demanda.protocolo = protocoloVal;
                  // Verificar se existe demanda com este protocolo
                  const existingId = protocoloMap.get(protocoloVal.toLowerCase().trim());
                  if (existingId) {
                    demanda.existingId = existingId;
                  }
                }
              } else if (key === 'municipe_nome') {
                demanda.municipe_nome_original = value;
                const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
                const semAcentos = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                
                // Tentar encontrar o munícipe
                const municipeId = municipeMap.get(normalized) || municipeMap.get(semAcentos);
                
                if (municipeId) {
                  demanda.municipeId = municipeId;
                } else if (value.trim()) {
                  // Marcar para validação
                  demanda.municipe_nao_encontrado = value;
                  if (!municipesNaoEncontrados.has(value)) {
                    municipesNaoEncontrados.set(value, {
                      nome: value,
                      demandasCount: 0,
                      demandas: []
                    });
                  }
                  const info = municipesNaoEncontrados.get(value);
                  info.demandasCount++;
                  info.demandas.push(demanda.titulo || `Linha ${i + 1}`);
                }
              } else if (key === 'area_nome') {
                const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
                demanda.areaId = areaMap.get(normalized);
              } else if (key === 'responsavel_nome') {
                const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
                demanda.responsavelId = responsavelMap.get(normalized);
              } else if (key === 'status') {
                // Tentar resolver status dinâmico pelo slug ou nome
                const statusLower = value.toLowerCase().trim();
                const resolvedSlug = statusNameToSlug.get(statusLower);
                if (resolvedSlug) {
                  demanda.status = resolvedSlug;
                } else {
                  // Fallback: aceitar valor literal se parece válido
                  const slug = statusLower.replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  demanda.status = slug || 'solicitada';
                  console.warn(`⚠️ Status "${value}" não encontrado no sistema, usando "${demanda.status}"`);
                }
              } else if (key === 'prioridade') {
                const prioridadeMap: Record<string, string> = {
                  'baixa': 'baixa',
                  'media': 'media',
                  'média': 'media',
                  'alta': 'alta',
                  'urgente': 'urgente'
                };
                demanda.prioridade = prioridadeMap[value.toLowerCase()] || 'media';
              } else if (key === 'data_prazo' && value) {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    demanda.data_prazo = date.toISOString().split('T')[0];
                  }
                } catch {
                  // Ignorar datas inválidas
                }
              } else {
                demanda[key] = value;
              }
            }
          });
          
          // Validação final antes de adicionar
          console.log(`✅ Linha ${i + 1} processada:`, {
            titulo: demanda.titulo,
            descricao: demanda.descricao,
            municipe: demanda.municipe_nome_original
          });
          
          // Adicionar descrição padrão se não existir
          if (!demanda.descricao && demanda.titulo) {
            demanda.descricao = demanda.titulo;
          }
          
          demandasComDados.push(demanda);
        }

        console.log(`📝 ${demandasComDados.length} demandas válidas identificadas`);
        console.log(`👥 ${municipesNaoEncontrados.size} munícipes únicos não encontrados`);

        // Se há munícipes não encontrados, mostrar modal de validação
        if (municipesNaoEncontrados.size > 0) {
          // Armazenar dados temporariamente para usar após validação
          setTempImportData({
            demandasComDados,
            municipeMap,
            municipesNaoEncontrados: Array.from(municipesNaoEncontrados.values()),
            municipesExistentes: allMunicipes || []
          });
          setShowValidacaoModal(true);
          return;
        }

        // Se não há munícipes não encontrados, prosseguir diretamente
        await finalizarImportacao(demandasComDados, municipeMap, []);
        
      } catch (error) {
        console.error('Erro ao processar CSV:', error);
        toast.error("Erro ao processar arquivo CSV. Verifique o formato.");
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Estados para modal de validação
  const [showValidacaoModal, setShowValidacaoModal] = useState(false);
  const [tempImportData, setTempImportData] = useState<any>(null);

  // Função para finalizar importação após validação
  const finalizarImportacao = async (demandasComDados: any[], municipeMap: Map<string, string>, decisoes: any[]) => {
    try {
      // Criar novos munícipes baseados nas decisões
      const novosMunicipes = decisoes.filter(d => d.tipo === 'novo');
      
      if (novosMunicipes.length > 0) {
        console.log('👥 Criando novos munícipes...');
        
        const municipesArray = novosMunicipes.map(d => {
          return {
            nome: d.novoNome.trim(),
            telefone: d.telefone || null,
            email: d.email || null,
            endereco: d.endereco || null,
            bairro: d.bairro || null,
            cidade: d.cidade || null,
            cep: d.cep || null,
            data_nascimento: d.data_nascimento || null,
            observacoes: d.observacoes || null
          };
        });
        
        // Criar em lotes de 50
        const BATCH_SIZE = 50;
        for (let i = 0; i < municipesArray.length; i += BATCH_SIZE) {
          const batch = municipesArray.slice(i, i + BATCH_SIZE);
          
          const { data: novosMunicipesCriados, error } = await supabase
            .from('municipes')
            .insert(batch)
            .select();
          
          if (novosMunicipesCriados) {
            novosMunicipesCriados.forEach((m, index) => {
              const decisaoIndex = i + index;
              const decisao = novosMunicipes[decisaoIndex];
              municipeMap.set(decisao.nomeOriginal, m.id);
            });
            console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${novosMunicipesCriados.length} munícipes criados`);
          } else if (error) {
            console.error('Erro ao criar munícipes:', error);
          }
        }
      }

      // Filtrar decisões de descarte
      const decisoesDescartadas = decisoes.filter(d => d.tipo === 'descartar');
      const decisoesValidas = decisoes.filter(d => d.tipo !== 'descartar');
      
      console.log(`📋 Processando ${decisoesValidas.length} decisões válidas`);
      console.log(`🗑️ Descartando ${decisoesDescartadas.length} munícipes com suas demandas`);

      // Aplicar decisões de munícipes existentes
      const municipesExistentes = decisoesValidas.filter(d => d.tipo === 'existente');
      municipesExistentes.forEach(decisao => {
        municipeMap.set(decisao.nomeOriginal, decisao.municipeId);
      });

      // Remover demandas de munícipes descartados
      const demandasNaoDescartadas = demandasComDados.filter(demanda => {
        if (demanda.municipe_nao_encontrado) {
          const foiDescartado = decisoesDescartadas.some(d => d.nomeOriginal === demanda.municipe_nao_encontrado);
          return !foiDescartado;
        }
        return true;
      });

      // Atualizar IDs dos munícipes nas demandas restantes
      demandasNaoDescartadas.forEach(demanda => {
        if (demanda.municipe_nao_encontrado) {
          const municipeId = municipeMap.get(demanda.municipe_nao_encontrado);
          if (municipeId) {
            demanda.municipeId = municipeId;
          }
        }
      });

      // Filtrar apenas demandas com dados mínimos
      const demandasValidas = demandasNaoDescartadas.filter(d => 
        d.titulo && d.municipeId
      );

      console.log(`✅ ${demandasValidas.length} demandas prontas para importação`);

      if (demandasValidas.length === 0) {
        toast.error("Nenhuma demanda válida encontrada. Verifique se há título e munícipe.");
        return;
      }

      // Preparar demandas para importação
      const demandasParaImportar = demandasValidas.map(d => ({
        protocolo: d.protocolo || null,
        existingId: d.existingId || null,
        titulo: d.titulo,
        descricao: d.descricao || d.titulo,
        municipeId: d.municipeId,
        areaId: d.areaId || null,
        responsavelId: d.responsavelId || null,
        status: d.status || 'solicitada',
        prioridade: d.prioridade || 'media',
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        bairro: d.bairro || null,
        cidade: d.cidade || null,
        cep: d.cep || null,
        complemento: d.complemento || null,
        data_prazo: d.data_prazo || null,
        observacoes: d.observacoes || null
      }));

      // Limpar resultados anteriores e importar
      setImportResults([]);
      importDemandas.mutate(demandasParaImportar);
      
    } catch (error) {
      console.error('Erro ao finalizar importação:', error);
      toast.error("Erro ao finalizar importação.");
    }
  };

  // Handler para receber as decisões do modal
  const handleValidacaoDecisoes = async (decisoes: any[]) => {
    setShowValidacaoModal(false);
    
    if (tempImportData) {
      await finalizarImportacao(
        tempImportData.demandasComDados,
        tempImportData.municipeMap,
        decisoes
      );
    }
    
    setTempImportData(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando demandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 py-3 md:container md:mx-auto md:px-4 md:py-6 space-y-3 md:space-y-8">
        {/* Header */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
          <CardHeader className="pb-3 md:pb-4 px-3 py-3 md:px-6 md:py-6">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <span className="text-base md:text-xl truncate">Lista de Demandas</span>
                {searchParams.get('areaNome') && (
                  <span className="text-xs md:text-lg text-muted-foreground ml-2 truncate hidden md:inline">
                    - Área: {decodeURIComponent(searchParams.get('areaNome') || '')}
                  </span>
                )}
                {searchParams.get('responsavelNome') && (
                  <span className="text-xs md:text-lg text-muted-foreground ml-2 truncate hidden md:inline">
                    - Responsável: {decodeURIComponent(searchParams.get('responsavelNome') || '')}
                  </span>
                )}
              </div>

              {/* Mobile: overflow menu */}
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsConfigStatusOpen(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar Status
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/balanco-demandas")}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Balanço
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Desktop: botões visíveis */}
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsConfigStatusOpen(true)} title="Configurar Status">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/balanco-demandas")} title="Balanço de Demandas">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Balanço
                  </Button>
                  <ImportCSVDialogDemandas 
                    onFileSelect={handleFileImport}
                    isImporting={importDemandas.isPending}
                    fileInputRef={fileInputRef}
                    importResults={importResults}
                    importProgress={importProgress}
                  />
                  <Button variant="outline" size="sm" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>

                <NovaDemandaDialog />
              </div>
            </CardTitle>
          </CardHeader>
        </Card>


        {/* Filtros */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
          <CardContent className="px-3 py-3 md:px-6 md:py-4 space-y-3">
            {/* Busca (sempre visível) + Toggle filtros mobile */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Título, protocolo ou munícipe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {/* Mobile: botão toggle filtros */}
              <Button 
                variant="outline" 
                size="sm" 
                className="md:hidden shrink-0 gap-1.5"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                )}
                {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            
            {/* Filtros expandíveis: sempre visível no desktop, toggle no mobile */}
            <div className={`space-y-3 ${showFilters ? '' : 'hidden md:block'}`}>
              {/* Linha 1: filtros principais */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-3">
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Status
                </label>
                <MultiSelectFilter
                  options={statusList.map((s) => ({ value: s.slug, label: s.nome, color: s.cor }))}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Todos os status"
                  searchPlaceholder="Buscar status…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Área
                </label>
                <MultiSelectFilter
                  options={areas.map((a) => ({ value: a.id, label: a.nome }))}
                  selected={areaFilter}
                  onChange={setAreaFilter}
                  placeholder="Todas as áreas"
                  searchPlaceholder="Buscar área…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Munícipe
                </label>
                <MultiSelectFilter
                  options={municipesList.map((m) => ({ value: m.id, label: m.nome }))}
                  selected={municipeFilter}
                  onChange={setMunicipeFilter}
                  placeholder="Todos os munícipes"
                  searchPlaceholder="Buscar munícipe…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Responsável
                </label>
                <MultiSelectFilter
                  options={responsaveis.map((r) => ({ value: r.id, label: r.nome }))}
                  selected={responsavelFilter}
                  onChange={setResponsavelFilter}
                  placeholder="Todos os responsáveis"
                  searchPlaceholder="Buscar responsável…"
                />
              </div>
            </div>

            {/* Linha 2: Localização + Atraso + Período */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Cidade
                </label>
                <MultiSelectFilter
                  options={cidades.map((c) => ({ value: c, label: c }))}
                  selected={cidadeFilter}
                  onChange={setCidadeFilter}
                  placeholder="Todas as cidades"
                  searchPlaceholder="Buscar cidade…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Bairro
                </label>
                <MultiSelectFilter
                  options={bairros.map((b) => ({ value: b, label: b }))}
                  selected={bairroFilter}
                  onChange={setBairroFilter}
                  placeholder="Todos os bairros"
                  searchPlaceholder="Buscar bairro…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Atraso
                </label>
                <Select value={atrasoFilter} onValueChange={setAtrasoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem filtro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sem filtro de atraso</SelectItem>
                    <SelectItem value="overdue">Em atraso</SelectItem>
                    <SelectItem value="30">Mais de 30 dias</SelectItem>
                    <SelectItem value="60">Mais de 60 dias</SelectItem>
                    <SelectItem value="90">Mais de 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Período agrupado */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Período de criação
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    max={dateTo || undefined}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground flex-shrink-0">até</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom || undefined}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full text-xs md:text-sm">
                  Limpar Filtros
                </Button>
              </div>
            </div>
            </div> {/* Close collapsible filters */}

            {/* Controles de paginação (sempre visível) */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Ordenar:</span>
                  <Select
                    value={orderBy}
                    onValueChange={(value) => {
                      setOrderBy(value as typeof orderBy);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-36 md:w-44 h-8 text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mais_recente">Mais recentes</SelectItem>
                      <SelectItem value="mais_antigo">Mais antigos</SelectItem>
                      <SelectItem value="titulo_asc">Título (A-Z)</SelectItem>
                      <SelectItem value="titulo_desc">Título (Z-A)</SelectItem>
                      <SelectItem value="prazo_proximo">Prazo mais próximo</SelectItem>
                      <SelectItem value="prioridade">Prioridade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Mostrar:</span>
                  <Select 
                    value={pageSize.toString()} 
                    onValueChange={(value) => {
                      setPageSize(value === "all" ? "all" : parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-28 md:w-40 h-8 text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="10">10 por página</SelectItem>
                      <SelectItem value="50">50 por página</SelectItem>
                      <SelectItem value="100">100 por página</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {isLoading ? 'Carregando...' : 
                    pageSize === "all" ? 
                      `${filteredDemandas.length} demandas` :
                      `${Math.min((currentPage - 1) * (pageSize as number) + 1, totalDemandas)} a ${Math.min(currentPage * (pageSize as number), totalDemandas)} de ${totalDemandas} demandas`
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Demandas */}
        <div className="space-y-4">
          {paginatedDemandas.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma demanda encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            paginatedDemandas.map((demanda) => (
              <Card 
                key={demanda.id} 
                className="backdrop-blur-sm bg-card/95 border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => handleViewDemanda(demanda)}
              >
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 md:gap-4">
                    <div className="flex-1 space-y-1.5 md:space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 md:gap-2">
                        <h3 className="text-sm md:text-lg font-semibold text-foreground truncate max-w-[200px] md:max-w-none">
                          {demanda.titulo}
                        </h3>
                        <Badge variant="outline" className="text-[10px] md:text-xs shrink-0">
                          #{demanda.protocolo}
                        </Badge>
                        <StatusBadge status={demanda.status} size="md" />
                        <Badge 
                          variant="secondary"
                          className="text-[10px] md:text-xs shrink-0"
                          style={{ backgroundColor: getPrioridadeColor(demanda.prioridade), color: 'white' }}
                        >
                          {getPrioridadeLabel(demanda.prioridade)}
                        </Badge>
                        {demanda.humor && (
                          <HumorBadge humor={demanda.humor} size="md" />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Munícipe:</span> {demanda.municipes?.nome || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Área:</span> {demanda.areas?.nome || 'Sem área'}
                        </div>
                        <div>
                          <span className="font-medium">Responsável:</span> {getResponsavelNome(demanda.responsavel_id)}
                        </div>
                      </div>

                      {demanda.data_prazo && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Prazo:</span> {formatDateOnly(demanda.data_prazo)}
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {demanda.descricao}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <div>Criado em</div>
                        <div className="font-medium">
                          {formatDateTime(demanda.created_at)}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDemanda(demanda);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDemanda(demanda);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <DropdownMenuItem 
                                 onSelect={(e) => e.preventDefault()} 
                                 onClick={(e) => e.stopPropagation()}
                                 className="text-destructive focus:text-destructive"
                               >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a demanda "{demanda.titulo}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                 <AlertDialogAction 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleDeleteDemanda(demanda.id);
                                   }}
                                   className="bg-destructive hover:bg-destructive/90"
                                 >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Paginação e Contador */}
        {pageSize !== "all" && totalDemandas > 0 && (
          <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Contador */}
                <div className="text-sm text-muted-foreground">
                  Mostrando {Math.min((currentPage - 1) * (pageSize as number) + 1, totalDemandas)} a{" "}
                  {Math.min(currentPage * (pageSize as number), totalDemandas)} de {totalDemandas} demandas
                </div>
                
                {/* Navegação */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {/* Páginas */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total quando mostrar todas */}
        {pageSize === "all" && (
          <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="text-center text-sm text-muted-foreground">
                Total: {paginatedDemandas.length} demandas
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Visualização */}
        {selectedDemanda && (
          <ViewDemandaDialog
            demanda={selectedDemanda}
            open={isViewDialogOpen}
            onOpenChange={(open) => {
              setIsViewDialogOpen(open);
              if (!open) {
                // Limpar protocolo da URL ao fechar o modal
                setSearchParams({}, { replace: true });
              }
            }}
            onEdit={handleEditFromView}
          />
        )}
        
        {/* Dialog de Edição */}
        <EditDemandaDialog 
          open={isEditDialogOpen} 
          onOpenChange={setIsEditDialogOpen} 
          demanda={selectedDemanda}
        />

        {/* Modal de Validação de Munícipes */}
        <ValidarMunicipesDialog
          open={showValidacaoModal}
          onOpenChange={setShowValidacaoModal}
          municipesNaoEncontrados={tempImportData?.municipesNaoEncontrados || []}
          municipesExistentes={tempImportData?.municipesExistentes || []}
          onDecisoes={handleValidacaoDecisoes}
        />

        {/* Modal de Configuração de Status */}
        <ConfigurarStatusDialog
          open={isConfigStatusOpen}
          onOpenChange={setIsConfigStatusOpen}
        />
      </div>
    </div>
  );
}
