import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2, Download, Upload, FileText, Activity } from "lucide-react";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { ImportCSVDialogDemandas } from "@/components/forms/ImportCSVDialogDemandas";
import { ValidarMunicipesDialog } from "@/components/forms/ValidarMunicipesDialog";
import { toast } from "sonner";
import { formatInTimeZone } from 'date-fns-tz';
import { formatDateOnly, formatDateTime } from '@/lib/dateUtils';
import { useLocation, useSearchParams } from "react-router-dom";

export default function Demandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [municipeFilter, setMunicipeFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [cidadeFilter, setCidadeFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [atrasoFilter, setAtrasoFilter] = useState("all");
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  
  // Estados para paginação
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Buscar demandas com paginação eficiente
  const { data: demandasData = { demandas: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['demandas', pageSize, currentPage, searchTerm, statusFilter, areaFilter, municipeFilter, responsavelFilter, cidadeFilter, bairroFilter, atrasoFilter],
    queryFn: async () => {
      // Se "Todas", buscar todas as demandas em lotes
      if (pageSize === "all") {
        console.log('🔄 Demandas: Carregando todas as demandas em lotes...');
        
        const BATCH_SIZE = 1000;
        let allDemandas: any[] = [];
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('demandas')
            .select(`
              *,
              areas(nome),
              municipes(nome)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);
          
          if (error) {
            console.error('❌ Demandas: Erro ao buscar lote:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allDemandas = [...allDemandas, ...data];
            offset += BATCH_SIZE;
            
            // Se retornou menos que o tamanho do lote, não há mais dados
            hasMore = data.length === BATCH_SIZE;
            
            console.log(`📦 Demandas: Lote carregado - ${data.length} demandas (total: ${allDemandas.length})`);
          } else {
            hasMore = false;
          }
        }
        
        console.log(`✅ Demandas: ${allDemandas.length} demandas carregadas em lotes`);
        return { demandas: allDemandas, total: allDemandas.length };
      }

      // Busca paginada normal
      const itemsPerPage = pageSize as number;
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      console.log(`🔄 Demandas: Carregando página ${currentPage} (${itemsPerPage} por página)`);

      // Buscar com paginação
      const { data, error, count } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error('❌ Demandas: Erro ao buscar página:', error);
        throw error;
      }
      
      console.log(`✅ Demandas: Página ${currentPage} carregada - ${data?.length || 0} demandas`);
      return { demandas: data || [], total: count || 0 };
    }
  });
  
  const demandas = demandasData.demandas;
  const totalDemandas = demandasData.total;
  
  useEffect(() => {
    const atrasoParam = searchParams.get('atraso');
    if (atrasoParam) {
      setAtrasoFilter(atrasoParam);
    }
    
    // Aplicar filtro de área se vier da página de Áreas
    const areaParam = searchParams.get('area');
    if (areaParam) {
      setAreaFilter(areaParam);
    }
    
    // Processar redirecionamento de notificação ou de outros locais
    const protocolo = searchParams.get('protocolo');
    const demandaId = searchParams.get('id');
    const atividadeId = searchParams.get('atividade');
    
    if ((protocolo || demandaId) && demandas.length > 0) {
      // Encontrar e abrir a demanda específica
      const demanda = demandas?.find(d => 
        protocolo ? d.protocolo === protocolo : d.id === demandaId
      );
      if (demanda) {
        setSelectedDemanda(demanda);
        setIsViewDialogOpen(true);
        
        // Se há uma atividade específica, destacá-la
        if (atividadeId) {
          setHighlightedActivityId(atividadeId);
        }
        
        // Limpar os parâmetros da URL após o redirecionamento
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
    
    // Aplicar filtro de responsável se vier da página de Usuários
    const responsavelParam = searchParams.get('responsavel');
    if (responsavelParam) {
      setResponsavelFilter(responsavelParam);
    }
  }, [searchParams, demandas]);


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

  // Buscar valores únicos para cidade e bairro
  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('cidade')
        .not('cidade', 'is', null)
        .order('cidade');
      
      if (error) throw error;
      return [...new Set(data.map(item => item.cidade))];
    }
  });

  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('bairro')
        .not('bairro', 'is', null)
        .order('bairro');
      
      if (error) throw error;
      return [...new Set(data.map(item => item.bairro))];
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'aberta': return 'default';
      case 'em_andamento': return 'secondary';
      case 'aguardando': return 'outline';
      case 'resolvida': return 'default';
      case 'cancelada': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta': return 'hsl(var(--chart-1))'; // #3b82f6
      case 'em_andamento': return 'hsl(var(--chart-2))'; // #f59e0b
      case 'aguardando': return 'hsl(var(--chart-3))'; // #8b5cf6
      case 'resolvida': return 'hsl(var(--chart-4))'; // #10b981
      case 'cancelada': return 'hsl(var(--chart-5))'; // #ef4444
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'em_andamento': return 'Em Andamento';
      case 'aguardando': return 'Aguardando';
      case 'resolvida': return 'Resolvida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
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

  const filteredDemandas = demandas.filter(demanda => {
    const matchesSearch = demanda.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.municipes?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || demanda.status === statusFilter;
    const matchesArea = areaFilter === "all" || demanda.area_id === areaFilter;
    const matchesMunicipe = municipeFilter === "all" || demanda.municipe_id === municipeFilter;
    const matchesResponsavel = responsavelFilter === "all" || demanda.responsavel_id === responsavelFilter;
    const matchesCidade = cidadeFilter === "all" || demanda.cidade === cidadeFilter;
    const matchesBairro = bairroFilter === "all" || demanda.bairro === bairroFilter;

    // Filtro de atraso
    let matchesAtraso = true;
    if (atrasoFilter !== "all") {
      if (!demanda.data_prazo || demanda.status === 'resolvida' || demanda.status === 'cancelada') {
        matchesAtraso = false;
      } else {
        const today = new Date('2025-09-03'); // Data atual para teste
        const prazo = new Date(demanda.data_prazo);
        const isOverdue = today > prazo;
        
        if (atrasoFilter === "overdue") {
          matchesAtraso = isOverdue;
        } else if (atrasoFilter === "30" || atrasoFilter === "60" || atrasoFilter === "90") {
          if (!isOverdue) {
            matchesAtraso = false;
          } else {
            const diasAtraso = Math.floor((today.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
            const minDays = parseInt(atrasoFilter);
            matchesAtraso = diasAtraso > minDays;
          }
        }
      }
    }

    return matchesSearch && matchesStatus && matchesArea && matchesMunicipe && matchesResponsavel && matchesCidade && matchesBairro && matchesAtraso;
  });

  // Paginação para dados filtrados (quando pageSize !== "all")
  const paginatedDemandas = pageSize === "all" 
    ? filteredDemandas 
    : filteredDemandas;

  // Calcular total de páginas
  const totalPages = pageSize === "all" ? 1 : Math.ceil(totalDemandas / (pageSize as number));

  // Resetar página quando mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, areaFilter, municipeFilter, responsavelFilter, cidadeFilter, bairroFilter, atrasoFilter]);


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
    setStatusFilter("all");
    setAreaFilter("all");
    setMunicipeFilter("all");
    setResponsavelFilter("all");
    setCidadeFilter("all");
    setBairroFilter("all");
    setAtrasoFilter("all");
  };

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

  // Função para processar demandas em lotes
  const importDemandas = useMutation({
    mutationFn: async (demandas: any[]) => {
      console.log(`📥 Iniciando importação de ${demandas.length} demandas`);
      
      // Processar em lotes para evitar problemas de performance
      const BATCH_SIZE = 50; // Processar 50 demandas por vez
      const results = [];
      
      // Dividir em lotes
      for (let i = 0; i < demandas.length; i += BATCH_SIZE) {
        const batch = demandas.slice(i, i + BATCH_SIZE);
        console.log(`🔄 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(demandas.length / BATCH_SIZE)} (${batch.length} demandas)`);
        
        // Processar lote atual
        for (const demanda of batch) {
          try {
            // Mapear prioridade para valores válidos do enum
            const prioridadeMap: Record<string, string> = {
              'alta': 'alta',
              'média': 'media',
              'media': 'media',
              'baixa': 'baixa',
              'urgente': 'urgente'
            };
            
            // Mapear status para valores válidos do enum
            const statusMap: Record<string, string> = {
              'aberta': 'aberta',
              'em andamento': 'em_andamento',
              'resolvida': 'resolvida',
              'cancelada': 'cancelada'
            };
            
            console.log('🔍 Demanda original:', JSON.stringify({
              titulo: demanda.titulo,
              prioridade_original: demanda.prioridade,
              status_original: demanda.status,
              prioridade_type: typeof demanda.prioridade,
              status_type: typeof demanda.status
            }));
            
            const prioridadeNormalizada = demanda.prioridade 
              ? prioridadeMap[demanda.prioridade.toLowerCase()] || 'media'
              : 'media';
              
            const statusNormalizado = demanda.status 
              ? statusMap[demanda.status.toLowerCase()] || 'aberta'
              : 'aberta';
              
            console.log('✅ Valores normalizados:', JSON.stringify({
              prioridade_original: demanda.prioridade,
              prioridade_normalizada: prioridadeNormalizada,
              status_original: demanda.status,
              status_normalizado: statusNormalizado
            }));

            const { data, error } = await supabase
              .from('demandas')
              .insert({
                titulo: demanda.titulo,
                descricao: demanda.descricao,
                municipe_id: demanda.municipeId,
                area_id: demanda.areaId || null,
                responsavel_id: demanda.responsavelId || null,
                status: statusNormalizado,
                prioridade: prioridadeNormalizada,
                logradouro: demanda.logradouro || null,
                numero: demanda.numero || null,
                bairro: demanda.bairro || null,
                cidade: demanda.cidade || 'São Paulo',
                cep: demanda.cep || null,
                complemento: demanda.complemento || null,
                data_prazo: demanda.data_prazo || null,
                observacoes: demanda.observacoes || null,
                criado_por: (await supabase.auth.getUser()).data.user?.id
              })
               .select('id')
               .single();

            if (error) {
              results.push({ success: false, titulo: demanda.titulo, error: error.message });
            } else {
              results.push({ success: true, titulo: demanda.titulo, id: data.id });
            }
          } catch (err) {
            results.push({ success: false, titulo: demanda.titulo, error: 'Erro inesperado' });
          }
        }
        
        // Pequena pausa entre lotes para não sobrecarregar o servidor
        if (i + BATCH_SIZE < demandas.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      setImportResults(results);
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      
      console.log(`✅ Importação concluída: ${successCount} sucessos, ${errorCount} erros`);
    },
    onError: (error) => {
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
        
        // Processar linhas e remover vazias
        const allLines = csv.split(/\r?\n/);
        const lines = [];
        
        for (const line of allLines) {
          const trimmed = line.trim();
          if (trimmed) {
            // Verificar se a linha tem conteúdo real (não apenas separadores)
            const testSplit = trimmed.split(/[;,]/);
            const hasContent = testSplit.some(cell => cell.replace(/"/g, '').trim());
            if (hasContent) {
              lines.push(trimmed);
            }
          }
        }
        
        console.log(`📁 Total de linhas válidas encontradas: ${lines.length - 1} (excluindo header)`);
        
        if (lines.length < 2) {
          toast.error("O arquivo CSV está vazio ou não possui dados válidos.");
          return;
        }

        // Detectar separador
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';
        const headers = firstLine.split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        
        console.log(`📋 Headers encontrados: ${headers.join(', ')}`);
        console.log(`📋 Separador detectado: "${separator}"`);
        console.log(`📋 Total de colunas no header: ${headers.length}`);

        // Mapear colunas por posição fixa (A=0, B=1, C=2, etc.)
        const columnPositions = {
          titulo: 0,        // Coluna A
          descricao: 1,     // Coluna B  
          municipe_nome: 2, // Coluna C
          area_nome: 3,     // Coluna D
          responsavel_nome: 4, // Coluna E
          status: 5,        // Coluna F
          prioridade: 6,    // Coluna G
          logradouro: 7,    // Coluna H
          numero: 8,        // Coluna I
          bairro: 9,        // Coluna J
          cidade: 10,       // Coluna K
          cep: 11,          // Coluna L
          complemento: 12,  // Coluna M
          data_prazo: 13,   // Coluna N
          observacoes: 14   // Coluna O
        };

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

        const [allMunicipes, existingAreas, existingResponsaveis] = await Promise.all([
          carregarTodosMunicipes(),
          supabase.from('areas').select('id, nome'),
          supabase.from('profiles').select('id, nome')
        ]);

        console.log(`📊 Dados carregados: ${allMunicipes?.length || 0} munícipes (em lotes), ${existingAreas.data?.length || 0} áreas, ${existingResponsaveis.data?.length || 0} responsáveis`);

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
          
          const values = line.split(separator).map(v => 
            v.replace(/^["']|["']$/g, '').trim()
          );
          
          console.log(`🔍 Processando linha ${i + 1}:`, {
            totalColunas: values.length,
            titulo: values[0] || '(vazio)',
            descricao: values[1] || '(vazio)',
            municipe: values[2] || '(vazio)'
          });
          
          // Verificar se há colunas suficientes
          if (values.length < 15) {
            console.log(`⚠️ Linha ${i + 1} tem apenas ${values.length} colunas, esperado 15. Adicionando colunas vazias.`);
            // Preencher com valores vazios até ter 15 colunas
            while (values.length < 15) {
              values.push('');
            }
          }
          
          // Verificar se a linha tem dados válidos (título na coluna A)
          if (!values[columnPositions.titulo] || !values[columnPositions.titulo].trim()) {
            console.log(`⚠️ Linha ${i + 1} ignorada: sem título na coluna A - valor: "${values[columnPositions.titulo] || ''}"`);
            continue;
          }
          
          const demanda: any = { linha: i + 1 };
          
          // Processar campos usando posições fixas
          Object.keys(columnPositions).forEach(key => {
            const columnIndex = columnPositions[key as keyof typeof columnPositions];
            const value = values[columnIndex];
            
            // Debug específico para título e descrição
            if (key === 'titulo' || key === 'descricao') {
              console.log(`📝 Linha ${i + 1} - ${key} (col ${columnIndex}): "${value || '(vazio)'}"`);
            }
            
            if (value && value.trim()) {
              
              if (key === 'municipe_nome') {
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
                const statusMap: Record<string, string> = {
                  'aberta': 'aberta',
                  'em andamento': 'em_andamento',
                  'em_andamento': 'em_andamento',
                  'aguardando': 'aguardando',
                  'resolvida': 'resolvida',
                  'cancelada': 'cancelada'
                };
                demanda.status = statusMap[value.toLowerCase()] || 'aberta';
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
        
        const municipesArray = novosMunicipes.map(d => ({
          nome: d.novoNome.trim(),
          telefone: d.telefone || null,
          email: d.email || null,
          endereco: d.endereco || null,
          numero: d.numero || null,
          bairro: d.bairro || null,
          cidade: d.cidade || 'Santo André',
          cep: d.cep || null,
          data_nascimento: d.data_nascimento || null,
          observacoes: d.observacoes || null
        }));
        
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
        titulo: d.titulo,
        descricao: d.descricao || d.titulo,
        municipeId: d.municipeId,
        areaId: d.areaId || null,
        responsavelId: d.responsavelId || null,
        status: d.status || 'aberta',
        prioridade: d.prioridade || 'media',
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        bairro: d.bairro || null,
        cidade: d.cidade || 'Santo André',
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
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando demandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Gestão de Demandas
              {searchParams.get('areaNome') && (
                <span className="text-lg text-muted-foreground ml-2">
                  - Área: {decodeURIComponent(searchParams.get('areaNome') || '')}
                </span>
              )}
              {searchParams.get('responsavelNome') && (
                <span className="text-lg text-muted-foreground ml-2">
                  - Responsável: {decodeURIComponent(searchParams.get('responsavelNome') || '')}
                </span>
              )}
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              Acompanhe e gerencie todas as demandas do gabinete
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportCSVDialogDemandas 
              onFileSelect={handleFileImport}
              isImporting={importDemandas.isPending}
              fileInputRef={fileInputRef}
              importResults={importResults}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportToCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <NovaDemandaDialog />
          </div>
        </div>

        {/* Filtros */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-4">
              <div className="relative xl:col-span-2">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por título, protocolo ou munícipe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="aguardando">Aguardando</SelectItem>
                    <SelectItem value="resolvida">Resolvida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Área
                </label>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as áreas</SelectItem>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Munícipe
                </label>
                <Select value={municipeFilter} onValueChange={setMunicipeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Munícipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os munícipes</SelectItem>
                    {demandas.map((demanda) => demanda.municipes).filter((municipe, index, self) => 
                      municipe && self.findIndex(m => m?.nome === municipe.nome) === index
                    ).map((municipe) => (
                      <SelectItem key={municipe?.nome} value={demandas.find(d => d.municipes?.nome === municipe?.nome)?.municipe_id || ""}>
                        {municipe?.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Responsável
                </label>
                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os responsáveis</SelectItem>
                    {responsaveis.map((responsavel) => (
                      <SelectItem key={responsavel.id} value={responsavel.id}>
                        {responsavel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Cidade
                </label>
                <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {cidades.map((cidade) => (
                      <SelectItem key={cidade} value={cidade}>
                        {cidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Bairro
                </label>
                <Select value={bairroFilter} onValueChange={setBairroFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os bairros</SelectItem>
                    {bairros.map((bairro) => (
                      <SelectItem key={bairro} value={bairro}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Atraso
                </label>
                <Select value={atrasoFilter} onValueChange={setAtrasoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Atraso" />
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

              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
                
                {/* Controle de Paginação */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Mostrar:</span>
                  <Select 
                    value={pageSize.toString()} 
                    onValueChange={(value) => {
                      setPageSize(value === "all" ? "all" : parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {demanda.titulo}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          #{demanda.protocolo}
                        </Badge>
                        <Badge 
                          variant={getStatusVariant(demanda.status)}
                          style={{ backgroundColor: getStatusColor(demanda.status), color: 'white' }}
                        >
                          {getStatusLabel(demanda.status)}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          style={{ backgroundColor: getPrioridadeColor(demanda.prioridade), color: 'white' }}
                        >
                          {getPrioridadeLabel(demanda.prioridade)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Munícipe:</span> {demanda.municipes?.nome || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Área:</span> {demanda.areas?.nome || 'Sem área'}
                        </div>
                        <div>
                          <span className="font-medium">Responsável:</span> Sem responsável
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
                          <DropdownMenuItem onClick={() => handleViewDemanda(demanda)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditDemanda(demanda)}>
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
            onOpenChange={setIsViewDialogOpen}
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
      </div>
    </div>
  );
}