import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, RefreshCw, Search, X, Layers, Navigation, 
  ChevronDown, ChevronUp, Route, Trash2, ExternalLink, Users, 
  FileText, Eye, Menu, Phone, MapPinned, Locate, Copy, 
  Navigation2, Car, Play, CircleDot, Flame, Grid3X3, Map
} from 'lucide-react';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useMapaRota, formatarDistancia, formatarDuracao } from '@/hooks/useMapaRota';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';

// === CORES ===
const STATUS_COLORS: Record<string, string> = {
  solicitada: '#3b82f6', em_producao: '#f59e0b', encaminhado: '#8b5cf6',
  devolvido: '#ef4444', visitado: '#06b6d4', atendido: '#10b981', default: '#6b7280'
};

const STATUS_LABELS: Record<string, string> = {
  solicitada: 'Solicitada', em_producao: 'Em Produção', encaminhado: 'Encaminhado',
  devolvido: 'Devolvido', visitado: 'Visitado', atendido: 'Atendido'
};

const COR_DEMANDA = '#2563eb';
const COR_MUNICIPE = '#059669';
const COR_ORIGEM = '#dc2626';

// Cores para heatmap (gradiente)
const HEATMAP_COLORS = {
  demanda: ['rgba(37, 99, 235, 0.1)', 'rgba(37, 99, 235, 0.3)', 'rgba(37, 99, 235, 0.5)', 'rgba(37, 99, 235, 0.7)', 'rgba(37, 99, 235, 0.9)'],
  municipe: ['rgba(5, 150, 105, 0.1)', 'rgba(5, 150, 105, 0.3)', 'rgba(5, 150, 105, 0.5)', 'rgba(5, 150, 105, 0.7)', 'rgba(5, 150, 105, 0.9)']
};

// === TIPOS ===
type ModoVisualizacao = 'padrao' | 'heatmap_demandas' | 'heatmap_municipes' | 'areas_tags';

interface ClusterUnificado {
  id: string; lat: number; lng: number;
  demandas: DemandaMapa[]; municipes: MunicipeMapa[]; total: number;
}

interface HeatmapPoint {
  lat: number; lng: number; intensity: number;
}

// === ÍCONES ===
function createDemandaIcon(color: string, isSelected: boolean = false): L.Icon {
  const size = isSelected ? 42 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
    <circle fill="#fff" cx="12" cy="8.5" r="3"/>
  </svg>`;
  return new L.Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size] });
}

function createMunicipeIcon(color: string = COR_MUNICIPE, isSelected: boolean = false): L.Icon {
  const size = isSelected ? 38 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${color}" stroke="#fff" stroke-width="1.5" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="9" r="3"/>
    <path fill="#fff" d="M12 14c-3 0-5.5 1.5-5.5 3.5v.5h11v-.5c0-2-2.5-3.5-5.5-3.5z"/>
  </svg>`;
  return new L.Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2] });
}

function createOrigemIcon(): L.Icon {
  const size = 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${COR_ORIGEM}" stroke="#fff" stroke-width="2" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="12" r="4"/>
    <circle fill="${COR_ORIGEM}" cx="12" cy="12" r="2"/>
  </svg>`;
  return new L.Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function createClusterIcon(cluster: ClusterUnificado): L.DivIcon {
  const temDemandas = cluster.demandas.length > 0;
  const temMunicipes = cluster.municipes.length > 0;
  const isMisto = temDemandas && temMunicipes;
  const size = Math.min(44 + Math.floor(cluster.total / 10) * 4, 60);
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = size > 50 ? 15 : 13;
  
  let svg: string;
  if (isMisto) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <clipPath id="left${cluster.id}"><rect x="0" y="0" width="${cx}" height="${size}"/></clipPath>
        <clipPath id="right${cluster.id}"><rect x="${cx}" y="0" width="${cx}" height="${size}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_DEMANDA}" clip-path="url(#left${cluster.id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_MUNICIPE}" clip-path="url(#right${cluster.id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="4"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="${fontSize}" font-family="Arial" stroke="#000" stroke-width="2" paint-order="stroke">${cluster.total}</text>
    </svg>`;
  } else {
    const cor = temDemandas ? COR_DEMANDA : COR_MUNICIPE;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}" stroke="#fff" stroke-width="3"/>
      <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="${fontSize}" font-family="Arial">${cluster.total}</text>
    </svg>`;
  }
  return new L.DivIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

// === CLUSTERING ===
function calcularClusters(demandas: DemandaMapa[], municipes: MunicipeMapa[], zoom: number) {
  const cellSize = 360 / Math.pow(2, zoom + 2);
  const grid = new Map<string, { demandas: DemandaMapa[]; municipes: MunicipeMapa[] }>();
  const getKey = (lat: number, lng: number) => `${Math.floor(lng / cellSize)}_${Math.floor(lat / cellSize)}`;
  
  demandas.forEach(d => {
    const key = getKey(d.latitude, d.longitude);
    if (!grid.has(key)) grid.set(key, { demandas: [], municipes: [] });
    grid.get(key)!.demandas.push(d);
  });
  
  municipes.forEach(m => {
    const key = getKey(m.latitude, m.longitude);
    if (!grid.has(key)) grid.set(key, { demandas: [], municipes: [] });
    grid.get(key)!.municipes.push(m);
  });
  
  const clusters: ClusterUnificado[] = [];
  const demandaIndividuais: DemandaMapa[] = [];
  const municipeIndividuais: MunicipeMapa[] = [];
  
  grid.forEach((cell, key) => {
    const total = cell.demandas.length + cell.municipes.length;
    if (total === 0) return;
    
    const lats = [...cell.demandas.map(d => d.latitude), ...cell.municipes.map(m => m.latitude)];
    const lngs = [...cell.demandas.map(d => d.longitude), ...cell.municipes.map(m => m.longitude)];
    const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    
    if (total === 1) {
      if (cell.demandas.length === 1) demandaIndividuais.push(cell.demandas[0]);
      else municipeIndividuais.push(cell.municipes[0]);
    } else {
      clusters.push({ id: key, lat, lng, demandas: cell.demandas, municipes: cell.municipes, total });
    }
  });
  
  return { clusters, demandaIndividuais, municipeIndividuais };
}

// === HEATMAP - Calcular pontos com intensidade ===
function calcularHeatmapPoints<T extends { latitude: number; longitude: number }>(
  items: T[],
  zoom: number
): HeatmapPoint[] {
  const cellSize = 360 / Math.pow(2, zoom + 1);
  const grid = new Map<string, { lat: number; lng: number; count: number }>();
  
  items.forEach(item => {
    const keyX = Math.floor(item.longitude / cellSize);
    const keyY = Math.floor(item.latitude / cellSize);
    const key = `${keyX}_${keyY}`;
    
    if (!grid.has(key)) {
      grid.set(key, { lat: item.latitude, lng: item.longitude, count: 0 });
    }
    const cell = grid.get(key)!;
    cell.count++;
    // Ajustar centro para média
    cell.lat = (cell.lat * (cell.count - 1) + item.latitude) / cell.count;
    cell.lng = (cell.lng * (cell.count - 1) + item.longitude) / cell.count;
  });
  
  const points: HeatmapPoint[] = [];
  let maxCount = 1;
  
  grid.forEach(cell => {
    if (cell.count > maxCount) maxCount = cell.count;
  });
  
  grid.forEach(cell => {
    points.push({
      lat: cell.lat,
      lng: cell.lng,
      intensity: cell.count / maxCount
    });
  });
  
  return points;
}

// === MAP EVENTS ===
function MapEvents({ onZoomEnd }: { onZoomEnd: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoomEnd(map.getZoom()) });
  return null;
}

// === COMPONENTE HEATMAP CIRCLE ===
function HeatmapCircle({ point, tipo, zoom }: { point: HeatmapPoint; tipo: 'demanda' | 'municipe'; zoom: number }) {
  const baseRadius = Math.max(500, 2000 / Math.pow(2, zoom - 10));
  const radius = baseRadius * (0.5 + point.intensity * 0.5);
  const colors = HEATMAP_COLORS[tipo];
  const colorIndex = Math.min(Math.floor(point.intensity * colors.length), colors.length - 1);
  
  return (
    <Circle
      center={[point.lat, point.lng]}
      radius={radius}
      pathOptions={{
        fillColor: tipo === 'demanda' ? COR_DEMANDA : COR_MUNICIPE,
        fillOpacity: 0.1 + point.intensity * 0.5,
        stroke: true,
        color: tipo === 'demanda' ? COR_DEMANDA : COR_MUNICIPE,
        weight: 1,
        opacity: 0.3
      }}
    />
  );
}

// === COMPONENTE PRINCIPAL ===
export default function MapaUnificado() {
  // Modo de visualização
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('padrao');
  
  // Filtros
  const [mostrarDemandas, setMostrarDemandas] = useState(true);
  const [mostrarMunicipes, setMostrarMunicipes] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [areasFiltro, setAreasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [bairroFiltro, setBairroFiltro] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtro especial para modo Áreas x Tags
  const [areaVisualizacao, setAreaVisualizacao] = useState<string>('todas');
  const [tagsVisualizacao, setTagsVisualizacao] = useState<string[]>([]);
  
  // Mapa
  const [mapZoom, setMapZoom] = useState(13);
  
  // UI
  const [selectedCluster, setSelectedCluster] = useState<ClusterUnificado | null>(null);
  const [activeTab, setActiveTab] = useState<'demandas' | 'municipes'>('demandas');
  const [selectedDemanda, setSelectedDemanda] = useState<DemandaMapa | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showRotaDialog, setShowRotaDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Hooks
  const { demandas, municipes, areas, tags, bairrosUnicos, isLoading, refetch } = useMapaUnificado();
  const rota = useMapaRota();
  const { center, zoom, cidade, estado } = useMapConfig();
  
  // Filtrar demandas
  const demandasFiltradas = useMemo(() => {
    if (!mostrarDemandas && modoVisualizacao === 'padrao') return [];
    if (modoVisualizacao === 'heatmap_municipes') return [];
    
    return demandas.filter(d => {
      if (modoVisualizacao === 'areas_tags') {
        // No modo Áreas x Tags, filtrar por área selecionada
        if (areaVisualizacao !== 'todas' && d.area_id !== areaVisualizacao) return false;
      } else {
        if (statusFiltro.length > 0 && !statusFiltro.includes(d.status || 'solicitada')) return false;
        if (areasFiltro.length > 0 && d.area_id && !areasFiltro.includes(d.area_id)) return false;
      }
      if (bairroFiltro && d.bairro !== bairroFiltro) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!d.titulo?.toLowerCase().includes(t) && !d.protocolo?.toLowerCase().includes(t) && 
            !d.bairro?.toLowerCase().includes(t) && !d.municipe_nome?.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [demandas, mostrarDemandas, statusFiltro, areasFiltro, bairroFiltro, searchTerm, modoVisualizacao, areaVisualizacao]);
  
  // Filtrar munícipes
  const municipesFiltrados = useMemo(() => {
    if (!mostrarMunicipes && modoVisualizacao === 'padrao') return [];
    if (modoVisualizacao === 'heatmap_demandas') return [];
    
    return municipes.filter(m => {
      if (modoVisualizacao === 'areas_tags') {
        // No modo Áreas x Tags, filtrar por tags selecionadas
        if (tagsVisualizacao.length > 0 && !tagsVisualizacao.some(t => m.tag_ids.includes(t))) return false;
      } else {
        if (tagsFiltro.length > 0 && !tagsFiltro.some(t => m.tag_ids.includes(t))) return false;
      }
      if (bairroFiltro && m.bairro !== bairroFiltro) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!m.nome?.toLowerCase().includes(t) && !m.bairro?.toLowerCase().includes(t) && !m.telefone?.includes(t)) return false;
      }
      return true;
    });
  }, [municipes, mostrarMunicipes, tagsFiltro, bairroFiltro, searchTerm, modoVisualizacao, tagsVisualizacao]);
  
  // Clustering (modo padrão)
  const { clusters, demandaIndividuais, municipeIndividuais } = useMemo(() => {
    if (modoVisualizacao !== 'padrao') return { clusters: [], demandaIndividuais: [], municipeIndividuais: [] };
    return calcularClusters(demandasFiltradas, municipesFiltrados, mapZoom);
  }, [demandasFiltradas, municipesFiltrados, mapZoom, modoVisualizacao]);
  
  // Heatmap points
  const heatmapDemandas = useMemo(() => {
    if (modoVisualizacao !== 'heatmap_demandas') return [];
    return calcularHeatmapPoints(demandasFiltradas, mapZoom);
  }, [demandasFiltradas, mapZoom, modoVisualizacao]);
  
  const heatmapMunicipes = useMemo(() => {
    if (modoVisualizacao !== 'heatmap_municipes') return [];
    return calcularHeatmapPoints(municipesFiltrados, mapZoom);
  }, [municipesFiltrados, mapZoom, modoVisualizacao]);
  
  // Stats
  const stats = useMemo(() => ({
    totalDemandas: demandasFiltradas.length,
    totalMunicipes: municipesFiltrados.length,
  }), [demandasFiltradas, municipesFiltrados]);
  
  // Handlers
  const handleZoomEnd = useCallback((z: number) => setMapZoom(z), []);
  const limparFiltros = useCallback(() => { 
    setStatusFiltro([]); setAreasFiltro([]); setTagsFiltro([]); setBairroFiltro(''); setSearchTerm(''); 
    setAreaVisualizacao('todas'); setTagsVisualizacao([]);
  }, []);
  const toggleStatus = useCallback((s: string) => setStatusFiltro(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);
  const toggleArea = useCallback((a: string) => setAreasFiltro(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]), []);
  const toggleTag = useCallback((t: string) => setTagsFiltro(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]), []);
  const toggleTagVisualizacao = useCallback((t: string) => setTagsVisualizacao(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]), []);
  
  const addDemandaRota = useCallback((d: DemandaMapa) => {
    rota.adicionarPonto({ id: d.id, tipo: 'demanda', nome: `${d.protocolo} - ${d.titulo}`, latitude: d.latitude, longitude: d.longitude, endereco: [d.logradouro, d.numero, d.bairro].filter(Boolean).join(', ') });
  }, [rota]);
  
  const addMunicipeRota = useCallback((m: MunicipeMapa) => {
    rota.adicionarPonto({ id: m.id, tipo: 'municipe', nome: m.nome, latitude: m.latitude, longitude: m.longitude, endereco: m.endereco || m.bairro || '' });
  }, [rota]);
  
  const abrirCluster = useCallback((c: ClusterUnificado) => {
    setSelectedCluster(c);
    setActiveTab(c.demandas.length > 0 ? 'demandas' : 'municipes');
  }, []);
  
  const iniciarRota = useCallback(async () => {
    if (rota.pontosRota.length === 0) return;
    setShowRotaDialog(true);
  }, [rota.pontosRota.length]);

  const confirmarCalculoRota = useCallback(async () => {
    const resultado = await rota.calcularRotaOtimizada(true);
    if (resultado) setShowRotaDialog(false);
  }, [rota]);

  const temFiltros = statusFiltro.length > 0 || areasFiltro.length > 0 || tagsFiltro.length > 0 || bairroFiltro || searchTerm;

  // Mudar modo de visualização
  const handleModoChange = useCallback((modo: ModoVisualizacao) => {
    setModoVisualizacao(modo);
    setSelectedCluster(null);
    // Resetar filtros específicos ao mudar modo
    if (modo !== 'areas_tags') {
      setAreaVisualizacao('todas');
      setTagsVisualizacao([]);
    }
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
              <div className="mt-4">
                <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Mapa</h1>
            <p className="text-sm text-muted-foreground">{cidade}{estado && `/${estado}`} • {stats.totalDemandas} demandas • {stats.totalMunicipes} munícipes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rota.pontosRota.length > 0 && (
            <Badge variant="secondary" className="hidden sm:flex">{rota.pontosRota.length} na rota</Badge>
          )}
          <Button variant="outline" size="icon" onClick={refetch}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      
      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden lg:flex w-80 border-r flex-col bg-background">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* MODO DE VISUALIZAÇÃO */}
              <div className="space-y-2">
                <Label className="font-medium flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Modo de Visualização
                </Label>
                <Select value={modoVisualizacao} onValueChange={(v) => handleModoChange(v as ModoVisualizacao)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        <span>Padrão (Clusters)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="heatmap_demandas">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-blue-500" />
                        <span>Mapa de Calor - Demandas</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="heatmap_municipes">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-green-500" />
                        <span>Mapa de Calor - Munícipes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="areas_tags">
                      <div className="flex items-center gap-2">
                        <Grid3X3 className="h-4 w-4 text-purple-500" />
                        <span>Áreas x Tags</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* FILTROS POR MODO */}
              {modoVisualizacao === 'padrao' && (
                <>
                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  
                  {/* Camadas */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                      <span className="font-medium flex items-center gap-2"><Layers className="h-4 w-4" />Camadas</span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={mostrarDemandas} onCheckedChange={c => setMostrarDemandas(!!c)} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />
                        <span className="text-sm">Demandas ({demandas.length})</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={mostrarMunicipes} onCheckedChange={c => setMostrarMunicipes(!!c)} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />
                        <span className="text-sm">Munícipes ({municipes.length})</span>
                      </label>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Filtros Demandas */}
                  {mostrarDemandas && (
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                        <span className="font-medium text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Demandas</span>
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 pt-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <Badge key={k} variant={statusFiltro.includes(k) ? "default" : "outline"} className="cursor-pointer text-xs"
                                style={statusFiltro.includes(k) ? { backgroundColor: STATUS_COLORS[k] } : {}}
                                onClick={() => toggleStatus(k)}>{v}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Áreas</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {areas.length === 0 ? <span className="text-xs text-muted-foreground italic">Nenhuma</span> :
                              areas.map(a => (
                                <Badge key={a.id} variant={areasFiltro.includes(a.id) ? "default" : "outline"} className="cursor-pointer text-xs"
                                  style={areasFiltro.includes(a.id) ? { backgroundColor: a.cor || '#666' } : {}}
                                  onClick={() => toggleArea(a.id)}>{a.nome}</Badge>
                              ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  
                  {/* Filtros Munícipes */}
                  {mostrarMunicipes && (
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                        <span className="font-medium text-sm flex items-center gap-2"><Users className="h-4 w-4" />Munícipes</span>
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <Label className="text-xs text-muted-foreground">Tags</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.length === 0 ? <span className="text-xs text-muted-foreground italic">Nenhuma</span> :
                            tags.map(t => (
                              <Badge key={t.id} variant={tagsFiltro.includes(t.id) ? "default" : "outline"} className="cursor-pointer text-xs"
                                style={tagsFiltro.includes(t.id) ? { backgroundColor: t.cor || '#666' } : {}}
                                onClick={() => toggleTag(t.id)}>{t.nome}</Badge>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </>
              )}
              
              {/* Filtros Heatmap Demandas */}
              {modoVisualizacao === 'heatmap_demandas' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-2">
                      <Flame className="h-4 w-4" />
                      Mapa de Calor - Demandas
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Visualize a concentração de demandas por região. Áreas mais escuras indicam maior concentração.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Filtrar por Status</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <Badge key={k} variant={statusFiltro.includes(k) ? "default" : "outline"} className="cursor-pointer text-xs"
                          style={statusFiltro.includes(k) ? { backgroundColor: STATUS_COLORS[k] } : {}}
                          onClick={() => toggleStatus(k)}>{v}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Filtros Heatmap Munícipes */}
              {modoVisualizacao === 'heatmap_municipes' && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                      <Flame className="h-4 w-4" />
                      Mapa de Calor - Munícipes
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Visualize a concentração de munícipes por região. Áreas mais escuras indicam maior concentração.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Filtrar por Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.length === 0 ? <span className="text-xs text-muted-foreground italic">Nenhuma</span> :
                        tags.map(t => (
                          <Badge key={t.id} variant={tagsFiltro.includes(t.id) ? "default" : "outline"} className="cursor-pointer text-xs"
                            style={tagsFiltro.includes(t.id) ? { backgroundColor: t.cor || '#666' } : {}}
                            onClick={() => toggleTag(t.id)}>{t.nome}</Badge>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Filtros Áreas x Tags */}
              {modoVisualizacao === 'areas_tags' && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      Demandas por Área x Munícipes por Tags
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      Visualize demandas de uma área específica e os munícipes de determinados grupos (tags).
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Área das Demandas</Label>
                    <Select value={areaVisualizacao} onValueChange={setAreaVisualizacao}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as Áreas</SelectItem>
                        {areas.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.cor || '#666' }} />
                              {a.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Tags dos Munícipes</Label>
                    <p className="text-xs text-muted-foreground mb-2">Selecione os grupos de munícipes para visualizar</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.length === 0 ? <span className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada</span> :
                        tags.map(t => (
                          <Badge key={t.id} variant={tagsVisualizacao.includes(t.id) ? "default" : "outline"} className="cursor-pointer text-xs"
                            style={tagsVisualizacao.includes(t.id) ? { backgroundColor: t.cor || '#666' } : {}}
                            onClick={() => toggleTagVisualizacao(t.id)}>{t.nome}</Badge>
                        ))}
                    </div>
                  </div>
                  
                  {/* Estatísticas do modo */}
                  <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Demandas visíveis:</span>
                      <span className="font-medium">{demandasFiltradas.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Munícipes visíveis:</span>
                      <span className="font-medium">{municipesFiltrados.length}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Bairro (comum a todos os modos) */}
              <div>
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <select value={bairroFiltro} onChange={e => setBairroFiltro(e.target.value)} className="w-full p-2 border rounded text-sm bg-background mt-1">
                  <option value="">Todos</option>
                  {bairrosUnicos.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              
              {temFiltros && <Button variant="ghost" size="sm" onClick={limparFiltros} className="w-full"><X className="h-4 w-4 mr-2" />Limpar filtros</Button>}
              
              <Separator />
              
              {/* ROTA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Roteiro de Visitas
                  </span>
                  {rota.pontosRota.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={rota.limparRota}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
                
                {/* Origem */}
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CircleDot className="h-4 w-4 text-red-500 flex-shrink-0" />
                    Ponto de Origem
                  </div>
                  {rota.pontoOrigem ? (
                    <div className="flex items-center justify-between">
                      <div className="text-sm min-w-0">
                        <p className="font-medium truncate">{rota.pontoOrigem.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{rota.pontoOrigem.endereco}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={rota.limparOrigem}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" onClick={rota.usarLocalizacaoAtual} disabled={rota.buscandoLocalizacao}>
                      <Locate className="h-4 w-4 mr-2" />
                      {rota.buscandoLocalizacao ? 'Obtendo...' : 'Usar Minha Localização'}
                    </Button>
                  )}
                </div>
                
                {/* Lista de Paradas */}
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MapPinned className="h-4 w-4 flex-shrink-0" />
                    Paradas ({rota.pontosRota.length})
                  </div>
                  
                  {rota.pontosRota.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                      Clique em <strong>+ Rota</strong> nos pontos do mapa
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                      {rota.pontosRota.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 p-2 border rounded text-sm bg-background">
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="truncate text-xs font-medium leading-tight">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">{p.tipo === 'demanda' ? '📄' : '👤'}</p>
                          </div>
                          <div className="flex items-center flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => rota.moverPonto(i, 'up')} disabled={i === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => rota.moverPonto(i, 'down')} disabled={i === rota.pontosRota.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => rota.removerPonto(p.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Resultado da Rota */}
                {rota.rotaCalculada && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
                      <Navigation2 className="h-4 w-4 flex-shrink-0" />
                      Rota Otimizada!
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Distância:</span>
                        <p className="font-medium">{formatarDistancia(rota.rotaCalculada.distancia)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tempo:</span>
                        <p className="font-medium">{formatarDuracao(rota.rotaCalculada.duracao)}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Botões de Ação */}
                <div className="space-y-2 pb-4">
                  {!rota.rotaCalculada ? (
                    <Button className="w-full" onClick={iniciarRota} disabled={rota.pontosRota.length === 0}>
                      <Navigation className="h-4 w-4 mr-2" />
                      Calcular Melhor Rota
                    </Button>
                  ) : (
                    <>
                      <Button className="w-full" onClick={() => setShowExportDialog(true)}>
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Navegação
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="w-full" onClick={rota.copiarEnderecos}>
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => rota.calcularRotaOtimizada(true)}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Recalcular
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        {/* Mapa */}
        <div className="flex-1 relative" style={{ zIndex: 0 }}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>
          ) : (
            <MapContainer center={[center.lat, center.lng]} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapEvents onZoomEnd={handleZoomEnd} />
              
              {/* Ponto de Origem */}
              {rota.pontoOrigem && (
                <Marker position={[rota.pontoOrigem.latitude, rota.pontoOrigem.longitude]} icon={createOrigemIcon()}>
                  <Popup>
                    <div className="p-1 text-center">
                      <p className="font-semibold text-sm">🚗 Ponto de Origem</p>
                      <p className="text-xs text-gray-500">{rota.pontoOrigem.nome}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* Rota (polyline) */}
              {rota.rotaCalculada && <Polyline positions={rota.rotaCalculada.polyline} color="#2563eb" weight={5} opacity={0.8} />}
              
              {/* === MODO PADRÃO === */}
              {modoVisualizacao === 'padrao' && (
                <>
                  {/* Clusters */}
                  {clusters.map(c => (
                    <Marker key={c.id} position={[c.lat, c.lng]} icon={createClusterIcon(c)} eventHandlers={{ click: () => abrirCluster(c) }} />
                  ))}
                  
                  {/* Demandas individuais */}
                  {demandaIndividuais.map(d => {
                    const cor = STATUS_COLORS[d.status || 'default'] || STATUS_COLORS.default;
                    const naRota = rota.pontosRota.some(p => p.id === d.id);
                    return (
                      <Marker key={`d-${d.id}`} position={[d.latitude, d.longitude]} icon={createDemandaIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge style={{ backgroundColor: cor }} className="text-white text-xs">{STATUS_LABELS[d.status || 'solicitada']}</Badge>
                              <span className="text-xs text-gray-500">{d.protocolo}</span>
                            </div>
                            <p className="font-semibold text-sm">{d.titulo}</p>
                            {d.area_nome && <p className="text-xs text-gray-500">Área: {d.area_nome}</p>}
                            {d.municipe_nome && <p className="text-xs text-gray-500">👤 {d.municipe_nome}</p>}
                            {d.bairro && <p className="text-xs text-gray-500 mb-2">📍 {d.bairro}</p>}
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}>
                                <Eye className="h-3 w-3 mr-1" />Ver
                              </Button>
                              <Button size="sm" className="flex-1 text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>
                                <Route className="h-3 w-3 mr-1" />{naRota ? '✓' : '+'}
                              </Button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  
                  {/* Munícipes individuais */}
                  {municipeIndividuais.map(m => {
                    const cor = m.tag_cores[0] || COR_MUNICIPE;
                    const naRota = rota.pontosRota.some(p => p.id === m.id);
                    return (
                      <Marker key={`m-${m.id}`} position={[m.latitude, m.longitude]} icon={createMunicipeIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[200px]">
                            <p className="font-semibold text-sm flex items-center gap-1"><Users className="h-4 w-4" />{m.nome}</p>
                            {m.telefone && <p className="text-xs text-gray-500">📞 {m.telefone}</p>}
                            {m.bairro && <p className="text-xs text-gray-500 mb-1">📍 {m.bairro}</p>}
                            {m.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{m.tags.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>}
                            <Button size="sm" className="w-full text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>
                              <Route className="h-3 w-3 mr-1" />{naRota ? '✓ Rota' : '+ Rota'}
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              )}
              
              {/* === MODO HEATMAP DEMANDAS === */}
              {modoVisualizacao === 'heatmap_demandas' && (
                <>
                  {heatmapDemandas.map((point, i) => (
                    <HeatmapCircle key={`hd-${i}`} point={point} tipo="demanda" zoom={mapZoom} />
                  ))}
                  {/* Pontos pequenos para referência */}
                  {demandasFiltradas.map(d => (
                    <CircleMarker key={`dm-${d.id}`} center={[d.latitude, d.longitude]} radius={4}
                      pathOptions={{ fillColor: COR_DEMANDA, fillOpacity: 0.8, stroke: true, color: '#fff', weight: 1 }}>
                      <Popup>
                        <div className="p-1">
                          <p className="font-semibold text-sm">{d.protocolo}</p>
                          <p className="text-xs">{d.titulo}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </>
              )}
              
              {/* === MODO HEATMAP MUNÍCIPES === */}
              {modoVisualizacao === 'heatmap_municipes' && (
                <>
                  {heatmapMunicipes.map((point, i) => (
                    <HeatmapCircle key={`hm-${i}`} point={point} tipo="municipe" zoom={mapZoom} />
                  ))}
                  {/* Pontos pequenos para referência */}
                  {municipesFiltrados.map(m => (
                    <CircleMarker key={`mm-${m.id}`} center={[m.latitude, m.longitude]} radius={4}
                      pathOptions={{ fillColor: COR_MUNICIPE, fillOpacity: 0.8, stroke: true, color: '#fff', weight: 1 }}>
                      <Popup>
                        <div className="p-1">
                          <p className="font-semibold text-sm">{m.nome}</p>
                          {m.telefone && <p className="text-xs">📞 {m.telefone}</p>}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </>
              )}
              
              {/* === MODO ÁREAS X TAGS === */}
              {modoVisualizacao === 'areas_tags' && (
                <>
                  {/* Demandas coloridas por área */}
                  {demandasFiltradas.map(d => {
                    const areaCor = d.area_cor || COR_DEMANDA;
                    const naRota = rota.pontosRota.some(p => p.id === d.id);
                    return (
                      <Marker key={`da-${d.id}`} position={[d.latitude, d.longitude]} icon={createDemandaIcon(areaCor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge style={{ backgroundColor: areaCor }} className="text-white text-xs">{d.area_nome || 'Sem Área'}</Badge>
                              <span className="text-xs text-gray-500">{d.protocolo}</span>
                            </div>
                            <p className="font-semibold text-sm">{d.titulo}</p>
                            {d.municipe_nome && <p className="text-xs text-gray-500">👤 {d.municipe_nome}</p>}
                            {d.bairro && <p className="text-xs text-gray-500 mb-2">📍 {d.bairro}</p>}
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}>
                                <Eye className="h-3 w-3 mr-1" />Ver
                              </Button>
                              <Button size="sm" className="flex-1 text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>
                                <Route className="h-3 w-3 mr-1" />{naRota ? '✓' : '+'}
                              </Button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  
                  {/* Munícipes filtrados por tags */}
                  {municipesFiltrados.map(m => {
                    const cor = m.tag_cores[0] || COR_MUNICIPE;
                    const naRota = rota.pontosRota.some(p => p.id === m.id);
                    return (
                      <Marker key={`ma-${m.id}`} position={[m.latitude, m.longitude]} icon={createMunicipeIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[200px]">
                            <p className="font-semibold text-sm flex items-center gap-1"><Users className="h-4 w-4" />{m.nome}</p>
                            {m.telefone && <p className="text-xs text-gray-500">📞 {m.telefone}</p>}
                            {m.bairro && <p className="text-xs text-gray-500 mb-1">📍 {m.bairro}</p>}
                            {m.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {m.tags.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-xs" style={{ borderColor: m.tag_cores[i], color: m.tag_cores[i] }}>{t}</Badge>
                                ))}
                              </div>
                            )}
                            <Button size="sm" className="w-full text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>
                              <Route className="h-3 w-3 mr-1" />{naRota ? '✓ Rota' : '+ Rota'}
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              )}
            </MapContainer>
          )}
          
          {/* Legenda */}
          <div className="absolute bottom-4 right-4 z-[400]">
            <Card className="p-2">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-medium">
                  {modoVisualizacao === 'padrao' && 'Padrão'}
                  {modoVisualizacao === 'heatmap_demandas' && '🔥 Calor Demandas'}
                  {modoVisualizacao === 'heatmap_municipes' && '🔥 Calor Munícipes'}
                  {modoVisualizacao === 'areas_tags' && '📊 Áreas x Tags'}
                </span>
                {(modoVisualizacao === 'padrao' || modoVisualizacao === 'areas_tags') && (
                  <>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />Demanda</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />Munícipe</span>
                  </>
                )}
                {rota.pontoOrigem && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_ORIGEM }} />Origem</span>}
              </div>
            </Card>
          </div>
        </div>
        
        {/* Painel do Cluster */}
        {selectedCluster && modoVisualizacao === 'padrao' && (
          <div className="w-80 border-l bg-background flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">{selectedCluster.total} itens</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCluster(null)}><X className="h-4 w-4" /></Button>
            </div>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="demandas" disabled={selectedCluster.demandas.length === 0} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />
                  ({selectedCluster.demandas.length})
                </TabsTrigger>
                <TabsTrigger value="municipes" disabled={selectedCluster.municipes.length === 0} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />
                  ({selectedCluster.municipes.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="demandas" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {selectedCluster.demandas.map(d => {
                      const naRota = rota.pontosRota.some(p => p.id === d.id);
                      return (
                        <Card key={d.id} className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge style={{ backgroundColor: STATUS_COLORS[d.status || 'default'] }} className="text-white text-xs">{STATUS_LABELS[d.status || 'solicitada']}</Badge>
                            <span className="text-xs text-gray-500">{d.protocolo}</span>
                          </div>
                          <p className="text-sm font-medium">{d.titulo}</p>
                          {d.bairro && <p className="text-xs text-gray-500 mb-2">📍 {d.bairro}</p>}
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}>
                              <Eye className="h-3 w-3 mr-1" />Ver
                            </Button>
                            <Button size="sm" className="flex-1 text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>
                              <Route className="h-3 w-3 mr-1" />{naRota ? '✓' : '+'}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="municipes" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {selectedCluster.municipes.map(m => {
                      const naRota = rota.pontosRota.some(p => p.id === m.id);
                      return (
                        <Card key={m.id} className="p-3">
                          <p className="text-sm font-medium flex items-center gap-1"><Users className="h-3 w-3" />{m.nome}</p>
                          {m.telefone && <p className="text-xs text-gray-500">📞 {m.telefone}</p>}
                          {m.bairro && <p className="text-xs text-gray-500 mb-1">📍 {m.bairro}</p>}
                          <Button size="sm" className="w-full text-xs h-7 mt-2" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>
                            <Route className="h-3 w-3 mr-1" />{naRota ? '✓' : '+'}
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
      
      {/* Dialog - Calcular Rota */}
      <Dialog open={showRotaDialog} onOpenChange={setShowRotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation className="h-5 w-5" />Calcular Rota Otimizada</DialogTitle>
            <DialogDescription>O sistema irá calcular a melhor ordem de visitas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-medium">Ponto de Origem</Label>
              {rota.pontoOrigem ? (
                <div className="p-3 border rounded-lg flex items-center gap-3">
                  <CircleDot className="h-5 w-5 text-red-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{rota.pontoOrigem.nome}</p>
                    <p className="text-xs text-muted-foreground">{rota.pontoOrigem.endereco}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={rota.limparOrigem}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={rota.usarLocalizacaoAtual} disabled={rota.buscandoLocalizacao}>
                  <Locate className="h-4 w-4 mr-2" />{rota.buscandoLocalizacao ? 'Obtendo...' : 'Usar Minha Localização'}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-medium">{rota.pontosRota.length} Paradas</Label>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {rota.pontosRota.map((p, i) => (
                  <div key={p.id} className="p-2 border rounded flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{p.tipo === 'demanda' ? '📄' : '👤'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotaDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarCalculoRota} disabled={!rota.pontoOrigem || rota.calculandoRota}>
              {rota.calculandoRota ? 'Calculando...' : 'Otimizar e Calcular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog - Exportar Navegação */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation2 className="h-5 w-5" />Iniciar Navegação</DialogTitle>
            <DialogDescription>Escolha o aplicativo de navegação.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="h-16 justify-start gap-4" onClick={() => { rota.abrirNoGoogleMaps(); setShowExportDialog(false); }}>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Google Maps</p>
                <p className="text-xs text-muted-foreground">Abre com todas as paradas</p>
              </div>
            </Button>
            <Button variant="outline" className="h-16 justify-start gap-4" onClick={() => { rota.abrirNoWaze(); setShowExportDialog(false); }}>
              <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                <Navigation2 className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Waze</p>
                <p className="text-xs text-muted-foreground">Navega até o primeiro ponto</p>
              </div>
            </Button>
            <Separator className="my-2" />
            <Button variant="ghost" className="justify-start gap-4" onClick={rota.copiarEnderecos}>
              <Copy className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">Copiar roteiro</p>
                <p className="text-xs text-muted-foreground">Lista para WhatsApp, email</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog - Ver Demanda */}
      {selectedDemanda && <ViewDemandaDialog demanda={selectedDemanda} open={showViewDialog} onOpenChange={o => { setShowViewDialog(o); if (!o) setSelectedDemanda(null); }} />}
    </div>
  );
}
