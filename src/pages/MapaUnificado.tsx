import { useState, useMemo } from 'react';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { useMapaRota, formatarDistancia, formatarDuracao } from '@/hooks/useMapaRota';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, RefreshCw, AlertCircle, Users, FileText, Search, X,
  Filter, Route, Eye, Phone, MapPinned, Navigation, Locate, Copy,
  Navigation2, Car, Play, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ClusterMap, MapMarker } from '@/components/map/ClusterMap';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';
import { MunicipeDetailsDialog } from '@/components/forms/MunicipeDetailsDialog';

// Cores de status consistentes com o app
const STATUS_COLORS: Record<string, string> = {
  solicitada: '#3b82f6',
  em_producao: '#f59e0b',
  encaminhado: '#8b5cf6',
  devolvido: '#ef4444',
  visitado: '#06b6d4',
  atendido: '#10b981',
  default: '#6b7280'
};

const STATUS_LABELS: Record<string, string> = {
  solicitada: 'Solicitada',
  em_producao: 'Em Produção',
  encaminhado: 'Encaminhado',
  devolvido: 'Devolvido',
  visitado: 'Visitado',
  atendido: 'Atendido'
};

export default function MapaUnificado() {
  const { center, zoom, cidade, estado } = useMapConfig();
  const { demandas, municipes, areas, tags, bairrosUnicos, isLoading, refetch } = useMapaUnificado();
  const rota = useMapaRota();

  // Estados de filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarDemandas, setMostrarDemandas] = useState(true);
  const [mostrarMunicipes, setMostrarMunicipes] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [areasFiltro, setAreasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [bairroFiltro, setBairroFiltro] = useState('');

  // Estados para o Painel Lateral
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MapMarker[]>([]);
  const [activeTab, setActiveTab] = useState<'demandas' | 'municipes'>('demandas');

  // Estados para dialogs
  const [selectedDemanda, setSelectedDemanda] = useState<DemandaMapa | null>(null);
  const [selectedMunicipe, setSelectedMunicipe] = useState<MunicipeMapa | null>(null);
  const [showDemandaDialog, setShowDemandaDialog] = useState(false);
  const [showMunicipeDialog, setShowMunicipeDialog] = useState(false);
  const [showRotaDialog, setShowRotaDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filtragem de demandas
  const demandasFiltradas = useMemo(() => {
    if (!mostrarDemandas) return [];
    
    return demandas.filter(d => {
      // Filtro de status
      if (statusFiltro.length > 0 && !statusFiltro.includes(d.status || 'solicitada')) return false;
      // Filtro de área
      if (areasFiltro.length > 0 && d.area_id && !areasFiltro.includes(d.area_id)) return false;
      // Filtro de bairro
      if (bairroFiltro && d.bairro !== bairroFiltro) return false;
      // Busca textual
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !d.titulo?.toLowerCase().includes(term) &&
          !d.protocolo?.toLowerCase().includes(term) &&
          !d.bairro?.toLowerCase().includes(term) &&
          !d.municipe_nome?.toLowerCase().includes(term)
        ) return false;
      }
      return true;
    });
  }, [demandas, mostrarDemandas, statusFiltro, areasFiltro, bairroFiltro, searchTerm]);

  // Filtragem de munícipes
  const municipesFiltrados = useMemo(() => {
    if (!mostrarMunicipes) return [];
    
    return municipes.filter(m => {
      // Filtro de tags
      if (tagsFiltro.length > 0 && !tagsFiltro.some(t => m.tag_ids.includes(t))) return false;
      // Filtro de bairro
      if (bairroFiltro && m.bairro !== bairroFiltro) return false;
      // Busca textual
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !m.nome?.toLowerCase().includes(term) &&
          !m.bairro?.toLowerCase().includes(term) &&
          !m.telefone?.includes(term)
        ) return false;
      }
      return true;
    });
  }, [municipes, mostrarMunicipes, tagsFiltro, bairroFiltro, searchTerm]);

  // Prepara os marcadores para o mapa
  const markers: MapMarker[] = useMemo(() => [
    ...demandasFiltradas.map(d => ({
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      title: d.titulo,
      description: d.protocolo,
      status: d.status || 'solicitada',
      type: 'demanda' as const,
      originalData: d
    })),
    ...municipesFiltrados.map(m => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.nome,
      description: m.bairro || '',
      type: 'municipe' as const,
      originalData: m
    }))
  ], [demandasFiltradas, municipesFiltrados]);

  // Handlers
  const handleClusterClick = (items: MapMarker[]) => {
    setSelectedItems(items);
    const hasDemandas = items.some(i => i.type === 'demanda');
    setActiveTab(hasDemandas ? 'demandas' : 'municipes');
    setIsSheetOpen(true);
  };

  const toggleStatus = (status: string) => {
    setStatusFiltro(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleArea = (areaId: string) => {
    setAreasFiltro(prev => 
      prev.includes(areaId) ? prev.filter(a => a !== areaId) : [...prev, areaId]
    );
  };

  const toggleTag = (tagId: string) => {
    setTagsFiltro(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setStatusFiltro([]);
    setAreasFiltro([]);
    setTagsFiltro([]);
    setBairroFiltro('');
  };

  const addDemandaRota = (d: DemandaMapa) => {
    rota.adicionarPonto({
      id: d.id,
      tipo: 'demanda',
      nome: `${d.protocolo} - ${d.titulo}`,
      latitude: d.latitude,
      longitude: d.longitude,
      endereco: [d.logradouro, d.numero, d.bairro].filter(Boolean).join(', ')
    });
  };

  const addMunicipeRota = (m: MunicipeMapa) => {
    rota.adicionarPonto({
      id: m.id,
      tipo: 'municipe',
      nome: m.nome,
      latitude: m.latitude,
      longitude: m.longitude,
      endereco: m.endereco || m.bairro || ''
    });
  };

  const confirmarCalculoRota = async () => {
    const resultado = await rota.calcularRotaOtimizada(true);
    if (resultado) setShowRotaDialog(false);
  };

  const selectedDemandas = selectedItems.filter(i => i.type === 'demanda');
  const selectedMunicipes = selectedItems.filter(i => i.type === 'municipe');
  const temFiltros = searchTerm || statusFiltro.length > 0 || areasFiltro.length > 0 || tagsFiltro.length > 0 || bairroFiltro;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Gestão
          </h1>
          <p className="text-muted-foreground text-sm">
            {cidade}{estado ? `/${estado}` : ''} • {demandasFiltradas.length} demandas • {municipesFiltrados.length} munícipes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rota.pontosRota.length > 0 && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Route className="h-3 w-3 mr-1" />
              {rota.pontosRota.length} na rota
            </Badge>
          )}
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {temFiltros && <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">{
              [statusFiltro.length, areasFiltro.length, tagsFiltro.length, bairroFiltro ? 1 : 0, searchTerm ? 1 : 0].reduce((a, b) => a + b, 0)
            }</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros colapsáveis */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <div className="p-4 border-b bg-muted/30 space-y-4">
            {/* Busca e camadas */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, protocolo, bairro..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={mostrarDemandas} onCheckedChange={c => setMostrarDemandas(!!c)} />
                  <span className="flex items-center gap-1 text-sm">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    Demandas
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={mostrarMunicipes} onCheckedChange={c => setMostrarMunicipes(!!c)} />
                  <span className="flex items-center gap-1 text-sm">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    Munícipes
                  </span>
                </label>
              </div>
            </div>

            {/* Filtros por tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status */}
              {mostrarDemandas && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Status</Label>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <Badge
                        key={key}
                        variant={statusFiltro.includes(key) ? "default" : "outline"}
                        className="cursor-pointer text-xs transition-all"
                        style={statusFiltro.includes(key) ? { backgroundColor: STATUS_COLORS[key] } : {}}
                        onClick={() => toggleStatus(key)}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Áreas */}
              {mostrarDemandas && areas.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Áreas</Label>
                  <div className="flex flex-wrap gap-1">
                    {areas.map(area => (
                      <Badge
                        key={area.id}
                        variant={areasFiltro.includes(area.id) ? "default" : "outline"}
                        className="cursor-pointer text-xs transition-all"
                        style={areasFiltro.includes(area.id) ? { backgroundColor: area.cor || '#666' } : {}}
                        onClick={() => toggleArea(area.id)}
                      >
                        {area.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {mostrarMunicipes && tags.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant={tagsFiltro.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer text-xs transition-all"
                        style={tagsFiltro.includes(tag.id) ? { backgroundColor: tag.cor || '#666' } : {}}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bairro e limpar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <select
                  value={bairroFiltro}
                  onChange={e => setBairroFiltro(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Todos os bairros</option>
                  {bairrosUnicos.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              {temFiltros && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Área Principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mapa */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-muted-foreground text-sm animate-pulse">Carregando mapa...</p>
              </div>
            </div>
          ) : markers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-muted/20">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum resultado</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {temFiltros 
                  ? 'Nenhum dado encontrado com os filtros aplicados. Tente ajustar os critérios de busca.'
                  : 'Nenhum dado com coordenadas encontrado no sistema.'}
              </p>
              {temFiltros && (
                <Button variant="outline" size="sm" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <ClusterMap
              markers={markers}
              center={center}
              zoom={zoom}
              onClusterClick={handleClusterClick}
            />
          )}

          {/* Legenda flutuante */}
          <Card className="absolute bottom-4 left-4 z-[400] shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Demandas ({demandasFiltradas.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Munícipes ({municipesFiltrados.length})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Painel de Rota flutuante */}
          {rota.pontosRota.length > 0 && (
            <Card className="absolute top-4 right-4 z-[400] w-72 shadow-lg">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Roteiro ({rota.pontosRota.length})
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rota.limparRota}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {/* Origem */}
                <div className="text-xs">
                  <span className="text-muted-foreground">Origem: </span>
                  {rota.pontoOrigem ? (
                    <span className="font-medium">{rota.pontoOrigem.nome}</span>
                  ) : (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-xs"
                      onClick={rota.usarLocalizacaoAtual}
                      disabled={rota.buscandoLocalizacao}
                    >
                      <Locate className="h-3 w-3 mr-1" />
                      {rota.buscandoLocalizacao ? 'Obtendo...' : 'Usar minha localização'}
                    </Button>
                  )}
                </div>

                {/* Status da rota */}
                {rota.rotaCalculada && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <Navigation2 className="h-3 w-3" />
                      Rota calculada!
                    </div>
                    <div className="flex gap-2 mt-1 text-green-600">
                      <span>{formatarDistancia(rota.rotaCalculada.distancia)}</span>
                      <span>•</span>
                      <span>{formatarDuracao(rota.rotaCalculada.duracao)}</span>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2">
                  {!rota.rotaCalculada ? (
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => setShowRotaDialog(true)}
                      disabled={rota.pontosRota.length === 0}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Calcular Rota
                    </Button>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        className="flex-1 h-8 text-xs"
                        onClick={() => setShowExportDialog(true)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Navegar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={rota.copiarEnderecos}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* PAINEL LATERAL (SHEET) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:w-[480px] overflow-hidden flex flex-col">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-primary" />
              Detalhes do Local
            </SheetTitle>
            <SheetDescription>
              {selectedItems.length} {selectedItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="demandas" disabled={selectedDemandas.length === 0}>
                <FileText className="h-4 w-4 mr-2" />
                Demandas ({selectedDemandas.length})
              </TabsTrigger>
              <TabsTrigger value="municipes" disabled={selectedMunicipes.length === 0}>
                <Users className="h-4 w-4 mr-2" />
                Munícipes ({selectedMunicipes.length})
              </TabsTrigger>
            </TabsList>

            {/* LISTA DE DEMANDAS */}
            <TabsContent value="demandas" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3 pb-4">
                  {selectedDemandas.map((item) => {
                    const demanda = item.originalData as DemandaMapa;
                    const naRota = rota.pontosRota.some(p => p.id === demanda.id);
                    const statusColor = STATUS_COLORS[demanda.status || 'default'] || STATUS_COLORS.default;
                    
                    return (
                      <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <Badge 
                              style={{ backgroundColor: statusColor }} 
                              className="text-white text-xs"
                            >
                              {STATUS_LABELS[demanda.status || 'solicitada']}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                              {demanda.protocolo}
                            </span>
                          </div>
                          
                          <h4 className="font-semibold text-sm mb-1 line-clamp-2">{demanda.titulo}</h4>
                          
                          {demanda.bairro && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                              <MapPin className="h-3 w-3" />
                              {demanda.bairro}
                            </p>
                          )}
                          
                          {demanda.municipe_nome && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Solicitante: {demanda.municipe_nome}
                            </p>
                          )}
                          
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 h-8 text-xs"
                              onClick={() => {
                                setSelectedDemanda(demanda);
                                setShowDemandaDialog(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Detalhes
                            </Button>
                            <Button 
                              size="sm" 
                              variant={naRota ? "secondary" : "default"}
                              className="flex-1 h-8 text-xs"
                              onClick={() => !naRota && addDemandaRota(demanda)}
                              disabled={naRota}
                            >
                              <Route className="h-3 w-3 mr-1" />
                              {naRota ? 'Na rota' : 'Adicionar'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* LISTA DE MUNÍCIPES */}
            <TabsContent value="municipes" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3 pb-4">
                  {selectedMunicipes.map((item) => {
                    const municipe = item.originalData as MunicipeMapa;
                    const naRota = rota.pontosRota.some(p => p.id === municipe.id);
                    
                    return (
                      <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {municipe.nome.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{municipe.nome}</h4>
                              
                              {municipe.telefone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {municipe.telefone}
                                </p>
                              )}
                              
                              {municipe.bairro && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {municipe.bairro}
                                </p>
                              )}
                              
                              {municipe.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {municipe.tags.slice(0, 3).map((tag, i) => (
                                    <Badge 
                                      key={i} 
                                      variant="outline" 
                                      className="text-[10px] h-5"
                                      style={{ borderColor: municipe.tag_cores[i] }}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                  {municipe.tags.length > 3 && (
                                    <Badge variant="outline" className="text-[10px] h-5">
                                      +{municipe.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 h-8 text-xs"
                              onClick={() => {
                                setSelectedMunicipe(municipe);
                                setShowMunicipeDialog(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Detalhes
                            </Button>
                            <Button 
                              size="sm" 
                              variant={naRota ? "secondary" : "default"}
                              className="flex-1 h-8 text-xs"
                              onClick={() => !naRota && addMunicipeRota(municipe)}
                              disabled={naRota}
                            >
                              <Route className="h-3 w-3 mr-1" />
                              {naRota ? 'Na rota' : 'Adicionar'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Dialog de Calcular Rota */}
      <Dialog open={showRotaDialog} onOpenChange={setShowRotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Calcular Rota Otimizada
            </DialogTitle>
            <DialogDescription>
              Configure a origem e otimize a ordem das visitas
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">Ponto de Origem</Label>
              {rota.pontoOrigem ? (
                <div className="mt-2 p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Locate className="h-4 w-4 text-primary" />
                    <span className="text-sm">{rota.pontoOrigem.nome}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={rota.limparOrigem}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full mt-2" 
                  onClick={rota.usarLocalizacaoAtual}
                  disabled={rota.buscandoLocalizacao}
                >
                  <Locate className="h-4 w-4 mr-2" />
                  {rota.buscandoLocalizacao ? 'Obtendo localização...' : 'Usar minha localização'}
                </Button>
              )}
            </div>
            
            <div>
              <Label className="text-sm font-medium">{rota.pontosRota.length} Paradas</Label>
              <div className="mt-2 max-h-[200px] overflow-auto space-y-1">
                {rota.pontosRota.map((p, i) => (
                  <div key={p.id} className="p-2 border rounded text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate flex-1">{p.nome}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => rota.removerPonto(p.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotaDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmarCalculoRota} 
              disabled={!rota.pontoOrigem || rota.calculandoRota}
            >
              {rota.calculandoRota ? 'Calculando...' : 'Otimizar Rota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exportar/Navegar */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Navegação</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-14 justify-start gap-3" 
              onClick={() => { rota.abrirNoGoogleMaps(); setShowExportDialog(false); }}
            >
              <MapPin className="h-5 w-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium">Google Maps</p>
                <p className="text-xs text-muted-foreground">Abrir rota com todas as paradas</p>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full h-14 justify-start gap-3" 
              onClick={() => { rota.abrirNoWaze(); setShowExportDialog(false); }}
            >
              <Navigation2 className="h-5 w-5 text-cyan-600" />
              <div className="text-left">
                <p className="font-medium">Waze</p>
                <p className="text-xs text-muted-foreground">Navegar até o primeiro ponto</p>
              </div>
            </Button>
            
            <Separator />
            
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3" 
              onClick={rota.copiarEnderecos}
            >
              <Copy className="h-5 w-5" />
              <span>Copiar roteiro completo</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Demanda */}
      {selectedDemanda && (
        <ViewDemandaDialog
          demanda={selectedDemanda}
          open={showDemandaDialog}
          onOpenChange={(open) => {
            setShowDemandaDialog(open);
            if (!open) setSelectedDemanda(null);
          }}
        />
      )}

      {/* Dialog de Munícipe */}
      {selectedMunicipe && (
        <MunicipeDetailsDialog
          municipe={selectedMunicipe}
          open={showMunicipeDialog}
          onOpenChange={(open) => {
            setShowMunicipeDialog(open);
            if (!open) setSelectedMunicipe(null);
          }}
        />
      )}
    </div>
  );
}
