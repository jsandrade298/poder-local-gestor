import { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Icon, LatLngBounds, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  MapPin, RefreshCw, Search, X, Layers, Navigation, 
  ChevronDown, ChevronUp, Route, Trash2, ExternalLink, Users, 
  FileText, Eye, Menu, Phone, MapPinned
} from 'lucide-react';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useMapaRota, formatarDistancia, formatarDuracao } from '@/hooks/useMapaRota';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';

// Cores por status de demanda
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

// Criar ícone de demanda
function createDemandaIcon(color: string, isSelected: boolean = false): Icon {
  const size = isSelected ? 44 : 36;
  const stroke = isSelected ? 3 : 1.5;
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
      <path fill="${color}" stroke="#ffffff" stroke-width="${stroke}" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
      <circle fill="#ffffff" cx="12" cy="8.5" r="3"/>
    </svg>
  `;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size]
  });
}

// Criar ícone de munícipe
function createMunicipeIcon(color: string = '#6366f1', isSelected: boolean = false): Icon {
  const size = isSelected ? 40 : 32;
  const stroke = isSelected ? 3 : 1.5;
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
      <circle fill="${color}" stroke="#ffffff" stroke-width="${stroke}" cx="12" cy="12" r="10"/>
      <circle fill="#ffffff" cx="12" cy="9" r="3"/>
      <path fill="#ffffff" d="M12 14c-3 0-5.5 1.5-5.5 3.5v.5h11v-.5c0-2-2.5-3.5-5.5-3.5z"/>
    </svg>
  `;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
}

// Componente para atualizar bounds do mapa
function MapBoundsUpdater({ 
  demandas, 
  municipes, 
  center,
  zoom
}: { 
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  
  useEffect(() => {
    const allPoints = [
      ...demandas.map(d => [d.latitude, d.longitude] as [number, number]),
      ...municipes.map(m => [m.latitude, m.longitude] as [number, number])
    ];
    
    if (allPoints.length > 0) {
      const bounds = new LatLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [demandas.length, municipes.length, map, center, zoom]);
  
  return null;
}

// Função para agrupar pontos próximos em clusters
interface ClusterResult<T> {
  clusters: { lat: number; lng: number; items: T[] }[];
  singles: T[];
}

function criarClusters<T extends { latitude: number; longitude: number; id: string }>(
  items: T[],
  zoomLevel: number
): ClusterResult<T> {
  if (items.length < 2) {
    return { clusters: [], singles: items };
  }

  // Distância de agrupamento baseada no zoom
  const distanciaCluster = Math.pow(2, 16 - zoomLevel) * 0.0003;
  
  const usados = new Set<string>();
  const clusters: { lat: number; lng: number; items: T[] }[] = [];
  const singles: T[] = [];
  
  items.forEach((item) => {
    if (usados.has(item.id)) return;
    
    const proximosIds: string[] = [item.id];
    const proximos: T[] = [item];
    usados.add(item.id);
    
    items.forEach((outro) => {
      if (usados.has(outro.id)) return;
      
      const distancia = Math.sqrt(
        Math.pow(item.latitude - outro.latitude, 2) + 
        Math.pow(item.longitude - outro.longitude, 2)
      );
      
      if (distancia < distanciaCluster) {
        proximosIds.push(outro.id);
        proximos.push(outro);
        usados.add(outro.id);
      }
    });
    
    if (proximos.length > 1) {
      const lat = proximos.reduce((sum, p) => sum + p.latitude, 0) / proximos.length;
      const lng = proximos.reduce((sum, p) => sum + p.longitude, 0) / proximos.length;
      clusters.push({ lat, lng, items: proximos });
    } else {
      singles.push(item);
    }
  });
  
  return { clusters, singles };
}

// Componente para rastrear zoom
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });
  return null;
}

export default function MapaUnificado() {
  // Estados de filtros
  const [mostrarDemandas, setMostrarDemandas] = useState(true);
  const [mostrarMunicipes, setMostrarMunicipes] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [areasFiltro, setAreasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [bairroFiltro, setBairroFiltro] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de UI
  const [clusterListItems, setClusterListItems] = useState<(DemandaMapa | MunicipeMapa)[]>([]);
  const [showClusterList, setShowClusterList] = useState(false);
  const [clusterListTipo, setClusterListTipo] = useState<'demanda' | 'municipe'>('demanda');
  const [mapZoom, setMapZoom] = useState(13);
  
  // Estado de seleção
  const [selectedDemanda, setSelectedDemanda] = useState<DemandaMapa | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  
  // Hooks
  const { demandas, municipes, areas, tags, bairrosUnicos, isLoading, refetch } = useMapaUnificado();
  const rota = useMapaRota();
  const { center, zoom, cidade, estado } = useMapConfig();

  // Debug
  useEffect(() => {
    console.log('Mapa - Dados:', { 
      demandas: demandas.length, 
      municipes: municipes.length,
      areas: areas.length,
      tags: tags.length 
    });
  }, [demandas, municipes, areas, tags]);
  
  // Filtrar demandas
  const demandasFiltradas = useMemo(() => {
    if (!mostrarDemandas) return [];
    
    return demandas.filter(d => {
      if (statusFiltro.length > 0 && !statusFiltro.includes(d.status || 'solicitada')) {
        return false;
      }
      if (areasFiltro.length > 0 && d.area_id && !areasFiltro.includes(d.area_id)) {
        return false;
      }
      if (bairroFiltro && d.bairro !== bairroFiltro) {
        return false;
      }
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const match = 
          d.titulo?.toLowerCase().includes(termo) ||
          d.protocolo?.toLowerCase().includes(termo) ||
          d.bairro?.toLowerCase().includes(termo) ||
          d.municipe_nome?.toLowerCase().includes(termo);
        if (!match) return false;
      }
      return true;
    });
  }, [demandas, mostrarDemandas, statusFiltro, areasFiltro, bairroFiltro, searchTerm]);
  
  // Filtrar munícipes
  const municipesFiltrados = useMemo(() => {
    if (!mostrarMunicipes) return [];
    
    return municipes.filter(m => {
      if (tagsFiltro.length > 0) {
        const temTag = tagsFiltro.some(tagId => m.tag_ids.includes(tagId));
        if (!temTag) return false;
      }
      if (bairroFiltro && m.bairro !== bairroFiltro) {
        return false;
      }
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const match = 
          m.nome?.toLowerCase().includes(termo) ||
          m.bairro?.toLowerCase().includes(termo) ||
          m.telefone?.includes(termo);
        if (!match) return false;
      }
      return true;
    });
  }, [municipes, mostrarMunicipes, tagsFiltro, bairroFiltro, searchTerm]);

  // Criar clusters
  const { clusters: demandaClusters, singles: demandaSingles } = useMemo(() => {
    return criarClusters(demandasFiltradas, mapZoom);
  }, [demandasFiltradas, mapZoom]);

  const { clusters: municipeClusters, singles: municipeSingles } = useMemo(() => {
    return criarClusters(municipesFiltrados, mapZoom);
  }, [municipesFiltrados, mapZoom]);
  
  // Estatísticas
  const stats = useMemo(() => ({
    totalDemandas: demandasFiltradas.length,
    totalMunicipes: municipesFiltrados.length,
  }), [demandasFiltradas, municipesFiltrados]);
  
  // Handlers
  const handleZoomChange = useCallback((newZoom: number) => {
    setMapZoom(newZoom);
  }, []);

  const limparFiltros = useCallback(() => {
    setStatusFiltro([]);
    setAreasFiltro([]);
    setTagsFiltro([]);
    setBairroFiltro('');
    setSearchTerm('');
  }, []);
  
  const toggleStatusFiltro = useCallback((status: string) => {
    setStatusFiltro(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }, []);
  
  const toggleAreaFiltro = useCallback((areaId: string) => {
    setAreasFiltro(prev => 
      prev.includes(areaId) ? prev.filter(a => a !== areaId) : [...prev, areaId]
    );
  }, []);
  
  const toggleTagFiltro = useCallback((tagId: string) => {
    setTagsFiltro(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  }, []);
  
  const adicionarDemandaRota = useCallback((demanda: DemandaMapa) => {
    rota.adicionarPonto({
      id: demanda.id,
      tipo: 'demanda',
      nome: `${demanda.protocolo} - ${demanda.titulo}`,
      latitude: demanda.latitude,
      longitude: demanda.longitude,
      endereco: `${demanda.logradouro || ''} ${demanda.numero || ''}, ${demanda.bairro || ''}`
    });
  }, [rota]);
  
  const adicionarMunicipeRota = useCallback((municipe: MunicipeMapa) => {
    rota.adicionarPonto({
      id: municipe.id,
      tipo: 'municipe',
      nome: municipe.nome,
      latitude: municipe.latitude,
      longitude: municipe.longitude,
      endereco: municipe.endereco || `${municipe.bairro || ''}`
    });
  }, [rota]);

  const abrirClusterDemandas = useCallback((items: DemandaMapa[]) => {
    setClusterListItems(items);
    setClusterListTipo('demanda');
    setShowClusterList(true);
  }, []);

  const abrirClusterMunicipes = useCallback((items: MunicipeMapa[]) => {
    setClusterListItems(items);
    setClusterListTipo('municipe');
    setShowClusterList(true);
  }, []);

  const temFiltrosAtivos = statusFiltro.length > 0 || areasFiltro.length > 0 || tagsFiltro.length > 0 || bairroFiltro || searchTerm;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtros e Rota</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use os filtros na versão desktop</p>
              </div>
            </SheetContent>
          </Sheet>
          
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Mapa
            </h1>
            <p className="text-sm text-muted-foreground">
              {cidade && `${cidade}`}{estado && `/${estado}`} • {stats.totalDemandas} demandas • {stats.totalMunicipes} munícipes
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={rota.modoRota ? "default" : "outline"} 
            size="sm"
            onClick={rota.toggleModoRota}
          >
            <Route className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{rota.modoRota ? "Modo Rota" : "Criar Rota"}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Desktop - INLINE JSX para evitar perda de foco */}
        <div className="hidden lg:flex w-80 border-r flex-col bg-background">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, protocolo, bairro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Camadas */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="h-4 w-4" />
                    Camadas
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="camada-demandas"
                      checked={mostrarDemandas}
                      onCheckedChange={(checked) => setMostrarDemandas(!!checked)}
                    />
                    <label htmlFor="camada-demandas" className="text-sm flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Demandas ({demandas.length})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="camada-municipes"
                      checked={mostrarMunicipes}
                      onCheckedChange={(checked) => setMostrarMunicipes(!!checked)}
                    />
                    <label htmlFor="camada-municipes" className="text-sm flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4 text-indigo-500" />
                      Munícipes ({municipes.length})
                    </label>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              <Separator />
              
              {/* Filtros de Demandas */}
              {mostrarDemandas && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <FileText className="h-4 w-4" />
                      Filtros de Demandas
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {/* Status */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <Badge
                            key={value}
                            variant={statusFiltro.includes(value) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            style={statusFiltro.includes(value) ? { backgroundColor: STATUS_COLORS[value] } : {}}
                            onClick={() => toggleStatusFiltro(value)}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* Áreas */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Áreas ({areas.length})</Label>
                      <div className="flex flex-wrap gap-1">
                        {areas.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Nenhuma área cadastrada</span>
                        ) : (
                          areas.map(area => (
                            <Badge
                              key={area.id}
                              variant={areasFiltro.includes(area.id) ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              style={areasFiltro.includes(area.id) ? { backgroundColor: area.cor || '#6b7280' } : {}}
                              onClick={() => toggleAreaFiltro(area.id)}
                            >
                              {area.nome}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Filtros de Munícipes */}
              {mostrarMunicipes && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Users className="h-4 w-4" />
                      Filtros de Munícipes
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Tags ({tags.length})</Label>
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada</span>
                        ) : (
                          tags.map(tag => (
                            <Badge
                              key={tag.id}
                              variant={tagsFiltro.includes(tag.id) ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              style={tagsFiltro.includes(tag.id) ? { backgroundColor: tag.cor || '#6b7280' } : {}}
                              onClick={() => toggleTagFiltro(tag.id)}
                            >
                              {tag.nome}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              <Separator />
              
              {/* Bairro */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <select
                  value={bairroFiltro}
                  onChange={(e) => setBairroFiltro(e.target.value)}
                  className="w-full p-2 border rounded-md text-sm bg-background"
                >
                  <option value="">Todos os bairros</option>
                  {bairrosUnicos.map(bairro => (
                    <option key={bairro} value={bairro}>{bairro}</option>
                  ))}
                </select>
              </div>
              
              {/* Limpar filtros */}
              {temFiltrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
              
              <Separator />
              
              {/* ROTA */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Route className="h-4 w-4" />
                    Rota ({rota.pontosRota.length} pontos)
                  </div>
                  {rota.pontosRota.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={rota.limparRota}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {rota.modoRota && (
                  <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                    Clique em "+ Rota" nos pontos do mapa
                  </p>
                )}
                
                {rota.pontosRota.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum ponto adicionado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rota.pontosRota.map((ponto, index) => (
                      <div key={ponto.id} className="flex items-center gap-2 p-2 border rounded-md bg-background">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <Button variant="ghost" size="icon" className="h-4 w-4" disabled={index === 0} onClick={() => rota.moverPonto(index, 'up')}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-4 w-4" disabled={index === rota.pontosRota.length - 1} onClick={() => rota.moverPonto(index, 'down')}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ponto.nome}</p>
                          <p className="text-xs text-muted-foreground">{ponto.tipo === 'demanda' ? '📍' : '👤'}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => rota.removerPonto(ponto.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {rota.rotaCalculada && (
                  <div className="p-3 bg-green-50 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Distância:</span>
                      <span className="font-medium">{formatarDistancia(rota.rotaCalculada.distancia)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tempo:</span>
                      <span className="font-medium">{formatarDuracao(rota.rotaCalculada.duracao)}</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => rota.calcularRota('driving')} disabled={rota.pontosRota.length < 2 || rota.calculandoRota}>
                    {rota.calculandoRota ? 'Calculando...' : <><Navigation className="h-4 w-4 mr-2" />Calcular Rota</>}
                  </Button>
                  {rota.pontosRota.length >= 1 && (
                    <Button variant="outline" className="w-full" onClick={rota.abrirNoGoogleMaps}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Google Maps
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        {/* Mapa */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-center">
                <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Carregando mapa...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <ZoomTracker onZoomChange={handleZoomChange} />
              
              <MapBoundsUpdater 
                demandas={demandasFiltradas}
                municipes={municipesFiltrados}
                center={center}
                zoom={zoom}
              />
              
              {/* Rota */}
              {rota.rotaCalculada && (
                <Polyline
                  positions={rota.rotaCalculada.polyline}
                  color="#3b82f6"
                  weight={4}
                  opacity={0.8}
                />
              )}
              
              {/* Clusters de Demandas */}
              {demandaClusters.map((cluster, idx) => (
                <Marker
                  key={`demanda-cluster-${idx}`}
                  position={[cluster.lat, cluster.lng]}
                  icon={new DivIcon({
                    html: `<div style="background:#3b82f6;border:3px solid #1d4ed8;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;">${cluster.items.length}</div>`,
                    className: '',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  })}
                  eventHandlers={{
                    click: () => abrirClusterDemandas(cluster.items)
                  }}
                />
              ))}

              {/* Clusters de Munícipes */}
              {municipeClusters.map((cluster, idx) => (
                <Marker
                  key={`municipe-cluster-${idx}`}
                  position={[cluster.lat, cluster.lng]}
                  icon={new DivIcon({
                    html: `<div style="background:#6366f1;border:3px solid #4338ca;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;">${cluster.items.length}</div>`,
                    className: '',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  })}
                  eventHandlers={{
                    click: () => abrirClusterMunicipes(cluster.items)
                  }}
                />
              ))}
              
              {/* Markers individuais de Demandas */}
              {demandaSingles.map(demanda => {
                const color = STATUS_COLORS[demanda.status || 'default'] || STATUS_COLORS.default;
                const isInRota = rota.pontosRota.some(p => p.id === demanda.id);
                
                return (
                  <Marker
                    key={`demanda-${demanda.id}`}
                    position={[demanda.latitude, demanda.longitude]}
                    icon={createDemandaIcon(color, isInRota)}
                  >
                    <Popup>
                      <div className="p-2 min-w-[220px]">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge style={{ backgroundColor: color }} className="text-white text-xs">
                            {STATUS_LABELS[demanda.status || 'solicitada']}
                          </Badge>
                          <span className="text-xs text-gray-500">{demanda.protocolo}</span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{demanda.titulo}</h3>
                        {demanda.area_nome && (
                          <p className="text-xs text-gray-500 mb-1">Área: {demanda.area_nome}</p>
                        )}
                        {demanda.municipe_nome && (
                          <p className="text-xs text-gray-500 mb-1">👤 {demanda.municipe_nome}</p>
                        )}
                        {demanda.bairro && (
                          <p className="text-xs text-gray-500 mb-2">📍 {demanda.logradouro || ''} {demanda.numero || ''}, {demanda.bairro}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(demanda); setShowViewDialog(true); }}>
                            <Eye className="h-3 w-3 mr-1" />Ver
                          </Button>
                          <Button size="sm" className="flex-1 text-xs h-7" disabled={isInRota} onClick={() => adicionarDemandaRota(demanda)}>
                            <Route className="h-3 w-3 mr-1" />{isInRota ? 'Na Rota' : '+ Rota'}
                          </Button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              
              {/* Markers individuais de Munícipes */}
              {municipeSingles.map(municipe => {
                const color = municipe.tag_cores[0] || '#6366f1';
                const isInRota = rota.pontosRota.some(p => p.id === municipe.id);
                
                return (
                  <Marker
                    key={`municipe-${municipe.id}`}
                    position={[municipe.latitude, municipe.longitude]}
                    icon={createMunicipeIcon(color, isInRota)}
                  >
                    <Popup>
                      <div className="p-2 min-w-[220px]">
                        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                          <Users className="h-4 w-4" />{municipe.nome}
                        </h3>
                        {municipe.telefone && (
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{municipe.telefone}
                          </p>
                        )}
                        {municipe.bairro && (
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <MapPinned className="h-3 w-3" />{municipe.bairro}
                          </p>
                        )}
                        {municipe.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {municipe.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs" style={{ borderColor: municipe.tag_cores[i], color: municipe.tag_cores[i] }}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {municipe.demandas_count > 0 && (
                          <p className="text-xs text-gray-500 mb-2">📋 {municipe.demandas_count} demanda(s) ativa(s)</p>
                        )}
                        <Button size="sm" className="w-full text-xs h-7" disabled={isInRota} onClick={() => adicionarMunicipeRota(municipe)}>
                          <Route className="h-3 w-3 mr-1" />{isInRota ? 'Na Rota' : '+ Rota'}
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
          
          {/* Legenda */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-auto z-[1000]">
            <Card className="p-2">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-medium">Legenda:</span>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                    <span>{label}</span>
                  </div>
                ))}
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-indigo-500" />
                  <span>Munícipe</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
        
        {/* Painel lateral de Cluster */}
        {showClusterList && (
          <div className="w-80 border-l bg-background flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                {clusterListTipo === 'demanda' ? (
                  <><FileText className="h-4 w-4 text-blue-500" /> Demandas ({clusterListItems.length})</>
                ) : (
                  <><Users className="h-4 w-4 text-indigo-500" /> Munícipes ({clusterListItems.length})</>
                )}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowClusterList(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {clusterListItems.map(item => {
                  const isInRota = rota.pontosRota.some(p => p.id === item.id);
                  
                  if (clusterListTipo === 'demanda') {
                    const demanda = item as DemandaMapa;
                    return (
                      <Card key={demanda.id} className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge style={{ backgroundColor: STATUS_COLORS[demanda.status || 'default'] }} className="text-white text-xs">
                            {STATUS_LABELS[demanda.status || 'solicitada']}
                          </Badge>
                          <span className="text-xs text-gray-500">{demanda.protocolo}</span>
                        </div>
                        <p className="text-sm font-medium mb-1">{demanda.titulo}</p>
                        {demanda.bairro && <p className="text-xs text-gray-500 mb-2">📍 {demanda.bairro}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(demanda); setShowViewDialog(true); }}>
                            <Eye className="h-3 w-3 mr-1" />Ver
                          </Button>
                          <Button size="sm" className="flex-1 text-xs h-7" disabled={isInRota} onClick={() => adicionarDemandaRota(demanda)}>
                            <Route className="h-3 w-3 mr-1" />{isInRota ? 'Na Rota' : '+ Rota'}
                          </Button>
                        </div>
                      </Card>
                    );
                  } else {
                    const municipe = item as MunicipeMapa;
                    return (
                      <Card key={municipe.id} className="p-3">
                        <p className="text-sm font-medium flex items-center gap-1 mb-1">
                          <Users className="h-3 w-3" />{municipe.nome}
                        </p>
                        {municipe.telefone && <p className="text-xs text-gray-500 mb-1">📞 {municipe.telefone}</p>}
                        {municipe.bairro && <p className="text-xs text-gray-500 mb-1">📍 {municipe.bairro}</p>}
                        {municipe.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {municipe.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <Button size="sm" className="w-full text-xs h-7" disabled={isInRota} onClick={() => adicionarMunicipeRota(municipe)}>
                          <Route className="h-3 w-3 mr-1" />{isInRota ? 'Na Rota' : '+ Rota'}
                        </Button>
                      </Card>
                    );
                  }
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      
      {/* Dialog de visualização de demanda */}
      {selectedDemanda && (
        <ViewDemandaDialog
          demanda={selectedDemanda}
          open={showViewDialog}
          onOpenChange={(open) => {
            setShowViewDialog(open);
            if (!open) setSelectedDemanda(null);
          }}
        />
      )}
    </div>
  );
}
