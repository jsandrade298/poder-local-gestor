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

  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Buscar demandas primeiro
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
  
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

    const csvData = filteredDemandas.map(demanda => [
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

    toast.success(`CSV exportado com sucesso! ${filteredDemandas.length} demandas exportadas.`);
  };

  // Função para processar CSV importado
  const importDemandas = useMutation({
    mutationFn: async (demandas: any[]) => {
      const results = [];
      
      for (const demanda of demandas) {
        try {
          const { data, error } = await supabase
            .from('demandas')
            .insert({
              titulo: demanda.titulo,
              descricao: demanda.descricao,
              municipe_id: demanda.municipeId,
              area_id: demanda.areaId || null,
              responsavel_id: demanda.responsavelId || null,
              status: demanda.status || 'aberta',
              prioridade: demanda.prioridade || 'media',
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
            // Se tem tag, tentar associar
            if (demanda.tagId) {
              const { error: tagError } = await supabase
                .from('demanda_tags')
                .insert({
                  demanda_id: data.id,
                  tag_id: demanda.tagId
                });
              
              if (tagError) {
                console.warn(`Erro ao associar tag para ${demanda.titulo}:`, tagError);
              }
            }
            
            results.push({ success: true, titulo: demanda.titulo, id: data.id });
          }
        } catch (err) {
          results.push({ success: false, titulo: demanda.titulo, error: 'Erro inesperado' });
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
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("O arquivo CSV está vazio ou não possui dados válidos.");
          return;
        }

        // Processar header
        const separator = csv.includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
        
        // Mapear colunas esperadas
        const expectedColumns = {
          titulo: ['titulo', 'title'],
          descricao: ['descricao', 'description'],
          municipe_nome: ['municipe_nome', 'municipe', 'citizen'],
          area_nome: ['area_nome', 'area'],
          responsavel_nome: ['responsavel_nome', 'responsavel', 'responsible'],
          status: ['status'],
          prioridade: ['prioridade', 'priority'],
          logradouro: ['logradouro', 'endereco', 'endereço', 'address', 'rua'],
          numero: ['numero', 'número', 'number'],
          bairro: ['bairro', 'neighborhood'],
          cidade: ['cidade', 'city'],
          cep: ['cep', 'zip'],
          complemento: ['complemento', 'complement'],
          data_prazo: ['data_prazo', 'prazo', 'deadline'],
          observacoes: ['observacoes', 'observações', 'notes'],
          tag: ['tag', 'tags', 'etiqueta']
        };

        // Buscar dados necessários para mapeamento
        const [existingMunicipes, existingAreas, existingResponsaveis, existingTags] = await Promise.all([
          supabase.from('municipes').select('id, nome'),
          supabase.from('areas').select('id, nome'),
          supabase.from('profiles').select('id, nome'),
          supabase.from('tags').select('id, nome')
        ]);

        const municipeMap = new Map(existingMunicipes.data?.map(m => [m.nome.toLowerCase(), m.id]) || []);
        const areaMap = new Map(existingAreas.data?.map(a => [a.nome.toLowerCase(), a.id]) || []);
        const responsavelMap = new Map(existingResponsaveis.data?.map(r => [r.nome.toLowerCase(), r.id]) || []);
        const tagMap = new Map(existingTags.data?.map(tag => [tag.nome.toLowerCase(), tag.id]) || []);

        // Processar dados
        const demandas = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.replace(/"/g, '').trim());
          const demanda: any = {};

          Object.keys(expectedColumns).forEach(key => {
            const possibleHeaders = expectedColumns[key as keyof typeof expectedColumns];
            const headerIndex = headers.findIndex(h => possibleHeaders.includes(h));
            
            if (headerIndex !== -1 && values[headerIndex]) {
              const value = values[headerIndex];
              
              if (key === 'data_prazo') {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    demanda[key] = date.toISOString().split('T')[0];
                  }
                } catch {
                  // Ignorar datas inválidas
                }
              } else if (key === 'municipe_nome') {
                const municipeId = municipeMap.get(value.toLowerCase().trim());
                if (municipeId) {
                  demanda.municipeId = municipeId;
                } else {
                  demanda.municipeError = `Munícipe "${value}" não encontrado`;
                }
              } else if (key === 'area_nome') {
                const areaId = areaMap.get(value.toLowerCase().trim());
                if (areaId) {
                  demanda.areaId = areaId;
                }
              } else if (key === 'responsavel_nome') {
                const responsavelId = responsavelMap.get(value.toLowerCase().trim());
                if (responsavelId) {
                  demanda.responsavelId = responsavelId;
                }
              } else if (key === 'tag') {
                const tagId = tagMap.get(value.toLowerCase().trim());
                if (tagId) {
                  demanda.tagId = tagId;
                }
              } else {
                demanda[key] = value;
              }
            }
          });

          return demanda;
        }).filter(d => d.titulo && d.titulo.trim() !== '' && d.descricao && d.descricao.trim() !== '' && d.municipeId);

        if (demandas.length === 0) {
          toast.error("Nenhuma demanda válida encontrada. Verifique os campos obrigatórios: título, descrição e munícipe.");
          return;
        }

        // Limpar resultados anteriores antes de nova importação
        setImportResults([]);
        importDemandas.mutate(demandas);
      } catch (error) {
        toast.error("Erro ao processar arquivo CSV. Verifique se o formato está correto.");
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    
    // Limpar input para permitir re-upload do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Demandas */}
        <div className="space-y-4">
          {filteredDemandas.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma demanda encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDemandas.map((demanda) => (
              <Card key={demanda.id} className="backdrop-blur-sm bg-card/95 border-0 shadow-lg hover:shadow-xl transition-shadow">
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
                          <Button variant="ghost" size="sm">
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
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
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
                                  onClick={() => handleDeleteDemanda(demanda.id)}
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
      </div>
    </div>
  );
}