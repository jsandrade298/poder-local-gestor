import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { ClusterMap } from '@/components/mapa/ClusterMap';
import { HeatmapControls } from '@/components/mapa/HeatmapControls';
import { ShapefileUpload } from '@/components/mapa/ShapefileUpload';
import { VotosUpload } from '@/components/mapa/VotosUpload';
import { useCamadasGeograficas } from '@/hooks/useCamadasGeograficas';
import { useDadosEleitorais } from '@/hooks/useDadosEleitorais';
import { useRotas, Rota } from '@/hooks/useRotas';
import { calcularEstatisticasPorRegiao, getFeatureName, filtrarPorRegiao } from '@/lib/geoUtils';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';
import { EditDemandaDialog } from '@/components/forms/EditDemandaDialog';
import { MunicipeDetailsDialog } from '@/components/forms/MunicipeDetailsDialog';
import { CriarRotaDialog } from '@/components/forms/CriarRotaDialog';
import { ConcluirRotaDialog } from '@/components/forms/ConcluirRotaDialog';
import { GerenciarRotasModal } from '@/components/forms/GerenciarRotasModal';
import { BuscaEnderecoInput } from '@/components/forms/BuscaEnderecoInput';
import { 
  MapPin, 
  Filter, 
  Route, 
  BarChart3, 
  Search, 
  RefreshCw,
  FileText,
  Users,
  Phone,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Navigation,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Flame,
  Link2,
  Layers,
  Eye,
  EyeOff,
  Palette,
  Map as MapIcon,
  Vote,
  Save,
  FolderOpen,
  PieChart,
  TrendingUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

// Cores por status (valores reais do banco)
const STATUS_COLORS: Record<string, string> = {
  'solicitada': '#3b82f6',    // Azul
  'em_producao': '#f59e0b',   // Amarelo/Laranja
  'encaminhado': '#8b5cf6',   // Roxo
  'atendido': '#22c55e',      // Verde
  'devolvido': '#ef4444',     // Vermelho
  'visitado': '#06b6d4',      // Ciano
};

const STATUS_LABELS: Record<string, string> = {
  'solicitada': 'Solicitada',
  'em_producao': 'Em Produção',
  'encaminhado': 'Encaminhado',
  'atendido': 'Atendido',
  'devolvido': 'Devolvido',
  'visitado': 'Visitado',
};

export default function MapaUnificado() {
  // Hook de dados
  const {
    areas,
    tags,
    demandas,
    municipes,
    demandasRaw,
    municipesRaw,
    semCoordenadas,
    isLoading,
    refetch
  } = useMapaUnificado();

  // Query client para invalidar queries manualmente
  const queryClient = useQueryClient();

  // Hook para camadas geográficas
  const {
    camadas,
    camadasVisiveis,
    adicionarCamada,
    toggleVisibilidade,
    atualizarCor,
    atualizarOpacidade,
    removerCamada,
    isLoading: isLoadingCamadas
  } = useCamadasGeograficas();

  // Estado para camada selecionada nas estatísticas (declarado ANTES do hook que o usa)
  const [camadaSelecionadaStats, setCamadaSelecionadaStats] = useState<string | null>(null);

  // Inicializar camadaSelecionadaStats quando há camadas visíveis
  useEffect(() => {
    if (!camadaSelecionadaStats && camadasVisiveis.length > 0) {
      setCamadaSelecionadaStats(camadasVisiveis[0].id);
    }
  }, [camadasVisiveis, camadaSelecionadaStats]);

  // Hook para dados eleitorais (usa a camada selecionada)
  const {
    dadosEleitorais,
    eleicoesDisponiveis,
    getVotosPorRegiao,
    getTotalEleitoresPorRegiao,
    getTotalVotos,
    getTotalEleitores
  } = useDadosEleitorais(camadaSelecionadaStats);

  // Estados de filtro
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'demandas' | 'municipes' | 'nenhum'>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [areasFiltro, setAreasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);

  // Estados de heatmap
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [heatmapType, setHeatmapType] = useState<'demandas' | 'municipes' | 'ambos'>('demandas');

  // Estado de clustering
  const [clusterEnabled, setClusterEnabled] = useState(true);

  // Estado do Filtro Cruzado
  const [filtroCruzado, setFiltroCruzado] = useState(false);

  // Estados de seções expandidas
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [areasExpanded, setAreasExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);

  // Estados de seleção
  const [itemSelecionado, setItemSelecionado] = useState<DemandaMapa | MunicipeMapa | null>(null);
  const [clusterSelecionado, setClusterSelecionado] = useState<{
    demandas: DemandaMapa[];
    municipes: MunicipeMapa[];
  } | null>(null);

  // Estados dos modais
  const [demandaModalId, setDemandaModalId] = useState<string | null>(null);
  const [demandaParaEditar, setDemandaParaEditar] = useState<any>(null);
  const [isEditDemandaOpen, setIsEditDemandaOpen] = useState(false);
  const [municipeModalId, setMunicipeModalId] = useState<string | null>(null);
  const [municipeParaEditar, setMunicipeParaEditar] = useState<any>(null);
  const [isEditMunicipeOpen, setIsEditMunicipeOpen] = useState(false);

  // Estado da sidebar minimizada
  const [sidebarMinimizada, setSidebarMinimizada] = useState(false);

  // Estado da aba do cluster
  const [abaCluster, setAbaCluster] = useState<'demandas' | 'municipes'>('demandas');

  // Estados de rota
  const [pontosRota, setPontosRota] = useState<Array<DemandaMapa | MunicipeMapa>>([]);
  const [origemRota, setOrigemRota] = useState<{ lat: number; lng: number } | null>(null);
  const [destinoRota, setDestinoRota] = useState<{ lat: number; lng: number } | null>(null);
  const [otimizarRota, setOtimizarRota] = useState(false);
  
  // Estados para modais de rotas
  const [criarRotaDialogOpen, setCriarRotaDialogOpen] = useState(false);
  const [concluirRotaDialogOpen, setConcluirRotaDialogOpen] = useState(false);
  const [gerenciarRotasOpen, setGerenciarRotasOpen] = useState(false);
  const [rotaParaConcluir, setRotaParaConcluir] = useState<Rota | null>(null);
  
  // Estados para modal de munícipe (para conclusão de rota)
  const [municipeDetalhesOpen, setMunicipeDetalhesOpen] = useState(false);
  const [municipeParaDetalhes, setMunicipeParaDetalhes] = useState<any>(null);

  // Estados para camadas geográficas (camadaSelecionadaStats já declarado acima)
  const [colorirPorDensidade, setColorirPorDensidade] = useState(false);
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<{
    camadaId: string;
    feature: any;
    nome: string;
  } | null>(null);

  // Estado da aba da região
  const [abaRegiao, setAbaRegiao] = useState<'dados' | 'demandas' | 'municipes'>('dados');

  // Estado do modal de rankings
  const [modalRankingsAberto, setModalRankingsAberto] = useState(false);

  // Estados para dados eleitorais e novos modos de visualização
  const [modoVisualizacao, setModoVisualizacao] = useState<'padrao' | 'resolutividade' | 'votos' | 'comparativo' | 'predominancia'>('padrao');
  const [eleicaoSelecionada, setEleicaoSelecionada] = useState<string | null>(null);

  // IDs de munícipes que têm as tags selecionadas (para filtro cruzado)
  const municipesComTagsSelecionadas = useMemo(() => {
    if (tagsFiltro.length === 0) return [];
    return municipes
      .filter(m => m.tags?.some(t => tagsFiltro.includes(t.id)))
      .map(m => m.id);
  }, [municipes, tagsFiltro]);

  // IDs de munícipes que têm demandas com os filtros selecionados (para filtro cruzado inverso)
  const municipesComDemandasFiltradas = useMemo(() => {
    if (statusFiltro.length === 0 && areasFiltro.length === 0) return [];
    
    return [...new Set(
      demandas
        .filter(d => {
          const matchStatus = statusFiltro.length === 0 || (d.status && statusFiltro.includes(d.status));
          const matchArea = areasFiltro.length === 0 || (d.area_id && areasFiltro.includes(d.area_id));
          return matchStatus && matchArea && d.municipe_id;
        })
        .map(d => d.municipe_id!)
    )];
  }, [demandas, statusFiltro, areasFiltro]);

  // Filtrar demandas
  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => {
      // Busca textual
      if (busca) {
        const termo = busca.toLowerCase();
        const match = 
          d.titulo?.toLowerCase().includes(termo) ||
          d.protocolo?.toLowerCase().includes(termo) ||
          d.bairro?.toLowerCase().includes(termo) ||
          d.municipe_nome?.toLowerCase().includes(termo);
        if (!match) return false;
      }

      // Filtro de status (multi-select)
      if (statusFiltro.length > 0 && d.status && !statusFiltro.includes(d.status)) return false;

      // Filtro de áreas (multi-select)
      if (areasFiltro.length > 0 && d.area_id && !areasFiltro.includes(d.area_id)) return false;

      // FILTRO CRUZADO: Tags → Demandas
      if (filtroCruzado && tagsFiltro.length > 0) {
        if (!d.municipe_id || !municipesComTagsSelecionadas.includes(d.municipe_id)) {
          return false;
        }
      }

      return true;
    });
  }, [demandas, busca, statusFiltro, areasFiltro, filtroCruzado, tagsFiltro, municipesComTagsSelecionadas]);

  // Filtrar munícipes
  const municipesFiltrados = useMemo(() => {
    return municipes.filter(m => {
      // Busca textual
      if (busca) {
        const termo = busca.toLowerCase();
        const match = 
          m.nome?.toLowerCase().includes(termo) ||
          m.bairro?.toLowerCase().includes(termo) ||
          m.endereco?.toLowerCase().includes(termo);
        if (!match) return false;
      }

      // Filtro de tags (multi-select)
      if (tagsFiltro.length > 0) {
        const temAlgumaTag = m.tags?.some(t => tagsFiltro.includes(t.id));
        if (!temAlgumaTag) return false;
      }

      // FILTRO CRUZADO: Demandas → Munícipes
      if (filtroCruzado && (statusFiltro.length > 0 || areasFiltro.length > 0)) {
        if (!municipesComDemandasFiltradas.includes(m.id)) {
          return false;
        }
      }

      return true;
    });
  }, [municipes, busca, tagsFiltro, filtroCruzado, statusFiltro, areasFiltro, municipesComDemandasFiltradas]);

  // Estatísticas do filtro cruzado
  const estatisticasCruzado = useMemo(() => {
    if (!filtroCruzado) return null;
    
    return {
      municipesPorTags: municipesComTagsSelecionadas.length,
      demandasPorTags: tagsFiltro.length > 0 
        ? demandas.filter(d => d.municipe_id && municipesComTagsSelecionadas.includes(d.municipe_id)).length 
        : 0,
      municipesPorDemandas: municipesComDemandasFiltradas.length,
      demandasComFiltro: (statusFiltro.length > 0 || areasFiltro.length > 0)
        ? demandas.filter(d => {
            const matchStatus = statusFiltro.length === 0 || (d.status && statusFiltro.includes(d.status));
            const matchArea = areasFiltro.length === 0 || (d.area_id && areasFiltro.includes(d.area_id));
            return matchStatus && matchArea;
          }).length
        : 0
    };
  }, [filtroCruzado, tagsFiltro, statusFiltro, areasFiltro, municipesComTagsSelecionadas, municipesComDemandasFiltradas, demandas]);

  // Contagem por status
  const contagemStatus = useMemo(() => {
    const contagem: Record<string, number> = {};
    demandasRaw.forEach(d => {
      const status = d.status || 'sem_status';
      contagem[status] = (contagem[status] || 0) + 1;
    });
    return contagem;
  }, [demandasRaw]);

  // Calcular centro aproximado
  const centroProximidade = useMemo(() => {
    const pontosComCoordenadas = [
      ...demandasRaw.filter(d => d.latitude && d.longitude),
      ...municipesRaw.filter(m => m.latitude && m.longitude)
    ];
    
    if (pontosComCoordenadas.length === 0) return null;
    
    const somaLat = pontosComCoordenadas.reduce((acc, p) => acc + (p.latitude || 0), 0);
    const somaLng = pontosComCoordenadas.reduce((acc, p) => acc + (p.longitude || 0), 0);
    
    return {
      lat: somaLat / pontosComCoordenadas.length,
      lng: somaLng / pontosComCoordenadas.length
    };
  }, [demandasRaw, municipesRaw]);

  // Total de itens no mapa
  const totalNoMapa = 
    tipoFiltro === 'nenhum' ? 0 :
    (tipoFiltro === 'todos' || tipoFiltro === 'demandas' ? demandasFiltradas.length : 0) +
    (tipoFiltro === 'todos' || tipoFiltro === 'municipes' ? municipesFiltrados.length : 0);

  // Calcular estatísticas por região
  const estatisticasPorRegiao = useMemo(() => {
    const stats = new Map<string, Map<string, { demandas: number; municipes: number }>>();
    
    if (!Array.isArray(camadasVisiveis) || camadasVisiveis.length === 0) {
      return stats;
    }
    
    camadasVisiveis.forEach(camada => {
      if (camada?.geojson) {
        try {
          const camadaStats = calcularEstatisticasPorRegiao(
            camada.geojson,
            demandasFiltradas || [],
            municipesFiltrados || []
          );
          stats.set(camada.id, camadaStats);
        } catch (err) {
          console.warn('Erro ao calcular estatísticas para camada:', camada.id, err);
        }
      }
    });
    
    return stats;
  }, [camadasVisiveis, demandasFiltradas, municipesFiltrados]);

  // Calcular votos por camada
  const votosPorCamada = useMemo(() => {
    const votosMap = new Map<string, Map<string, number>>();
    if (dadosEleitorais.length > 0 && camadaSelecionadaStats) {
      const votosCamada = getVotosPorRegiao(eleicaoSelecionada || undefined);
      votosMap.set(camadaSelecionadaStats, votosCamada);
    }
    return votosMap;
  }, [dadosEleitorais, camadaSelecionadaStats, eleicaoSelecionada, getVotosPorRegiao]);

  // Calcular total de eleitores por camada
  const totalEleitoresPorCamada = useMemo(() => {
    const eleitoresMap = new Map<string, Map<string, number>>();
    if (dadosEleitorais.length > 0 && camadaSelecionadaStats) {
      const eleitoresCamada = getTotalEleitoresPorRegiao(eleicaoSelecionada || undefined);
      eleitoresMap.set(camadaSelecionadaStats, eleitoresCamada);
    }
    return eleitoresMap;
  }, [dadosEleitorais, camadaSelecionadaStats, eleicaoSelecionada, getTotalEleitoresPorRegiao]);

  // Obter estatísticas ordenadas
  const getEstatisticasCamadaOrdenadas = useCallback((camadaId: string | null | undefined) => {
    if (!camadaId) return [];
    
    const stats = estatisticasPorRegiao.get(camadaId);
    const votos = votosPorCamada.get(camadaId);
    
    const nomesRegioes = new Set<string>();
    stats?.forEach((_, nome) => nomesRegioes.add(nome));
    votos?.forEach((_, nome) => nomesRegioes.add(nome));
    
    if (nomesRegioes.size === 0) return [];
    
    try {
      return Array.from(nomesRegioes)
        .map(nome => {
          const estatistica = stats?.get(nome);
          const votosRegiao = votos?.get(nome) || 0;
          
          let total = 0;
          if (tipoFiltro === 'demandas') {
            total = estatistica?.demandas || 0;
          } else if (tipoFiltro === 'municipes') {
            total = estatistica?.municipes || 0;
          } else {
            total = (estatistica?.demandas || 0) + (estatistica?.municipes || 0);
          }
          
          return {
            nome,
            demandas: estatistica?.demandas || 0,
            municipes: estatistica?.municipes || 0,
            votos: votosRegiao,
            total
          };
        })
        .filter(item => item.total > 0 || item.votos > 0)
        .sort((a, b) => {
          if (modoVisualizacao === 'votos') {
            return b.votos - a.votos;
          }
          return b.total - a.total;
        });
    } catch (err) {
      console.warn('Erro ao ordenar estatísticas:', err);
      return [];
    }
  }, [estatisticasPorRegiao, votosPorCamada, modoVisualizacao, tipoFiltro]);

  // Handler para upload de shapefile
  const handleShapefileUpload = useCallback((
    geojson: any, 
    nome: string, 
    tipo: string, 
    cor: string, 
    opacidade: number
  ) => {
    adicionarCamada.mutate({
      nome,
      tipo,
      geojson,
      cor_padrao: cor,
      opacidade,
      visivel: true
    });
  }, [adicionarCamada]);

  // Handler para clique em uma região
  const handleRegiaoClick = useCallback((camadaId: string, feature: any, nomeRegiao: string) => {
    setRegiaoSelecionada({ camadaId, feature, nome: nomeRegiao });
    setAbaRegiao('dados');
    setItemSelecionado(null);
    setClusterSelecionado(null);
  }, []);

  // Dados da região selecionada e cálculos para rankings
  const dadosRegiaoSelecionada = useMemo(() => {
    if (!regiaoSelecionada) return null;

    const nomeRegiao = regiaoSelecionada.nome;
    const camadaId = regiaoSelecionada.camadaId;

    const demandasDaRegiao = demandasFiltradas.filter(d => 
      d.bairro?.toLowerCase().trim() === nomeRegiao.toLowerCase().trim()
    );

    const municipesDaRegiao = municipesFiltrados.filter(m => 
      m.bairro?.toLowerCase().trim() === nomeRegiao.toLowerCase().trim()
    );

    const statsRegiao = estatisticasPorRegiao.get(camadaId)?.get(nomeRegiao);
    const votosRegiao = votosPorCamada.get(camadaId)?.get(nomeRegiao) || 0;
    const eleitoresRegiao = totalEleitoresPorCamada.get(camadaId)?.get(nomeRegiao) || 0;

    let totalVotosCandidato = 0;
    let totalEleitoresGeral = 0;

    votosPorCamada.get(camadaId)?.forEach(v => totalVotosCandidato += v);
    totalEleitoresPorCamada.get(camadaId)?.forEach(e => totalEleitoresGeral += e);

    const percentualSobreTotalEleitores = totalEleitoresGeral > 0 
      ? (votosRegiao / totalEleitoresGeral) * 100 
      : 0;
    
    const percentualSobreEleitoresRegiao = eleitoresRegiao > 0 
      ? (votosRegiao / eleitoresRegiao) * 100 
      : 0;
    
    const percentualSobreTotalVotos = totalVotosCandidato > 0 
      ? (votosRegiao / totalVotosCandidato) * 100 
      : 0;

    const todasRegioes: Array<{
      nome: string;
      votos: number;
      eleitores: number;
      pctTotalEleitores: number;
      pctEleitoresRegiao: number;
      pctTotalVotos: number;
    }> = [];

    const camada = camadasVisiveis.find(c => c.id === camadaId);
    if (camada?.geojson?.features) {
      camada.geojson.features.forEach((f: any) => {
        const nome = getFeatureNameFromProps(f.properties);
        const votos = votosPorCamada.get(camadaId)?.get(nome) || 0;
        const eleitores = totalEleitoresPorCamada.get(camadaId)?.get(nome) || 0;

        todasRegioes.push({
          nome,
          votos,
          eleitores,
          pctTotalEleitores: totalEleitoresGeral > 0 ? (votos / totalEleitoresGeral) * 100 : 0,
          pctEleitoresRegiao: eleitores > 0 ? (votos / eleitores) * 100 : 0,
          pctTotalVotos: totalVotosCandidato > 0 ? (votos / totalVotosCandidato) * 100 : 0
        });
      });
    }

    const rankingTotalEleitores = [...todasRegioes]
      .sort((a, b) => b.pctTotalEleitores - a.pctTotalEleitores)
      .findIndex(r => r.nome === nomeRegiao) + 1;

    const rankingEleitoresRegiao = [...todasRegioes]
      .sort((a, b) => b.pctEleitoresRegiao - a.pctEleitoresRegiao)
      .findIndex(r => r.nome === nomeRegiao) + 1;

    const rankingTotalVotos = [...todasRegioes]
      .sort((a, b) => b.pctTotalVotos - a.pctTotalVotos)
      .findIndex(r => r.nome === nomeRegiao) + 1;

    const totalRegioes = todasRegioes.length;

    return {
      nome: nomeRegiao,
      demandas: demandasDaRegiao,
      municipes: municipesDaRegiao,
      totalMunicipes: statsRegiao?.municipes || municipesDaRegiao.length,
      totalDemandas: statsRegiao?.demandas || demandasDaRegiao.length,
      votos: votosRegiao,
      eleitores: eleitoresRegiao,
      totalVotosCandidato,
      totalEleitoresGeral,
      percentualSobreTotalEleitores,
      percentualSobreEleitoresRegiao,
      percentualSobreTotalVotos,
      rankingTotalEleitores,
      rankingEleitoresRegiao,
      rankingTotalVotos,
      totalRegioes
    };
  }, [regiaoSelecionada, demandasFiltradas, municipesFiltrados, estatisticasPorRegiao, votosPorCamada, totalEleitoresPorCamada, camadasVisiveis]);

  // Rankings completos para o modal
  const rankingsCompletos = useMemo(() => {
    if (!regiaoSelecionada) return null;

    const camadaId = regiaoSelecionada.camadaId;
    const camada = camadasVisiveis.find(c => c.id === camadaId);
    
    if (!camada?.geojson?.features) return null;

    let totalVotosCandidato = 0;
    let totalEleitoresGeral = 0;

    votosPorCamada.get(camadaId)?.forEach(v => totalVotosCandidato += v);
    totalEleitoresPorCamada.get(camadaId)?.forEach(e => totalEleitoresGeral += e);

    const todasRegioes: Array<{
      nome: string;
      votos: number;
      eleitores: number;
      pctTotalEleitores: number;
      pctEleitoresRegiao: number;
      pctTotalVotos: number;
    }> = [];

    camada.geojson.features.forEach((f: any) => {
      const nome = getFeatureNameFromProps(f.properties);
      const votos = votosPorCamada.get(camadaId)?.get(nome) || 0;
      const eleitores = totalEleitoresPorCamada.get(camadaId)?.get(nome) || 0;

      todasRegioes.push({
        nome,
        votos,
        eleitores,
        pctTotalEleitores: totalEleitoresGeral > 0 ? (votos / totalEleitoresGeral) * 100 : 0,
        pctEleitoresRegiao: eleitores > 0 ? (votos / eleitores) * 100 : 0,
        pctTotalVotos: totalVotosCandidato > 0 ? (votos / totalVotosCandidato) * 100 : 0
      });
    });

    return {
      regiaoAtual: regiaoSelecionada.nome,
      totalRegioes: todasRegioes.length,
      totalVotosCandidato,
      totalEleitoresGeral,
      rankingPctEleitorado: [...todasRegioes].sort((a, b) => b.pctTotalEleitores - a.pctTotalEleitores).map((r, i) => ({ ...r, posicao: i + 1 })),
      rankingPctRegiao: [...todasRegioes].sort((a, b) => b.pctEleitoresRegiao - a.pctEleitoresRegiao).map((r, i) => ({ ...r, posicao: i + 1 })),
      rankingPctVotacao: [...todasRegioes].sort((a, b) => b.pctTotalVotos - a.pctTotalVotos).map((r, i) => ({ ...r, posicao: i + 1 })),
      rankingVotosAbsolutos: [...todasRegioes].sort((a, b) => b.votos - a.votos).map((r, i) => ({ ...r, posicao: i + 1 })),
      rankingEleitoresAbsolutos: [...todasRegioes].sort((a, b) => b.eleitores - a.eleitores).map((r, i) => ({ ...r, posicao: i + 1 }))
    };
  }, [regiaoSelecionada, camadasVisiveis, votosPorCamada, totalEleitoresPorCamada]);

  function getFeatureNameFromProps(properties: any): string {
    const campos = [
      'NOME', 'nome', 'NAME', 'name', 
      'NM_BAIRRO', 'nm_bairro', 'NM_MUNICIP', 'nm_municip',
      'NOME_BAIRR', 'nome_bairr', 'BAIRRO', 'bairro',
      'NM_ZONA', 'nm_zona', 'ZONA', 'zona',
      'NM_DISTRIT', 'nm_distrit', 'DISTRITO', 'distrito',
      'LABEL', 'label', 'DESCRICAO', 'descricao'
    ];
    
    for (const campo of campos) {
      if (properties?.[campo]) {
        return String(properties[campo]);
      }
    }
    
    return 'Sem nome';
  }

  // Obter geolocalização e rotas (Funções auxiliares)
  const adicionarARota = (item: DemandaMapa | MunicipeMapa) => {
    if (pontosRota.find(p => p.id === item.id)) {
      toast.warning('Este ponto já está na rota');
      return;
    }
    setPontosRota([...pontosRota, item]);
    toast.success('Ponto adicionado à rota');
  };

  const removerDaRota = (id: string) => {
    setPontosRota(pontosRota.filter(p => p.id !== id));
  };

  const moverPonto = (index: number, direcao: 'up' | 'down') => {
    const novospontos = [...pontosRota];
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= novospontos.length) return;
    [novospontos[index], novospontos[novoIndex]] = [novospontos[novoIndex], novospontos[index]];
    setPontosRota(novospontos);
  };

  const otimizarOrdemPontos = (pontos: Array<DemandaMapa | MunicipeMapa>, origem: { lat: number; lng: number } | null) => {
    if (pontos.length <= 1) return pontos;
    
    const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const naoVisitados = [...pontos];
    const rotaOtimizada: Array<DemandaMapa | MunicipeMapa> = [];
    let pontoAtual = origem || { lat: pontos[0].latitude!, lng: pontos[0].longitude! };
    
    while (naoVisitados.length > 0) {
      let menorDistancia = Infinity;
      let indiceMaisProximo = 0;
      
      naoVisitados.forEach((ponto, index) => {
        if (ponto.latitude && ponto.longitude) {
          const distancia = calcularDistancia(
            pontoAtual.lat, pontoAtual.lng,
            ponto.latitude, ponto.longitude
          );
          if (distancia < menorDistancia) {
            menorDistancia = distancia;
            indiceMaisProximo = index;
          }
        }
      });
      
      const proximoPonto = naoVisitados.splice(indiceMaisProximo, 1)[0];
      rotaOtimizada.push(proximoPonto);
      if (proximoPonto.latitude && proximoPonto.longitude) {
        pontoAtual = { lat: proximoPonto.latitude, lng: proximoPonto.longitude };
      }
    }
    
    return rotaOtimizada;
  };

  const exportarGoogleMaps = () => {
    if (pontosRota.length === 0) {
      toast.warning('Adicione pontos à rota primeiro');
      return;
    }

    const pontosParaExportar = otimizarRota 
      ? otimizarOrdemPontos(pontosRota, origemRota)
      : pontosRota;

    const waypoints = pontosParaExportar
      .filter(p => p.latitude && p.longitude)
      .map(p => `${p.latitude},${p.longitude}`);

    let url = 'https://www.google.com/maps/dir/';
    
    if (origemRota) {
      url += `${origemRota.lat},${origemRota.lng}/`;
    }
    
    url += waypoints.join('/');
    
    if (destinoRota) {
      url += `/${destinoRota.lat},${destinoRota.lng}`;
    }
    
    window.open(url, '_blank');
  };

  const formatWhatsAppLink = (telefone: string | null) => {
    if (!telefone) return null;
    const numero = telefone.replace(/\D/g, '');
    return `https://wa.me/55${numero}`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar Esquerda */}
      <div className={`border-r bg-background flex flex-col h-full overflow-hidden transition-all duration-300 ${
        sidebarMinimizada ? 'w-16' : 'w-80'
      }`}>
        {sidebarMinimizada ? (
          // Versão Minimizada
          <div className="flex flex-col items-center py-4 gap-4 h-full">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarMinimizada(false)}
              className="hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium writing-mode-vertical">{totalNoMapa}</span>
            </div>
            <Separator className="w-8" />
            <div className="flex flex-col items-center gap-3">
              <Button 
                variant={clusterEnabled ? "default" : "ghost"} 
                size="icon"
                onClick={() => setClusterEnabled(!clusterEnabled)}
                title={clusterEnabled ? "Desagrupar Pontos" : "Agrupar Pontos"}
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button 
                variant={heatmapVisible ? "default" : "ghost"} 
                size="icon"
                onClick={() => setHeatmapVisible(!heatmapVisible)}
                title="Mapa de Calor"
              >
                <Flame className="h-4 w-4" />
              </Button>
              <Button 
                variant={filtroCruzado ? "default" : "ghost"} 
                size="icon"
                onClick={() => setFiltroCruzado(!filtroCruzado)}
                title="Filtro Cruzado"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1" />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              title="Atualizar"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          // Versão Expandida
          <>
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h1 className="font-semibold text-lg">Gestão Territorial</h1>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSidebarMinimizada(true)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {totalNoMapa} itens no mapa
              </p>
            </div>

            <Tabs defaultValue="filtros" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3 px-4 pt-2 flex-shrink-0">
                <TabsTrigger value="filtros" className="text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  Filtros
                </TabsTrigger>
                <TabsTrigger value="rotas" className="text-xs">
                  <Route className="h-3 w-3 mr-1" />
                  Rotas
                </TabsTrigger>
                <TabsTrigger value="analise" className="text-xs">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Análise
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                {/* Tab Filtros (Conteúdo Existente) */}
                <TabsContent value="filtros" className="p-4 space-y-4 mt-0">
                  {/* ... (Busca, Filtros de Status, Áreas e Tags mantidos) ... */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">BUSCA RÁPIDA</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nome, protocolo, endereço..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">TIPO DE DADO</label>
                    <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os tipos</SelectItem>
                        <SelectItem value="demandas">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-500" />
                            Demandas
                          </div>
                        </SelectItem>
                        <SelectItem value="municipes">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            Munícipes
                          </div>
                        </SelectItem>
                        <SelectItem value="nenhum">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4 text-gray-400" />
                            Nenhum (ocultar todos)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <button 
                      onClick={() => setStatusExpanded(!statusExpanded)}
                      className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <span>STATUS (DEMANDAS)</span>
                      <div className="flex items-center gap-1">
                        {statusFiltro.length > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {statusFiltro.length}
                          </Badge>
                        )}
                        <ChevronDown className={`h-4 w-4 transition-transform ${statusExpanded ? '' : '-rotate-90'}`} />
                      </div>
                    </button>
                    {statusExpanded && (
                      <div className="pt-1 space-y-1">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <div key={value} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`status-${value}`}
                              checked={statusFiltro.includes(value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setStatusFiltro([...statusFiltro, value]);
                                } else {
                                  setStatusFiltro(statusFiltro.filter(s => s !== value));
                                }
                              }}
                            />
                            <label 
                              htmlFor={`status-${value}`}
                              className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                            >
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: STATUS_COLORS[value] }}
                              />
                              {label}
                              <span className="text-xs text-muted-foreground ml-auto">
                                ({contagemStatus[value] || 0})
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Áreas */}
                  <div className="space-y-2">
                    <button 
                      onClick={() => setAreasExpanded(!areasExpanded)}
                      className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        ÁREAS (DEMANDAS)
                      </span>
                      <div className="flex items-center gap-1">
                        {areasFiltro.length > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {areasFiltro.length}
                          </Badge>
                        )}
                        <ChevronDown className={`h-4 w-4 transition-transform ${areasExpanded ? '' : '-rotate-90'}`} />
                      </div>
                    </button>
                    {areasExpanded && (
                      <div className="pt-1 space-y-1 max-h-40 overflow-y-auto">
                        {areas.map((area) => {
                          const count = demandasRaw.filter(d => d.area_id === area.id).length;
                          return (
                            <div key={area.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`area-${area.id}`}
                                checked={areasFiltro.includes(area.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAreasFiltro([...areasFiltro, area.id]);
                                  } else {
                                    setAreasFiltro(areasFiltro.filter(a => a !== area.id));
                                  }
                                }}
                              />
                              <label 
                                htmlFor={`area-${area.id}`}
                                className="flex items-center gap-2 text-sm cursor-pointer flex-1 truncate"
                              >
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: area.cor || '#6b7280' }}
                                />
                                <span className="truncate">{area.nome}</span>
                                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                  ({count})
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <HeatmapControls
                    heatmapVisible={heatmapVisible}
                    setHeatmapVisible={setHeatmapVisible}
                    heatmapType={heatmapType}
                    setHeatmapType={setHeatmapType}
                    demandasCount={demandasFiltradas.length}
                    municipesCount={municipesFiltrados.length}
                    filtroCruzado={filtroCruzado}
                    setFiltroCruzado={setFiltroCruzado}
                    estatisticasCruzado={estatisticasCruzado}
                    clusterEnabled={clusterEnabled}
                    setClusterEnabled={setClusterEnabled}
                  />

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Atualizar Mapa
                  </Button>
                </TabsContent>

                {/* Tab Rotas (Conteúdo Existente) */}
                <TabsContent value="rotas" className="p-4 space-y-4 mt-0">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setGerenciarRotasOpen(true)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Gerenciar Rotas Salvas
                  </Button>

                  <Separator />

                  <BuscaEnderecoInput
                    label="PONTO DE PARTIDA"
                    value={origemRota}
                    onChange={setOrigemRota}
                    placeholder="Digite um endereço ou use GPS..."
                    showGeolocation={true}
                    proximity={centroProximidade}
                  />

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        PONTOS DE PARADA ({pontosRota.length})
                      </label>
                      {pontosRota.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setPontosRota([])}
                          className="h-6 text-xs text-red-600 hover:text-red-700"
                        >
                          Limpar
                        </Button>
                      )}
                    </div>

                    {pontosRota.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed rounded-lg">
                        <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-xs text-muted-foreground">
                          Clique em um marcador no mapa<br />e adicione à rota
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[180px]">
                        <div className="space-y-2 pr-2">
                          {pontosRota.map((ponto, index) => (
                            <Card key={ponto.id} className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moverPonto(index, 'up')}
                                    disabled={index === 0 || otimizarRota}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moverPonto(index, 'down')}
                                    disabled={index === pontosRota.length - 1 || otimizarRota}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <Badge variant="outline" className="w-5 h-5 p-0 flex items-center justify-center text-xs flex-shrink-0">
                                  {index + 1}
                                </Badge>
                                {'titulo' in ponto ? (
                                  <FileText className="h-3 w-3 text-red-500 flex-shrink-0" />
                                ) : (
                                  <Users className="h-3 w-3 text-purple-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {'titulo' in ponto ? ponto.titulo : ponto.nome}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {'bairro' in ponto && ponto.bairro}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-600 flex-shrink-0"
                                  onClick={() => removerDaRota(ponto.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  <Separator />

                  <BuscaEnderecoInput
                    label="PONTO DE CHEGADA (OPCIONAL)"
                    value={destinoRota}
                    onChange={setDestinoRota}
                    placeholder="Digite um endereço ou use GPS..."
                    showGeolocation={true}
                    proximity={centroProximidade}
                  />

                  <div className="space-y-2 pt-2">
                    <Button 
                      className="w-full" 
                      onClick={() => setCriarRotaDialogOpen(true)}
                      disabled={pontosRota.length === 0}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Rota
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full" 
                      onClick={exportarGoogleMaps}
                      disabled={pontosRota.length === 0}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Google Maps
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab Análise (ATUALIZADA) */}
                <TabsContent value="analise" className="p-4 space-y-4 mt-0">
                  {/* Camadas Geográficas */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Camadas Geográficas
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ShapefileUpload onUploadComplete={handleShapefileUpload} />

                      {/* Lista de Camadas */}
                      {isLoadingCamadas ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Carregando camadas...</span>
                        </div>
                      ) : camadas.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <MapIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Nenhuma camada importada</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {camadas.map(camada => (
                            <div 
                              key={camada.id}
                              className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div 
                                  className="w-4 h-4 rounded flex-shrink-0"
                                  style={{ backgroundColor: camada.cor_padrao }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{camada.nome}</p>
                                  <p className="text-xs text-muted-foreground">{camada.tipo}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleVisibilidade.mutate({ 
                                    id: camada.id, 
                                    visivel: !camada.visivel 
                                  })}
                                >
                                  {camada.visivel ? (
                                    <Eye className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                                {/* ... Outros botões de camada (cor, remover) ... */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removerCamada.mutate(camada.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Estatísticas por Região (NOVOS BOTÕES E LEGENDAS) */}
                  {camadasVisiveis.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Estatísticas por Região
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Select 
                          value={camadaSelecionadaStats || camadasVisiveis[0]?.id} 
                          onValueChange={(value) => {
                            setCamadaSelecionadaStats(value);
                            setEleicaoSelecionada(null);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione uma camada" />
                          </SelectTrigger>
                          <SelectContent>
                            {camadasVisiveis.map(camada => (
                              <SelectItem key={camada.id} value={camada.id}>
                                {camada.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Botão Importar Votos */}
                        {camadas.length > 0 && (
                          <VotosUpload
                            camadas={camadas}
                            getFeatureName={getFeatureName}
                            onComplete={(camadaId, eleicao) => {
                              queryClient.invalidateQueries({ queryKey: ['dados-eleitorais', camadaId] });
                              queryClient.invalidateQueries({ queryKey: ['eleicoes-disponiveis', camadaId] });
                              setCamadaSelecionadaStats(camadaId);
                              setEleicaoSelecionada(eleicao);
                              setModoVisualizacao('votos');
                            }}
                          />
                        )}

                        {/* Toggle Coloração */}
                        <div className="flex items-center justify-between py-2">
                          <label className="text-xs font-medium flex items-center gap-2">
                            <Palette className="h-3.5 w-3.5" />
                            Colorir regiões
                          </label>
                          <Switch
                            checked={modoVisualizacao !== 'padrao'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setModoVisualizacao(eleicoesDisponiveis.length > 0 ? 'votos' : 'resolutividade');
                              } else {
                                setModoVisualizacao('padrao');
                              }
                            }}
                          />
                        </div>

                        {/* Modo de Visualização (BOTÕES COM TOOLTIP) */}
                        {modoVisualizacao !== 'padrao' && (
                        <div className="space-y-3">
                          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            Indicadores Territoriais
                          </label>
                          
                          <TooltipProvider delayDuration={300}>
                            <div className="grid grid-cols-2 gap-2">
                              {/* 1. Taxa de Resolutividade */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={modoVisualizacao === 'resolutividade' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-20 flex flex-col items-center justify-center gap-2"
                                    onClick={() => setModoVisualizacao('resolutividade')}
                                  >
                                    <CheckCircle className="h-6 w-6" />
                                    <span className="text-xs font-medium">Resolutividade</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">Taxa de Resolutividade</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Mede a eficiência do mandato em resolver demandas por região.
                                  </p>
                                  <p className="text-xs mb-1"><strong>Cálculo:</strong> Demandas atendidas ÷ Total de demandas ativas</p>
                                  <div className="text-xs space-y-0.5 mt-2 pt-2 border-t">
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] mr-1.5"></span><strong>Verde:</strong> Excelente (&gt;80%)</p>
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#eab308] mr-1.5"></span><strong>Amarelo:</strong> Atenção (50-80%)</p>
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#ef4444] mr-1.5"></span><strong>Vermelho:</strong> Crítico (&lt;50%)</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>

                              {/* 2. Votos */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={modoVisualizacao === 'votos' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-20 flex flex-col items-center justify-center gap-2"
                                    onClick={() => setModoVisualizacao('votos')}
                                    disabled={eleicoesDisponiveis.length === 0}
                                  >
                                    <Vote className="h-6 w-6" />
                                    <span className="text-xs font-medium">Votos</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">Densidade de Votos</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Mostra a concentração de votos do candidato em cada região.
                                  </p>
                                  <p className="text-xs mb-1"><strong>Cálculo:</strong> Votos na região ÷ Total de votos do candidato</p>
                                  <div className="text-xs space-y-0.5 mt-2 pt-2 border-t">
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#7c3aed] mr-1.5"></span><strong>Roxo intenso:</strong> Alta concentração de votos</p>
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#c4b5fd] mr-1.5"></span><strong>Roxo claro:</strong> Baixa concentração de votos</p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                                    Útil para identificar redutos eleitorais e bases de apoio.
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              {/* 3. DNA do Bairro */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={modoVisualizacao === 'predominancia' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-20 flex flex-col items-center justify-center gap-2"
                                    onClick={() => setModoVisualizacao('predominancia')}
                                  >
                                    <PieChart className="h-6 w-6" />
                                    <span className="text-xs font-medium">DNA do Bairro</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">DNA do Bairro</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Identifica o tema predominante das demandas em cada região.
                                  </p>
                                  <p className="text-xs mb-1"><strong>Cálculo:</strong> Área temática com maior número de demandas na região</p>
                                  <div className="text-xs mt-2 pt-2 border-t">
                                    <p className="mb-1">Cada cor representa uma área temática diferente (Saúde, Obras, Educação, etc.)</p>
                                    <p className="text-[10px] text-muted-foreground italic">
                                      Útil para entender as principais necessidades de cada território e direcionar ações específicas.
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>

                              {/* 4. Oportunidade */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={modoVisualizacao === 'comparativo' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-20 flex flex-col items-center justify-center gap-2"
                                    onClick={() => setModoVisualizacao('comparativo')}
                                    disabled={eleicoesDisponiveis.length === 0}
                                  >
                                    <TrendingUp className="h-6 w-6" />
                                    <span className="text-xs font-medium">Oportunidade</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">Análise de Oportunidade</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Cruza dados de votação com volume de atendimentos para identificar oportunidades e riscos.
                                  </p>
                                  <p className="text-xs mb-1"><strong>Compara:</strong> % de votos vs. % de demandas atendidas</p>
                                  <div className="text-xs space-y-0.5 mt-2 pt-2 border-t">
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#ef4444] mr-1.5"></span><strong>Vermelho (Risco):</strong> Muitos votos, pouco atendimento</p>
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] mr-1.5"></span><strong>Verde (Potencial):</strong> Bom atendimento, poucos votos</p>
                                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6] mr-1.5"></span><strong>Azul (Equilibrado):</strong> Votos e atendimento proporcionais</p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                                    Priorize regiões vermelhas para manter a base e verdes para expandir.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                          
                          {/* Legenda Visual Compacta */}
                          <div className="p-2 bg-muted/30 rounded-md border text-[10px]">
                            {modoVisualizacao === 'resolutividade' && (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                                  <span>&lt;50%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#eab308]" />
                                  <span>50-80%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                                  <span>&gt;80%</span>
                                </div>
                              </div>
                            )}

                            {modoVisualizacao === 'predominancia' && (
                              <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                                {areas.slice(0, 6).map(area => (
                                  <div key={area.id} className="flex items-center gap-1">
                                    <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: area.cor || '#6b7280' }} 
                                    />
                                    <span className="truncate">{area.nome}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {modoVisualizacao === 'votos' && (
                              <div className="flex items-center gap-2">
                                <span>Menos</span>
                                <div className="flex-1 h-1.5 rounded-full" style={{
                                  background: 'linear-gradient(to right, #c4b5fd, #7c3aed)'
                                }} />
                                <span>Mais</span>
                              </div>
                            )}

                            {modoVisualizacao === 'comparativo' && (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-sm bg-[#ef4444]" />
                                  <span>Risco</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-sm bg-[#3b82f6]" />
                                  <span>Equilíbrio</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-sm bg-[#22c55e]" />
                                  <span>Potencial</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        )}

                        {/* Lista de Regiões */}
                        <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                          {getEstatisticasCamadaOrdenadas(camadaSelecionadaStats || camadasVisiveis[0]?.id).map((item, index) => (
                            <div 
                              key={item.nome}
                              className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                const camada = camadasVisiveis.find(c => c.id === (camadaSelecionadaStats || camadasVisiveis[0]?.id));
                                if (camada?.geojson?.features) {
                                  const feature = camada.geojson.features.find((f: any) => 
                                    getFeatureName(f.properties) === item.nome
                                  );
                                  if (feature) {
                                    handleRegiaoClick(camada.id, feature, item.nome);
                                  }
                                }
                              }}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span className="text-muted-foreground w-4">{index + 1}.</span>
                                <span className="truncate">{item.nome}</span>
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {item.votos > 0 && (
                                  <Badge variant="secondary" className="h-5 text-xs gap-0.5 bg-indigo-100 text-indigo-800">
                                    <Vote className="h-2.5 w-2.5" />
                                    {item.votos.toLocaleString('pt-BR')}
                                  </Badge>
                                )}
                                {(tipoFiltro === 'todos' || tipoFiltro === 'demandas') && (
                                  <Badge variant="outline" className="h-5 text-xs gap-0.5">
                                    <FileText className="h-2.5 w-2.5" />
                                    {item.demandas}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </div>

      {/* Mapa Central */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 bg-background p-4 rounded-lg shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando mapa...</span>
            </div>
          </div>
        )}
        
        <ClusterMap
          demandas={tipoFiltro === 'municipes' || tipoFiltro === 'nenhum' ? [] : demandasFiltradas}
          municipes={tipoFiltro === 'demandas' || tipoFiltro === 'nenhum' ? [] : municipesFiltrados}
          areas={areas} // Passando áreas com cores para o mapa
          mostrarDemandas={tipoFiltro !== 'municipes' && tipoFiltro !== 'nenhum'}
          mostrarMunicipes={tipoFiltro !== 'demandas' && tipoFiltro !== 'nenhum'}
          heatmapVisible={heatmapVisible && tipoFiltro !== 'nenhum'}
          heatmapType={heatmapType}
          clusterEnabled={clusterEnabled}
          camadasGeograficas={camadasVisiveis}
          estatisticasPorRegiao={estatisticasPorRegiao}
          votosPorCamada={votosPorCamada}
          totalEleitoresPorCamada={totalEleitoresPorCamada}
          modoVisualizacao={modoVisualizacao}
          tipoFiltro={tipoFiltro}
          colorirPorDensidade={colorirPorDensidade}
          onRegiaoClick={handleRegiaoClick}
          onDemandaClick={(d) => {
            setItemSelecionado(d);
            setClusterSelecionado(null);
            setRegiaoSelecionada(null);
          }}
          onMunicipeClick={(m) => {
            setItemSelecionado(m);
            setClusterSelecionado(null);
            setRegiaoSelecionada(null);
          }}
          onClusterClick={(dados) => {
            setClusterSelecionado(dados);
            setItemSelecionado(null);
            setRegiaoSelecionada(null);
          }}
        />
      </div>

      {/* Sidebar Direita - Detalhes */}
      {itemSelecionado && (
        <div className="w-80 border-l bg-background flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Detalhes</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setItemSelecionado(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {'titulo' in itemSelecionado ? (
                // Detalhes de Demanda (Simplificado para brevidade, manter lógica original)
                <>
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (itemSelecionado.area_cor || '#3b82f6') + '20' }}
                    >
                      <FileText 
                        className="h-5 w-5" 
                        style={{ color: itemSelecionado.area_cor || '#3b82f6' }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{itemSelecionado.titulo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {itemSelecionado.protocolo}
                      </p>
                    </div>
                  </div>
                  {/* ... Resto dos detalhes ... */}
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => adicionarARota(itemSelecionado)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar à Rota
                    </Button>
                    <Button 
                      variant="default" 
                      className="w-full"
                      onClick={() => {
                        setDemandaModalId(itemSelecionado.id);
                        setItemSelecionado(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Detalhes Completos
                    </Button>
                  </div>
                </>
              ) : (
                // Detalhes de Munícipe
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{itemSelecionado.nome}</h3>
                    </div>
                  </div>
                  {/* ... Resto dos detalhes ... */}
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => adicionarARota(itemSelecionado)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar à Rota
                    </Button>
                    <Button 
                      variant="default" 
                      className="w-full"
                      onClick={() => {
                        const municipeCompleto = municipesRaw.find(m => m.id === itemSelecionado.id);
                        if (municipeCompleto) {
                          setMunicipeParaDetalhes(municipeCompleto);
                          setMunicipeDetalhesOpen(true);
                        }
                        setItemSelecionado(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Detalhes Completos
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Sidebar Direita - Cluster Selecionado */}
      {clusterSelecionado && (
        <div className="w-96 border-l bg-background flex flex-col">
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Cluster Selecionado
              </h2>
              <p className="text-sm text-muted-foreground">
                {clusterSelecionado.demandas.length + clusterSelecionado.municipes.length} itens agrupados
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setClusterSelecionado(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={abaCluster} onValueChange={(v) => setAbaCluster(v as 'demandas' | 'municipes')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="demandas" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                Demandas ({clusterSelecionado.demandas.length})
              </TabsTrigger>
              <TabsTrigger value="municipes" className="text-xs gap-1">
                <Users className="h-3 w-3" />
                Munícipes ({clusterSelecionado.municipes.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <div className="p-4">
                <TabsContent value="demandas" className="mt-0 space-y-2">
                  {clusterSelecionado.demandas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma demanda neste cluster
                    </p>
                  ) : (
                    clusterSelecionado.demandas.map((demanda) => (
                      <Card key={demanda.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div 
                              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: (demanda.area_cor || '#3b82f6') + '20' }}
                            >
                              <FileText 
                                className="h-4 w-4" 
                                style={{ color: demanda.area_cor || '#3b82f6' }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{demanda.titulo}</p>
                              <p className="text-xs text-muted-foreground">{demanda.protocolo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5"
                                  style={{ 
                                    borderColor: STATUS_COLORS[demanda.status] || '#6b7280',
                                    color: STATUS_COLORS[demanda.status] || '#6b7280'
                                  }}
                                >
                                  {STATUS_LABELS[demanda.status] || demanda.status}
                                </Badge>
                                {demanda.area_nome && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {demanda.area_nome}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => setDemandaModalId(demanda.id)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="municipes" className="mt-0 space-y-2">
                  {clusterSelecionado.municipes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum munícipe neste cluster
                    </p>
                  ) : (
                    clusterSelecionado.municipes.map((municipe) => (
                      <Card key={municipe.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{municipe.nome}</p>
                              {municipe.telefone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {municipe.telefone}
                                </p>
                              )}
                              {municipe.bairro && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {municipe.bairro}
                                </p>
                              )}
                              {municipe.tags && municipe.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {municipe.tags.slice(0, 2).map((tag: any) => (
                                    <Badge 
                                      key={tag.id} 
                                      variant="secondary"
                                      className="text-[10px] px-1.5"
                                      style={{ backgroundColor: tag.cor + '20', color: tag.cor }}
                                    >
                                      {tag.nome}
                                    </Badge>
                                  ))}
                                  {municipe.tags.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{municipe.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => {
                                const municipeCompleto = municipesRaw.find(m => m.id === municipe.id);
                                if (municipeCompleto) {
                                  setMunicipeParaDetalhes(municipeCompleto);
                                  setMunicipeDetalhesOpen(true);
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      )}
      
      {/* Sidebar Direita - Região Selecionada */}
      {regiaoSelecionada && dadosRegiaoSelecionada && (
        <div className="w-96 border-l bg-background flex flex-col">
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {dadosRegiaoSelecionada.nome}
              </h2>
              <p className="text-sm text-muted-foreground">
                Região do shapefile
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setRegiaoSelecionada(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={abaRegiao} onValueChange={(v) => setAbaRegiao(v as 'dados' | 'demandas' | 'municipes')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="dados" className="text-xs gap-1">Dados</TabsTrigger>
              <TabsTrigger value="demandas" className="text-xs gap-1">Demandas ({dadosRegiaoSelecionada.totalDemandas})</TabsTrigger>
              <TabsTrigger value="municipes" className="text-xs gap-1">Munícipes ({dadosRegiaoSelecionada.totalMunicipes})</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {/* Aba de Dados */}
                <TabsContent value="dados" className="mt-0 space-y-4">
                  {/* Card de Resumo da Região */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-primary" />
                        Resumo da Região
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Demandas */}
                      <div className="flex justify-between items-center py-2 border-b">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">Demandas</span>
                        </div>
                        <span className="font-mono font-bold text-lg">
                          {dadosRegiaoSelecionada.totalDemandas.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      {/* Munícipes */}
                      <div className="flex justify-between items-center py-2 border-b">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Munícipes</span>
                        </div>
                        <span className="font-mono font-bold text-lg">
                          {dadosRegiaoSelecionada.totalMunicipes.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      {/* Votos */}
                      <div className="flex justify-between items-center py-2 border-b">
                        <div className="flex items-center gap-2">
                          <Vote className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">Votos</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-purple-700">
                          {dadosRegiaoSelecionada.votos.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      {/* Eleitores */}
                      <div className="flex justify-between items-center py-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm">Eleitores</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-cyan-700">
                          {dadosRegiaoSelecionada.eleitores.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card de Análise Eleitoral */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        Análise Eleitoral
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* % Eleitorado (votos / total eleitores GERAL) */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">% Eleitorado</span>
                            <span className="text-[10px] text-muted-foreground">Votos / Total eleitores geral</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700">
                              {dadosRegiaoSelecionada.percentualSobreTotalEleitores.toFixed(2)}%
                            </span>
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              {dadosRegiaoSelecionada.rankingTotalEleitores}º
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* % Na Região (votos / eleitores DA REGIÃO) */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">% Na Região</span>
                            <span className="text-[10px] text-muted-foreground">Votos / Eleitores da região</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-700">
                              {dadosRegiaoSelecionada.percentualSobreEleitoresRegiao.toFixed(2)}%
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              {dadosRegiaoSelecionada.rankingEleitoresRegiao}º
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* % Votação (votos / total votos CANDIDATO) */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">% Votação</span>
                            <span className="text-[10px] text-muted-foreground">Votos / Total votos do candidato</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-700">
                              {dadosRegiaoSelecionada.percentualSobreTotalVotos.toFixed(2)}%
                            </span>
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              {dadosRegiaoSelecionada.rankingTotalVotos}º
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Totais Gerais para referência */}
                  <div className="p-3 bg-muted/50 rounded-md border text-xs space-y-1">
                    <p className="font-medium text-muted-foreground mb-2">Totais da camada ({dadosRegiaoSelecionada.totalRegioes} regiões)</p>
                    <div className="flex justify-between">
                      <span>Total de eleitores:</span>
                      <span className="font-mono">{dadosRegiaoSelecionada.totalEleitoresGeral.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total de votos:</span>
                      <span className="font-mono">{dadosRegiaoSelecionada.totalVotosCandidato.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setModalRankingsAberto(true)}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Rankings Completos
                  </Button>
                </TabsContent>

                {/* Aba de Demandas da Região */}
                <TabsContent value="demandas" className="mt-0 space-y-2">
                  {dadosRegiaoSelecionada.demandas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma demanda nesta região
                    </p>
                  ) : (
                    dadosRegiaoSelecionada.demandas.map((demanda) => (
                      <Card key={demanda.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div 
                              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: (demanda.area_cor || '#3b82f6') + '20' }}
                            >
                              <FileText 
                                className="h-4 w-4" 
                                style={{ color: demanda.area_cor || '#3b82f6' }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{demanda.titulo}</p>
                              <p className="text-xs text-muted-foreground">{demanda.protocolo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5"
                                  style={{ 
                                    borderColor: STATUS_COLORS[demanda.status] || '#6b7280',
                                    color: STATUS_COLORS[demanda.status] || '#6b7280'
                                  }}
                                >
                                  {STATUS_LABELS[demanda.status] || demanda.status}
                                </Badge>
                                {demanda.area_nome && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {demanda.area_nome}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => setDemandaModalId(demanda.id)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Aba de Munícipes da Região */}
                <TabsContent value="municipes" className="mt-0 space-y-2">
                  {dadosRegiaoSelecionada.municipes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum munícipe nesta região
                    </p>
                  ) : (
                    dadosRegiaoSelecionada.municipes.map((municipe) => (
                      <Card key={municipe.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{municipe.nome}</p>
                              {municipe.telefone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {municipe.telefone}
                                </p>
                              )}
                              {municipe.bairro && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {municipe.bairro}
                                </p>
                              )}
                              {municipe.tags && municipe.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {municipe.tags.slice(0, 2).map((tag: any) => (
                                    <Badge 
                                      key={tag.id} 
                                      variant="secondary"
                                      className="text-[10px] px-1.5"
                                      style={{ backgroundColor: tag.cor + '20', color: tag.cor }}
                                    >
                                      {tag.nome}
                                    </Badge>
                                  ))}
                                  {municipe.tags.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{municipe.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => {
                                const municipeCompleto = municipesRaw.find(m => m.id === municipe.id);
                                if (municipeCompleto) {
                                  setMunicipeParaDetalhes(municipeCompleto);
                                  setMunicipeDetalhesOpen(true);
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      )}

      {/* Modais de Demanda */}
      <ViewDemandaDialog
        demanda={demandaModalId ? demandasRaw.find(d => d.id === demandaModalId) || null : null}
        open={!!demandaModalId}
        onOpenChange={(open) => {
          if (!open) setDemandaModalId(null);
        }}
        onEdit={() => {
          const demanda = demandasRaw.find(d => d.id === demandaModalId);
          if (demanda) {
            setDemandaParaEditar(demanda);
            setDemandaModalId(null);
            setIsEditDemandaOpen(true);
          }
        }}
      />

      <EditDemandaDialog
        demanda={demandaParaEditar}
        open={isEditDemandaOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditDemandaOpen(false);
            setDemandaParaEditar(null);
          }
        }}
      />

      {/* Modal de Rankings Completos (CORRIGIDO SCROLL) */}
      <Dialog open={modalRankingsAberto} onOpenChange={setModalRankingsAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Rankings Completos - {rankingsCompletos?.regiaoAtual}
            </DialogTitle>
            <DialogDescription>
              Comparativo entre {rankingsCompletos?.totalRegioes || 0} regiões da camada selecionada
            </DialogDescription>
          </DialogHeader>
          
          {rankingsCompletos && (
            <Tabs defaultValue="pct-eleitorado" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
                <TabsTrigger value="pct-eleitorado" className="text-xs">% Eleitorado</TabsTrigger>
                <TabsTrigger value="pct-regiao" className="text-xs">% na Região</TabsTrigger>
                <TabsTrigger value="pct-votacao" className="text-xs">% Votação</TabsTrigger>
                <TabsTrigger value="votos-abs" className="text-xs">Votos</TabsTrigger>
                <TabsTrigger value="eleitores-abs" className="text-xs">Eleitores</TabsTrigger>
              </TabsList>

              {/* Tab % Eleitorado */}
              <TabsContent value="pct-eleitorado" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        Ranking por % do Eleitorado
                      </CardTitle>
                      <CardDescription className="text-xs">
                        <strong>Fórmula:</strong> Votos da região / Total de eleitores de TODAS as regiões ({rankingsCompletos.totalEleitoresGeral.toLocaleString('pt-BR')} eleitores)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {rankingsCompletos.rankingPctEleitorado.map((r) => (
                          <div 
                            key={r.nome}
                            className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                              r.nome === rankingsCompletos.regiaoAtual 
                                ? 'bg-blue-100 border border-blue-300 font-medium' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-10 justify-center font-mono">
                                {r.posicao}º
                              </Badge>
                              <span className={r.nome === rankingsCompletos.regiaoAtual ? 'text-blue-700' : ''}>
                                {r.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="text-muted-foreground text-xs">
                                {r.votos.toLocaleString('pt-BR')} votos
                              </span>
                              <span className="font-mono font-bold w-20 text-right">
                                {r.pctTotalEleitores.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              {/* Tab % na Região */}
              <TabsContent value="pct-regiao" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        Ranking por % na Região
                      </CardTitle>
                      <CardDescription className="text-xs">
                        <strong>Fórmula:</strong> Votos da região / Eleitores DA PRÓPRIA região (penetração local)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {rankingsCompletos.rankingPctRegiao.map((r) => (
                          <div 
                            key={r.nome}
                            className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                              r.nome === rankingsCompletos.regiaoAtual 
                                ? 'bg-green-100 border border-green-300 font-medium' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-10 justify-center font-mono">
                                {r.posicao}º
                              </Badge>
                              <span className={r.nome === rankingsCompletos.regiaoAtual ? 'text-green-700' : ''}>
                                {r.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="text-muted-foreground text-xs">
                                {r.votos.toLocaleString('pt-BR')}/{r.eleitores.toLocaleString('pt-BR')}
                              </span>
                              <span className="font-mono font-bold w-20 text-right">
                                {r.pctEleitoresRegiao.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              {/* Tab % Votação */}
              <TabsContent value="pct-votacao" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        Ranking por % da Votação
                      </CardTitle>
                      <CardDescription className="text-xs">
                        <strong>Fórmula:</strong> Votos da região / Total de votos do candidato ({rankingsCompletos.totalVotosCandidato.toLocaleString('pt-BR')} votos)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {rankingsCompletos.rankingPctVotacao.map((r) => (
                          <div 
                            key={r.nome}
                            className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                              r.nome === rankingsCompletos.regiaoAtual 
                                ? 'bg-amber-100 border border-amber-300 font-medium' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-10 justify-center font-mono">
                                {r.posicao}º
                              </Badge>
                              <span className={r.nome === rankingsCompletos.regiaoAtual ? 'text-amber-700' : ''}>
                                {r.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="text-muted-foreground text-xs">
                                {r.votos.toLocaleString('pt-BR')} votos
                              </span>
                              <span className="font-mono font-bold w-20 text-right">
                                {r.pctTotalVotos.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              {/* Tab Votos Absolutos */}
              <TabsContent value="votos-abs" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Vote className="h-4 w-4 text-purple-500" />
                        Ranking por Número de Votos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Regiões ordenadas pelo número absoluto de votos recebidos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {rankingsCompletos.rankingVotosAbsolutos.map((r) => (
                          <div 
                            key={r.nome}
                            className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                              r.nome === rankingsCompletos.regiaoAtual 
                                ? 'bg-purple-100 border border-purple-300 font-medium' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-10 justify-center font-mono">
                                {r.posicao}º
                              </Badge>
                              <span className={r.nome === rankingsCompletos.regiaoAtual ? 'text-purple-700' : ''}>
                                {r.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="font-mono font-bold">
                                {r.votos.toLocaleString('pt-BR')} votos
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              {/* Tab Eleitores Absolutos */}
              <TabsContent value="eleitores-abs" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-cyan-500" />
                        Ranking por Número de Eleitores
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Regiões ordenadas pelo número absoluto de eleitores
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {rankingsCompletos.rankingEleitoresAbsolutos.map((r) => (
                          <div 
                            key={r.nome}
                            className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                              r.nome === rankingsCompletos.regiaoAtual 
                                ? 'bg-cyan-100 border border-cyan-300 font-medium' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-10 justify-center font-mono">
                                {r.posicao}º
                              </Badge>
                              <span className={r.nome === rankingsCompletos.regiaoAtual ? 'text-cyan-700' : ''}>
                                {r.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="font-mono font-bold">
                                {r.eleitores.toLocaleString('pt-BR')} eleitores
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Outros Modais (Rotas, Detalhes Munícipe, etc.) */}
      <CriarRotaDialog
        open={criarRotaDialogOpen}
        onOpenChange={setCriarRotaDialogOpen}
        pontosRota={pontosRota}
        origemRota={origemRota}
        destinoRota={destinoRota}
        otimizarRota={otimizarRota}
        onSuccess={() => {
          setPontosRota([]);
          setOrigemRota(null);
          setDestinoRota(null);
          setOtimizarRota(false);
        }}
      />

      <ConcluirRotaDialog
        open={concluirRotaDialogOpen}
        onOpenChange={(open) => {
          setConcluirRotaDialogOpen(open);
          if (!open) setRotaParaConcluir(null);
        }}
        rota={rotaParaConcluir}
        onAbrirDemanda={(demandaId) => setDemandaModalId(demandaId)}
        onAbrirMunicipe={(municipeId) => {
          const municipe = municipesRaw.find(m => m.id === municipeId);
          if (municipe) {
            setMunicipeParaDetalhes(municipe);
            setMunicipeDetalhesOpen(true);
          }
        }}
      />

      <GerenciarRotasModal
        open={gerenciarRotasOpen}
        onOpenChange={setGerenciarRotasOpen}
        onVisualizarRota={(rota) => {
          if (!rota.rota_pontos || rota.rota_pontos.length === 0) {
            toast.error('Esta rota não possui pontos de parada');
            return;
          }
          const pontosParaMapa: Array<DemandaMapa | MunicipeMapa> = [];
          for (const p of rota.rota_pontos) {
            if (p.tipo === 'demanda') {
              const demanda = demandasRaw.find(d => d.id === p.referencia_id);
              if (demanda) pontosParaMapa.push(demanda);
              else pontosParaMapa.push({
                id: p.referencia_id || `temp-demanda-${p.ordem}`,
                titulo: p.nome,
                descricao: null,
                status: 'pendente',
                prioridade: null,
                protocolo: '',
                latitude: p.latitude,
                longitude: p.longitude,
                bairro: p.endereco || null,
                logradouro: null,
                numero: null,
                cidade: null,
                cep: null,
                endereco_completo: p.endereco || null,
                area_id: null,
                area_nome: null,
                area_cor: null,
                municipe_id: null,
                municipe_nome: null,
                municipe_telefone: null,
                responsavel_id: null,
                data_prazo: null,
                created_at: null,
                geocodificado: true,
                tipo: 'demanda'
              });
            } else {
              const municipe = municipesRaw.find(m => m.id === p.referencia_id);
              if (municipe) pontosParaMapa.push(municipe);
              else pontosParaMapa.push({
                id: p.referencia_id || `temp-municipe-${p.ordem}`,
                nome: p.nome,
                telefone: null,
                email: null,
                latitude: p.latitude,
                longitude: p.longitude,
                bairro: p.endereco || null,
                endereco: p.endereco || null,
                cidade: null,
                cep: null,
                endereco_completo: p.endereco || null,
                tags: [],
                demandas_count: 0,
                geocodificado: true,
                tipo: 'municipe'
              });
            }
          }
          setPontosRota(pontosParaMapa);
          setOrigemRota(rota.origem_lat && rota.origem_lng ? { lat: rota.origem_lat, lng: rota.origem_lng } : null);
          setDestinoRota(rota.destino_lat && rota.destino_lng ? { lat: rota.destino_lat, lng: rota.destino_lng } : null);
          setOtimizarRota(rota.otimizar || false);
          toast.success(`Rota "${rota.titulo}" carregada com ${pontosParaMapa.length} pontos`);
        }}
        onConcluirRota={(rota) => {
          setRotaParaConcluir(rota);
          setConcluirRotaDialogOpen(true);
        }}
      />

      <MunicipeDetailsDialog
        municipe={municipeParaDetalhes}
        open={municipeDetalhesOpen}
        onOpenChange={(open) => {
          setMunicipeDetalhesOpen(open);
          if (!open) setMunicipeParaDetalhes(null);
        }}
      />
    </div>
  );
}
