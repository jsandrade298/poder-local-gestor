import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { ClusterMap } from '@/components/mapa/ClusterMap';
import { HeatmapControls } from '@/components/mapa/HeatmapControls';
import { ShapefileUpload } from '@/components/mapa/ShapefileUpload';
import { VotosUpload } from '@/components/mapa/VotosUpload';
import { useCamadasGeograficas } from '@/hooks/useCamadasGeograficas';
import { useDadosEleitorais } from '@/hooks/useDadosEleitorais';
import { calcularEstatisticasPorRegiao, getFeatureName, filtrarPorRegiao } from '@/lib/geoUtils';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';
import { EditDemandaDialog } from '@/components/forms/EditDemandaDialog';
// Nota: Se os modais de Munícipe existirem no projeto, descomente as linhas abaixo:
// import { ViewMunicipeDialog } from '@/components/forms/ViewMunicipeDialog';
// import { EditMunicipeDialog } from '@/components/forms/EditMunicipeDialog';
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
  Vote
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
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'demandas' | 'municipes'>('todos');
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

  // Estados para dados eleitorais
  const [modoVisualizacao, setModoVisualizacao] = useState<'padrao' | 'atendimento' | 'votos' | 'comparativo'>('padrao');
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
      // Se filtro cruzado ativo E tem tags selecionadas, 
      // mostrar apenas demandas de munícipes com essas tags
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
      // Se filtro cruzado ativo E tem status/áreas selecionados,
      // mostrar apenas munícipes que têm demandas com esses filtros
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
      // Tags → Demandas
      municipesPorTags: municipesComTagsSelecionadas.length,
      demandasPorTags: tagsFiltro.length > 0 
        ? demandas.filter(d => d.municipe_id && municipesComTagsSelecionadas.includes(d.municipe_id)).length 
        : 0,
      // Demandas → Munícipes
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

  // Total de itens no mapa
  const totalNoMapa = 
    (tipoFiltro === 'todos' || tipoFiltro === 'demandas' ? demandasFiltradas.length : 0) +
    (tipoFiltro === 'todos' || tipoFiltro === 'municipes' ? municipesFiltrados.length : 0);

  // Calcular estatísticas por região para cada camada visível
  const estatisticasPorRegiao = useMemo(() => {
    const stats = new Map<string, Map<string, { demandas: number; municipes: number }>>();
    
    // Proteção: verificar se camadasVisiveis é um array válido
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

  // Calcular votos por camada para todas as camadas visíveis
  const votosPorCamada = useMemo(() => {
    const votosMap = new Map<string, Map<string, number>>();
    
    // Se temos dados eleitorais e uma camada selecionada
    if (dadosEleitorais.length > 0 && camadaSelecionadaStats) {
      const votosCamada = getVotosPorRegiao(eleicaoSelecionada || undefined);
      votosMap.set(camadaSelecionadaStats, votosCamada);
    }
    
    return votosMap;
  }, [dadosEleitorais, camadaSelecionadaStats, eleicaoSelecionada, getVotosPorRegiao]);

  // Calcular total de eleitores por camada para todas as camadas visíveis
  const totalEleitoresPorCamada = useMemo(() => {
    const eleitoresMap = new Map<string, Map<string, number>>();
    
    // Se temos dados eleitorais e uma camada selecionada
    if (dadosEleitorais.length > 0 && camadaSelecionadaStats) {
      const eleitoresCamada = getTotalEleitoresPorRegiao(eleicaoSelecionada || undefined);
      eleitoresMap.set(camadaSelecionadaStats, eleitoresCamada);
    }
    
    return eleitoresMap;
  }, [dadosEleitorais, camadaSelecionadaStats, eleicaoSelecionada, getTotalEleitoresPorRegiao]);

  // Obter estatísticas ordenadas de uma camada específica (agora inclui votos)
  const getEstatisticasCamadaOrdenadas = useCallback((camadaId: string | null | undefined) => {
    if (!camadaId) return [];
    
    const stats = estatisticasPorRegiao.get(camadaId);
    const votos = votosPorCamada.get(camadaId);
    
    // Coletar todos os nomes de regiões
    const nomesRegioes = new Set<string>();
    stats?.forEach((_, nome) => nomesRegioes.add(nome));
    votos?.forEach((_, nome) => nomesRegioes.add(nome));
    
    if (nomesRegioes.size === 0) return [];
    
    try {
      return Array.from(nomesRegioes)
        .map(nome => {
          const estatistica = stats?.get(nome);
          const votosRegiao = votos?.get(nome) || 0;
          
          // Calcular total baseado no tipoFiltro
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
          // Ordenar baseado no modo de visualização
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
    setAbaRegiao('dados'); // Resetar para aba de dados
    // Limpar outras seleções
    setItemSelecionado(null);
    setClusterSelecionado(null);
  }, []);

  // Dados da região selecionada
  const dadosRegiaoSelecionada = useMemo(() => {
    if (!regiaoSelecionada) return null;

    const nomeRegiao = regiaoSelecionada.nome;
    const camadaId = regiaoSelecionada.camadaId;

    // Filtrar demandas do bairro (comparação case-insensitive)
    const demandasDaRegiao = demandasFiltradas.filter(d => 
      d.bairro?.toLowerCase().trim() === nomeRegiao.toLowerCase().trim()
    );

    // Filtrar munícipes do bairro
    const municipesDaRegiao = municipesFiltrados.filter(m => 
      m.bairro?.toLowerCase().trim() === nomeRegiao.toLowerCase().trim()
    );

    // Obter estatísticas da camada
    const statsRegiao = estatisticasPorRegiao.get(camadaId)?.get(nomeRegiao);
    const votosRegiao = votosPorCamada.get(camadaId)?.get(nomeRegiao) || 0;
    const eleitoresRegiao = totalEleitoresPorCamada.get(camadaId)?.get(nomeRegiao) || 0;

    // Calcular totais gerais
    let totalVotosCandidato = 0;
    let totalEleitoresGeral = 0;

    votosPorCamada.get(camadaId)?.forEach(v => totalVotosCandidato += v);
    totalEleitoresPorCamada.get(camadaId)?.forEach(e => totalEleitoresGeral += e);

    // Calcular percentuais
    const percentualSobreTotalEleitores = totalEleitoresGeral > 0 
      ? (votosRegiao / totalEleitoresGeral) * 100 
      : 0;
    
    const percentualSobreEleitoresRegiao = eleitoresRegiao > 0 
      ? (votosRegiao / eleitoresRegiao) * 100 
      : 0;
    
    const percentualSobreTotalVotos = totalVotosCandidato > 0 
      ? (votosRegiao / totalVotosCandidato) * 100 
      : 0;

    // Preparar dados para rankings (todas as regiões da camada)
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

    // Calcular rankings
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

    // Calcular totais gerais
    let totalVotosCandidato = 0;
    let totalEleitoresGeral = 0;

    votosPorCamada.get(camadaId)?.forEach(v => totalVotosCandidato += v);
    totalEleitoresPorCamada.get(camadaId)?.forEach(e => totalEleitoresGeral += e);

    // Coletar dados de todas as regiões
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

    // Ranking por % do Eleitorado (votos/total eleitores geral)
    const rankingPctEleitorado = [...todasRegioes]
      .sort((a, b) => b.pctTotalEleitores - a.pctTotalEleitores)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    // Ranking por % na Região (votos/eleitores da região)
    const rankingPctRegiao = [...todasRegioes]
      .sort((a, b) => b.pctEleitoresRegiao - a.pctEleitoresRegiao)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    // Ranking por % Votação (votos/total votos candidato)
    const rankingPctVotacao = [...todasRegioes]
      .sort((a, b) => b.pctTotalVotos - a.pctTotalVotos)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    // Ranking por votos absolutos
    const rankingVotosAbsolutos = [...todasRegioes]
      .sort((a, b) => b.votos - a.votos)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    // Ranking por eleitores absolutos
    const rankingEleitoresAbsolutos = [...todasRegioes]
      .sort((a, b) => b.eleitores - a.eleitores)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    return {
      regiaoAtual: regiaoSelecionada.nome,
      totalRegioes: todasRegioes.length,
      totalVotosCandidato,
      totalEleitoresGeral,
      rankingPctEleitorado,
      rankingPctRegiao,
      rankingPctVotacao,
      rankingVotosAbsolutos,
      rankingEleitoresAbsolutos
    };
  }, [regiaoSelecionada, camadasVisiveis, votosPorCamada, totalEleitoresPorCamada]);

  // Função auxiliar para obter nome da feature
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

  // Obter geolocalização
  const obterLocalizacao = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOrigemRota({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          toast.success('Localização obtida com sucesso!');
        },
        (error) => {
          toast.error('Erro ao obter localização: ' + error.message);
        }
      );
    } else {
      toast.error('Geolocalização não suportada pelo navegador');
    }
  };

  // Adicionar à rota
  const adicionarARota = (item: DemandaMapa | MunicipeMapa) => {
    if (pontosRota.find(p => p.id === item.id)) {
      toast.warning('Este ponto já está na rota');
      return;
    }
    setPontosRota([...pontosRota, item]);
    toast.success('Ponto adicionado à rota');
  };

  // Remover da rota
  const removerDaRota = (id: string) => {
    setPontosRota(pontosRota.filter(p => p.id !== id));
  };

  // Mover ponto na rota
  const moverPonto = (index: number, direcao: 'up' | 'down') => {
    const novospontos = [...pontosRota];
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= novospontos.length) return;
    [novospontos[index], novospontos[novoIndex]] = [novospontos[novoIndex], novospontos[index]];
    setPontosRota(novospontos);
  };

  // Exportar para Google Maps
  const exportarGoogleMaps = () => {
    if (pontosRota.length === 0) {
      toast.warning('Adicione pontos à rota primeiro');
      return;
    }

    const waypoints = pontosRota
      .filter(p => p.latitude && p.longitude)
      .map(p => `${p.latitude},${p.longitude}`);

    let url = 'https://www.google.com/maps/dir/';
    
    if (origemRota) {
      url += `${origemRota.lat},${origemRota.lng}/`;
    }
    
    url += waypoints.join('/');
    
    window.open(url, '_blank');
  };

  // Formatar telefone para WhatsApp
  const formatWhatsAppLink = (telefone: string | null) => {
    if (!telefone) return null;
    const numero = telefone.replace(/\D/g, '');
    return `https://wa.me/55${numero}`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar Esquerda - Filtros (Minimizável) */}
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
                {/* Tab Filtros */}
                <TabsContent value="filtros" className="p-4 space-y-4 mt-0">
                  {/* Busca */}
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

                  {/* Tipo de dado */}
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
                    {statusFiltro.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-7 text-xs"
                        onClick={() => setStatusFiltro([])}
                      >
                        Limpar seleção
                      </Button>
                    )}
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
                    {areasFiltro.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-7 text-xs"
                        onClick={() => setAreasFiltro([])}
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <button 
                  onClick={() => setTagsExpanded(!tagsExpanded)}
                  className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    TAGS (MUNÍCIPES)
                  </span>
                  <div className="flex items-center gap-1">
                    {tagsFiltro.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {tagsFiltro.length}
                      </Badge>
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform ${tagsExpanded ? '' : '-rotate-90'}`} />
                  </div>
                </button>
                {tagsExpanded && (
                  <div className="pt-1 space-y-1 max-h-40 overflow-y-auto">
                    {tags.map((tag) => {
                      const count = municipesRaw.filter(m => m.tags?.some(t => t.id === tag.id)).length;
                      return (
                        <div key={tag.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`tag-${tag.id}`}
                            checked={tagsFiltro.includes(tag.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTagsFiltro([...tagsFiltro, tag.id]);
                              } else {
                                setTagsFiltro(tagsFiltro.filter(t => t !== tag.id));
                              }
                            }}
                          />
                        <label 
                          htmlFor={`tag-${tag.id}`}
                          className="flex items-center gap-2 text-sm cursor-pointer flex-1 truncate"
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: tag.cor || '#6b7280' }}
                          />
                          <span className="truncate">{tag.nome}</span>
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                            ({count})
                          </span>
                        </label>
                      </div>
                    );
                  })}
                  {tagsFiltro.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={() => setTagsFiltro([])}
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>
                )}
              </div>

              <Separator />

              {/* Controles de Heatmap e Filtro Cruzado */}
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

              <Separator />

              {/* Botão Atualizar */}
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

              {/* Alerta de itens sem coordenadas */}
              {(semCoordenadas.demandas > 0 || semCoordenadas.municipes > 0) && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-amber-800">
                          Itens sem localização:
                        </p>
                        <p className="text-amber-700">
                          {semCoordenadas.demandas > 0 && `${semCoordenadas.demandas} demandas`}
                          {semCoordenadas.demandas > 0 && semCoordenadas.municipes > 0 && ', '}
                          {semCoordenadas.municipes > 0 && `${semCoordenadas.municipes} munícipes`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab Rotas */}
            <TabsContent value="rotas" className="p-4 space-y-4 mt-0">
              {/* Origem */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">PONTO DE PARTIDA</label>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={obterLocalizacao}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {origemRota 
                    ? `${origemRota.lat.toFixed(4)}, ${origemRota.lng.toFixed(4)}`
                    : 'Usar minha localização'
                  }
                </Button>
              </div>

              <Separator />

              {/* Pontos da rota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    PONTOS DA ROTA ({pontosRota.length})
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
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Clique em um marcador no mapa e adicione à rota
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pontosRota.map((ponto, index) => (
                      <Card key={ponto.id} className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moverPonto(index, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moverPonto(index, 'down')}
                              disabled={index === pontosRota.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {index + 1}. {'titulo' in ponto ? ponto.titulo : ponto.nome}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {'bairro' in ponto && ponto.bairro}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600"
                            onClick={() => removerDaRota(ponto.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {pontosRota.length > 0 && (
                <>
                  <Separator />
                  
                  {/* Botões de exportação */}
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={exportarGoogleMaps}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Google Maps
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tab Análise */}
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
                  {/* Botão de Importar */}
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
                      <p className="text-xs">Importe um shapefile para começar</p>
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
                            {/* Toggle Visibilidade */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleVisibilidade.mutate({ 
                                id: camada.id, 
                                visivel: !camada.visivel 
                              })}
                              title={camada.visivel ? 'Ocultar camada' : 'Mostrar camada'}
                            >
                              {camada.visivel ? (
                                <Eye className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>

                            {/* Color Picker */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Alterar cor"
                                >
                                  <Palette className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-3" align="end">
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium">Cor</label>
                                    <div className="flex gap-2">
                                      <Input
                                        type="color"
                                        value={camada.cor_padrao}
                                        onChange={(e) => atualizarCor.mutate({ 
                                          id: camada.id, 
                                          cor: e.target.value 
                                        })}
                                        className="w-10 h-8 p-1 cursor-pointer"
                                      />
                                      <Input
                                        value={camada.cor_padrao}
                                        onChange={(e) => atualizarCor.mutate({ 
                                          id: camada.id, 
                                          cor: e.target.value 
                                        })}
                                        className="flex-1 h-8 text-xs font-mono"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium">
                                      Opacidade: {Math.round(camada.opacidade * 100)}%
                                    </label>
                                    <Slider
                                      value={[camada.opacidade]}
                                      onValueChange={([value]) => atualizarOpacidade.mutate({ 
                                        id: camada.id, 
                                        opacidade: value 
                                      })}
                                      min={0.1}
                                      max={0.8}
                                      step={0.1}
                                    />
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Remover */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removerCamada.mutate(camada.id)}
                              title="Remover camada"
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

              {/* Estatísticas por Região */}
              {camadasVisiveis.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Estatísticas por Região
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Seletor de Camada */}
                    <Select 
                      value={camadaSelecionadaStats || camadasVisiveis[0]?.id} 
                      onValueChange={(value) => {
                        setCamadaSelecionadaStats(value);
                        setEleicaoSelecionada(null); // Reset eleição ao mudar camada
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
                          // Invalidar queries para forçar refetch
                          queryClient.invalidateQueries({ queryKey: ['dados-eleitorais', camadaId] });
                          queryClient.invalidateQueries({ queryKey: ['eleicoes-disponiveis', camadaId] });
                          
                          // Após importar, selecionar a camada e eleição para visualização
                          setCamadaSelecionadaStats(camadaId);
                          setEleicaoSelecionada(eleicao);
                          // Mudar para modo de votos para visualizar os dados importados
                          setModoVisualizacao('votos');
                        }}
                      />
                    )}

                    {/* Seletor de Eleição (se houver dados) */}
                    {eleicoesDisponiveis.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Eleição</label>
                        <Select 
                          value={eleicaoSelecionada || eleicoesDisponiveis[0]} 
                          onValueChange={setEleicaoSelecionada}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {eleicoesDisponiveis.map(ano => (
                              <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          🗳️ {getTotalVotos(eleicaoSelecionada || undefined).toLocaleString('pt-BR')} votos total
                        </p>
                      </div>
                    )}

                    {/* Toggle de coloração por densidade */}
                    <div className="flex items-center justify-between py-2">
                      <label className="text-xs font-medium flex items-center gap-2">
                        <Palette className="h-3.5 w-3.5" />
                        Colorir regiões por dados
                      </label>
                      <Switch
                        checked={modoVisualizacao !== 'padrao'}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Se há dados eleitorais, usar modo votos; senão, atendimento
                            setModoVisualizacao(eleicoesDisponiveis.length > 0 ? 'votos' : 'atendimento');
                          } else {
                            setModoVisualizacao('padrao');
                          }
                        }}
                      />
                    </div>

                    {/* Modo de Visualização */}
                    {modoVisualizacao !== 'padrao' && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Colorir por</label>
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          variant={modoVisualizacao === 'atendimento' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setModoVisualizacao('atendimento')}
                        >
                          Atendimento
                        </Button>
                        <Button
                          variant={modoVisualizacao === 'votos' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setModoVisualizacao('votos')}
                          disabled={eleicoesDisponiveis.length === 0}
                        >
                          <Vote className="h-3 w-3 mr-1" />
                          Votos
                        </Button>
                        <Button
                          variant={modoVisualizacao === 'comparativo' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs col-span-2"
                          onClick={() => setModoVisualizacao('comparativo')}
                          disabled={eleicoesDisponiveis.length === 0}
                        >
                          Comparar Votos x Atendimento
                        </Button>
                      </div>
                      
                      {/* Legenda do modo comparativo */}
                      {modoVisualizacao === 'comparativo' && (
                        <div className="text-xs space-y-0.5 p-2 bg-muted/50 rounded">
                          <p className="font-medium">Legenda:</p>
                          <p><span className="inline-block w-3 h-3 bg-[#ef4444] rounded mr-1" />Mais votos que atendimento</p>
                          <p><span className="inline-block w-3 h-3 bg-[#eab308] rounded mr-1" />Equilibrado</p>
                          <p><span className="inline-block w-3 h-3 bg-[#22c55e] rounded mr-1" />Mais atendimento que votos</p>
                        </div>
                      )}
                      
                      {/* Legenda do modo votos */}
                      {modoVisualizacao === 'votos' && (
                        <div className="text-xs space-y-0.5 p-2 bg-muted/50 rounded">
                          <p className="font-medium">Intensidade de votos:</p>
                          <div className="flex items-center gap-2">
                            <span>Menos</span>
                            <div className="flex-1 h-3 rounded" style={{
                              background: 'linear-gradient(to right, #e0e7ff, #c7d2fe, #a5b4fc, #818cf8, #6366f1, #4f46e5)'
                            }} />
                            <span>Mais</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Legenda do modo atendimento */}
                      {modoVisualizacao === 'atendimento' && (
                        <div className="text-xs space-y-0.5 p-2 bg-muted/50 rounded">
                          <p className="font-medium">Densidade de atendimento:</p>
                          <div className="flex items-center gap-2">
                            <span>Baixa</span>
                            <div className="flex-1 h-3 rounded" style={{
                              background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)'
                            }} />
                            <span>Alta</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Lista de Regiões */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {getEstatisticasCamadaOrdenadas(camadaSelecionadaStats || camadasVisiveis[0]?.id).map((item, index) => (
                        <div 
                          key={item.nome}
                          className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            // Encontrar a feature correspondente para zoom
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
                            {(tipoFiltro === 'todos' || tipoFiltro === 'municipes') && (
                              <Badge variant="outline" className="h-5 text-xs gap-0.5">
                                <Users className="h-2.5 w-2.5" />
                                {item.municipes}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {getEstatisticasCamadaOrdenadas(camadaSelecionadaStats || camadasVisiveis[0]?.id).length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-4">
                          Nenhum item encontrado nas regiões
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Resumo Geral */}
              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-lg font-bold">{demandasFiltradas.length}</p>
                        <p className="text-xs text-muted-foreground">Demandas filtradas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-lg font-bold">{municipesFiltrados.length}</p>
                        <p className="text-xs text-muted-foreground">Munícipes filtrados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribuição por status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Por Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(STATUS_LABELS).map(([status, label]) => {
                    const count = contagemStatus[status] || 0;
                    const percent = demandasRaw.length > 0 
                      ? (count / demandasRaw.length) * 100 
                      : 0;
                    
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[status] }}
                            />
                            {label}
                          </span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <Progress 
                          value={percent} 
                          className="h-1.5"
                          style={{ 
                            '--progress-background': STATUS_COLORS[status] 
                          } as any}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Top Áreas */}
              {areas.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top 5 Áreas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {areas
                        .map(area => ({
                          ...area,
                          count: demandasRaw.filter(d => d.area_id === area.id).length
                        }))
                        .filter(a => a.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                        .map(area => (
                          <div key={area.id} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 truncate">
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: area.cor || '#6b7280' }}
                              />
                              <span className="truncate">{area.nome}</span>
                            </span>
                            <Badge variant="secondary" className="ml-2">
                              {area.count}
                            </Badge>
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
          demandas={tipoFiltro === 'municipes' ? [] : demandasFiltradas}
          municipes={tipoFiltro === 'demandas' ? [] : municipesFiltrados}
          mostrarDemandas={tipoFiltro !== 'municipes'}
          mostrarMunicipes={tipoFiltro !== 'demandas'}
          heatmapVisible={heatmapVisible}
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
                // Detalhes de Demanda
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

                  {itemSelecionado.status && (
                    <Badge 
                      style={{
                        backgroundColor: STATUS_COLORS[itemSelecionado.status] + '20',
                        color: STATUS_COLORS[itemSelecionado.status],
                        borderColor: STATUS_COLORS[itemSelecionado.status]
                      }}
                    >
                      {STATUS_LABELS[itemSelecionado.status] || itemSelecionado.status}
                    </Badge>
                  )}

                  {itemSelecionado.descricao && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                      <p className="text-sm">{itemSelecionado.descricao}</p>
                    </div>
                  )}

                  {itemSelecionado.area_nome && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Área</p>
                      <Badge variant="outline">{itemSelecionado.area_nome}</Badge>
                    </div>
                  )}

                  {itemSelecionado.municipe_nome && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Solicitante</p>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{itemSelecionado.municipe_nome}</span>
                      </div>
                      {itemSelecionado.municipe_telefone && (
                        <a
                          href={formatWhatsAppLink(itemSelecionado.municipe_telefone) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-1"
                        >
                          <Phone className="h-3 w-3" />
                          {itemSelecionado.municipe_telefone}
                        </a>
                      )}
                    </div>
                  )}

                  {itemSelecionado.bairro && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Localização</p>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {[itemSelecionado.logradouro, itemSelecionado.numero, itemSelecionado.bairro]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  )}
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
                      {itemSelecionado.email && (
                        <p className="text-sm text-muted-foreground">{itemSelecionado.email}</p>
                      )}
                    </div>
                  </div>

                  {itemSelecionado.telefone && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Telefone</p>
                      <a
                        href={formatWhatsAppLink(itemSelecionado.telefone) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                      >
                        <Phone className="h-4 w-4" />
                        {itemSelecionado.telefone}
                      </a>
                    </div>
                  )}

                  {itemSelecionado.bairro && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Endereço</p>
                      <div className="flex items-start gap-1 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          {[itemSelecionado.endereco, itemSelecionado.bairro, itemSelecionado.cidade]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {itemSelecionado.demandas_count > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Demandas</p>
                      <Badge variant="secondary">{itemSelecionado.demandas_count} demanda(s)</Badge>
                    </div>
                  )}

                  {itemSelecionado.tags && itemSelecionado.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {itemSelecionado.tags.map(tag => (
                          <Badge 
                            key={tag.id}
                            variant="outline"
                            style={{
                              backgroundColor: (tag.cor || '#6b7280') + '20',
                              borderColor: tag.cor || '#6b7280'
                            }}
                          >
                            {tag.nome}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <Separator />

              {/* Ações */}
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
                    if ('titulo' in itemSelecionado) {
                      setDemandaModalId(itemSelecionado.id);
                    } else {
                      setMunicipeModalId(itemSelecionado.id);
                    }
                    setItemSelecionado(null);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Detalhes Completos
                </Button>
              </div>
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
                {clusterSelecionado.demandas.length + clusterSelecionado.municipes.length} itens no total
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

          {/* Ações em lote */}
          <div className="p-4 border-b flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={() => {
                const todos = [...clusterSelecionado.demandas, ...clusterSelecionado.municipes];
                let adicionados = 0;
                todos.forEach(item => {
                  if (!pontosRota.find(p => p.id === item.id)) {
                    adicionados++;
                  }
                });
                setPontosRota([...pontosRota, ...todos.filter(item => !pontosRota.find(p => p.id === item.id))]);
                toast.success(`${adicionados} itens adicionados à rota`);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar todos à rota
            </Button>
          </div>

          {/* Abas de Demandas e Munícipes */}
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

            <div className="flex-1 overflow-y-auto p-4">
              {/* Tab Demandas */}
              <TabsContent value="demandas" className="mt-0 space-y-2">
                {clusterSelecionado.demandas.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma demanda neste cluster</p>
                  </div>
                ) : (
                  clusterSelecionado.demandas.map((demanda) => (
                    <Card key={demanda.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: (demanda.area_cor || '#ef4444') + '20' }}
                        >
                          <FileText 
                            className="h-4 w-4" 
                            style={{ color: demanda.area_cor || '#ef4444' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{demanda.titulo}</p>
                          <p className="text-xs text-muted-foreground">{demanda.protocolo}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {demanda.status && (
                              <Badge 
                                variant="outline" 
                                className="text-xs h-5"
                                style={{ 
                                  backgroundColor: STATUS_COLORS[demanda.status] + '20',
                                  borderColor: STATUS_COLORS[demanda.status],
                                  color: STATUS_COLORS[demanda.status]
                                }}
                              >
                                {STATUS_LABELS[demanda.status] || demanda.status}
                              </Badge>
                            )}
                          </div>
                          {demanda.municipe_nome && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {demanda.municipe_nome}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => adicionarARota(demanda)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Rota
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => setDemandaModalId(demanda.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Detalhes
                        </Button>
                        {demanda.municipe_telefone && (
                          <a
                            href={formatWhatsAppLink(demanda.municipe_telefone) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Tab Munícipes */}
              <TabsContent value="municipes" className="mt-0 space-y-2">
                {clusterSelecionado.municipes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum munícipe neste cluster</p>
                  </div>
                ) : (
                  clusterSelecionado.municipes.map((municipe) => (
                    <Card key={municipe.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{municipe.nome}</p>
                          {municipe.telefone && (
                            <p className="text-xs text-muted-foreground">{municipe.telefone}</p>
                          )}
                          {municipe.bairro && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {municipe.bairro}
                            </p>
                          )}
                          {municipe.demandas_count > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {municipe.demandas_count} demanda(s)
                            </p>
                          )}
                          {municipe.tags && municipe.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {municipe.tags.slice(0, 2).map(tag => (
                                <Badge 
                                  key={tag.id} 
                                  variant="outline"
                                  className="text-xs h-5"
                                  style={{
                                    backgroundColor: (tag.cor || '#6b7280') + '20',
                                    borderColor: tag.cor || '#6b7280',
                                  }}
                                >
                                  {tag.nome}
                                </Badge>
                              ))}
                              {municipe.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs h-5">
                                  +{municipe.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => adicionarARota(municipe)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Rota
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => setMunicipeModalId(municipe.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Detalhes
                        </Button>
                        {municipe.telefone && (
                          <a
                            href={formatWhatsAppLink(municipe.telefone) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </div>
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

          {/* Abas: Dados, Demandas, Munícipes */}
          <Tabs value={abaRegiao} onValueChange={(v) => setAbaRegiao(v as 'dados' | 'demandas' | 'municipes')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="dados" className="text-xs gap-1">
                <BarChart3 className="h-3 w-3" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="demandas" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                Demandas ({dadosRegiaoSelecionada.totalDemandas})
              </TabsTrigger>
              <TabsTrigger value="municipes" className="text-xs gap-1">
                <Users className="h-3 w-3" />
                Munícipes ({dadosRegiaoSelecionada.totalMunicipes})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Tab Dados */}
              <TabsContent value="dados" className="mt-0 space-y-4">
                {/* Card Atendimento */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      Atendimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Munícipes</span>
                      <Badge variant="secondary">{dadosRegiaoSelecionada.totalMunicipes}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Demandas</span>
                      <Badge variant="secondary">{dadosRegiaoSelecionada.totalDemandas}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Card Dados Eleitorais */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Vote className="h-4 w-4 text-blue-500" />
                      Dados Eleitorais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Votos na região</span>
                      <Badge variant="outline" className="font-mono">
                        {dadosRegiaoSelecionada.votos.toLocaleString('pt-BR')}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total de eleitores</span>
                      <Badge variant="outline" className="font-mono">
                        {dadosRegiaoSelecionada.eleitores.toLocaleString('pt-BR')}
                      </Badge>
                    </div>
                    <Separator className="my-2" />
                    <div className="text-xs text-muted-foreground">
                      <p>Total de votos (candidato): {dadosRegiaoSelecionada.totalVotosCandidato.toLocaleString('pt-BR')}</p>
                      <p>Total de eleitores (geral): {dadosRegiaoSelecionada.totalEleitoresGeral.toLocaleString('pt-BR')}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card Análise de Desempenho */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      Análise de Desempenho
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Rankings entre {dadosRegiaoSelecionada.totalRegioes} regiões
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* % sobre Total de Eleitores */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">% Eleitorado</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">
                            {dadosRegiaoSelecionada.percentualSobreTotalEleitores.toFixed(2)}%
                          </span>
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            {dadosRegiaoSelecionada.rankingTotalEleitores}º
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Votos da região / Total de eleitores de TODAS as regiões
                      </p>
                    </div>

                    <Separator />

                    {/* % sobre Eleitores da Região */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">% na Região</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-green-700">
                            {dadosRegiaoSelecionada.percentualSobreEleitoresRegiao.toFixed(2)}%
                          </span>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {dadosRegiaoSelecionada.rankingEleitoresRegiao}º
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Votos da região / Eleitores DESTA região
                      </p>
                    </div>

                    <Separator />

                    {/* % sobre Total de Votos */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">% Votação</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-700">
                            {dadosRegiaoSelecionada.percentualSobreTotalVotos.toFixed(2)}%
                          </span>
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            {dadosRegiaoSelecionada.rankingTotalVotos}º
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Votos da região / Total de votos do candidato
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Botão para ver rankings completos */}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setModalRankingsAberto(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Rankings Completos
                </Button>
              </TabsContent>

              {/* Tab Demandas */}
              <TabsContent value="demandas" className="mt-0 space-y-2">
                {dadosRegiaoSelecionada.demandas.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma demanda nesta região</p>
                    <p className="text-xs mt-1">Verifique se o bairro das demandas corresponde ao nome da região</p>
                  </div>
                ) : (
                  dadosRegiaoSelecionada.demandas.map((demanda) => (
                    <Card key={demanda.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: (demanda.area_cor || '#ef4444') + '20' }}
                        >
                          <FileText 
                            className="h-4 w-4" 
                            style={{ color: demanda.area_cor || '#ef4444' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{demanda.titulo}</p>
                          <p className="text-xs text-muted-foreground">{demanda.protocolo}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {demanda.status && (
                              <Badge 
                                variant="outline" 
                                className="text-xs h-5"
                                style={{ 
                                  backgroundColor: STATUS_COLORS[demanda.status] + '20',
                                  borderColor: STATUS_COLORS[demanda.status],
                                  color: STATUS_COLORS[demanda.status]
                                }}
                              >
                                {STATUS_LABELS[demanda.status] || demanda.status}
                              </Badge>
                            )}
                          </div>
                          {demanda.municipe_nome && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {demanda.municipe_nome}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => adicionarARota(demanda)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Rota
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => setDemandaModalId(demanda.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Detalhes
                        </Button>
                        {demanda.municipe_telefone && (
                          <a
                            href={formatWhatsAppLink(demanda.municipe_telefone) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Tab Munícipes */}
              <TabsContent value="municipes" className="mt-0 space-y-2">
                {dadosRegiaoSelecionada.municipes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum munícipe nesta região</p>
                    <p className="text-xs mt-1">Verifique se o bairro dos munícipes corresponde ao nome da região</p>
                  </div>
                ) : (
                  dadosRegiaoSelecionada.municipes.map((municipe) => (
                    <Card key={municipe.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{municipe.nome}</p>
                          {municipe.telefone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {municipe.telefone}
                            </p>
                          )}
                          {municipe.total_demandas !== undefined && municipe.total_demandas > 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <FileText className="h-3 w-3" />
                              {municipe.total_demandas} demanda{municipe.total_demandas !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => adicionarARota(municipe)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Rota
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs flex-1"
                          onClick={() => setMunicipeModalId(municipe.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Detalhes
                        </Button>
                        {municipe.telefone && (
                          <a
                            href={formatWhatsAppLink(municipe.telefone) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </div>
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

      {/* Modal de Rankings Completos */}
      <Dialog open={modalRankingsAberto} onOpenChange={setModalRankingsAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pct-eleitorado" className="text-xs">% Eleitorado</TabsTrigger>
                <TabsTrigger value="pct-regiao" className="text-xs">% na Região</TabsTrigger>
                <TabsTrigger value="pct-votacao" className="text-xs">% Votação</TabsTrigger>
                <TabsTrigger value="votos-abs" className="text-xs">Votos</TabsTrigger>
                <TabsTrigger value="eleitores-abs" className="text-xs">Eleitores</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                {/* Tab % Eleitorado */}
                <TabsContent value="pct-eleitorado" className="mt-0">
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
                </TabsContent>

                {/* Tab % na Região */}
                <TabsContent value="pct-regiao" className="mt-0">
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
                </TabsContent>

                {/* Tab % Votação */}
                <TabsContent value="pct-votacao" className="mt-0">
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
                </TabsContent>

                {/* Tab Votos Absolutos */}
                <TabsContent value="votos-abs" className="mt-0">
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
                </TabsContent>

                {/* Tab Eleitores Absolutos */}
                <TabsContent value="eleitores-abs" className="mt-0">
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
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Modais de Munícipe - Descomente se os componentes existirem no projeto */}
      {/* 
      <ViewMunicipeDialog
        municipe={municipeModalId ? municipesRaw.find(m => m.id === municipeModalId) || null : null}
        open={!!municipeModalId}
        onOpenChange={(open) => {
          if (!open) setMunicipeModalId(null);
        }}
        onEdit={() => {
          const municipe = municipesRaw.find(m => m.id === municipeModalId);
          if (municipe) {
            setMunicipeParaEditar(municipe);
            setMunicipeModalId(null);
            setIsEditMunicipeOpen(true);
          }
        }}
      />

      <EditMunicipeDialog
        municipe={municipeParaEditar}
        open={isEditMunicipeOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditMunicipeOpen(false);
            setMunicipeParaEditar(null);
          }
        }}
      />
      */}
    </div>
  );
}
