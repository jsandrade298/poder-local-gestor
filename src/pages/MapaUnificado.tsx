import { useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, Circle, CircleMarker } from 'react-leaflet';
import { Icon } from 'leaflet';
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
  ChevronDown, ChevronUp, Route, Trash2, Users, 
  FileText, Eye, Menu, MapPinned, Locate, Copy, 
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

// === TIPOS ===
type ModoVisualizacao = 'padrao' | 'heatmap_demandas' | 'heatmap_municipes' | 'areas_tags';

interface ClusterUnificado {
  id: string; lat: number; lng: number;
  demandas: DemandaMapa[]; municipes: MunicipeMapa[]; total: number;
}

interface HeatmapPoint {
  lat: number; lng: number; intensity: number;
}

// === FUNÇÕES DE CRIAÇÃO DE ÍCONES ===
// Usando apenas Icon (não DivIcon) igual ao DemandasMap.tsx que funciona
function createDemandaIcon(color: string, isSelected: boolean = false): Icon {
  const size = isSelected ? 42 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
    <circle fill="#fff" cx="12" cy="8.5" r="3"/>
  </svg>`;
  return new Icon({ 
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, 
    iconSize: [size, size], 
    iconAnchor: [size/2, size], 
    popupAnchor: [0, -size] 
  });
}

function createMunicipeIcon(color: string = COR_MUNICIPE, isSelected: boolean = false): Icon {
  const size = isSelected ? 38 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${color}" stroke="#fff" stroke-width="1.5" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="9" r="3"/>
    <path fill="#fff" d="M12 14c-3 0-5.5 1.5-5.5 3.5v.5h11v-.5c0-2-2.5-3.5-5.5-3.5z"/>
  </svg>`;
  return new Icon({ 
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, 
    iconSize: [size, size], 
    iconAnchor: [size/2, size/2], 
    popupAnchor: [0, -size/2] 
  });
}

function createOrigemIcon(): Icon {
  const size = 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${COR_ORIGEM}" stroke="#fff" stroke-width="2" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="12" r="4"/>
    <circle fill="${COR_ORIGEM}" cx="12" cy="12" r="2"/>
  </svg>`;
  return new Icon({ 
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, 
    iconSize: [size, size], 
    iconAnchor: [size/2, size/2] 
  });
}

// Cluster icon usando Icon (não DivIcon)
function createClusterIcon(total: number, temDemandas: boolean, temMunicipes: boolean): Icon {
  const isMisto = temDemandas && temMunicipes;
  const size = Math.min(44 + Math.floor(total / 10) * 4, 60);
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = size > 50 ? 15 : 13;
  
  let svg: string;
  if (isMisto) {
    // Cluster misto: metade azul, metade verde
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <clipPath id="leftClip"><rect x="0" y="0" width="${cx}" height="${size}"/></clipPath>
        <clipPath id="rightClip"><rect x="${cx}" y="0" width="${cx}" height="${size}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_DEMANDA}" clip-path="url(#leftClip)"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_MUNICIPE}" clip-path="url(#rightClip)"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="4"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="${fontSize}" font-family="Arial" stroke="#000" stroke-width="2" paint-order="stroke">${total}</text>
    </svg>`;
  } else {
    const cor = temDemandas ? COR_DEMANDA : COR_MUNICIPE;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}" stroke="#fff" stroke-width="3"/>
      <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="${fontSize}" font-family="Arial">${total}</text>
    </svg>`;
  }
  
  return new Icon({ 
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, 
    iconSize: [size, size], 
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
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

// === HEATMAP ===
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
    cell.lat = (cell.lat * (cell.count - 1) + item.latitude) / cell.count;
    cell.lng = (cell.lng * (cell.count - 1) + item.longitude) / cell.count;
  });
  
  const points: HeatmapPoint[] = [];
  let maxCount = 1;
  grid.forEach(cell => { if (cell.count > maxCount) maxCount = cell.count; });
  grid.forEach(cell => {
    points.push({ lat: cell.lat, lng: cell.lng, intensity: cell.count / maxCount });
  });
  
  return points;
}

// === MAP EVENTS ===
function MapEvents({ onZoomEnd }: { onZoomEnd: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoomEnd(map.getZoom()) });
  return null;
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
  
  // Clustering (modo padrão) - NÃO CRIA ÍCONES AQUI
  const { clusters, demandaIndividuais, municipeIndividuais } = useMemo(() => {
    if (modoVisualizacao !== 'padrao') return { clusters: [], demandaIndividuais: [], municipeIndividuais: [] };
    return calcularClusters(demandasFiltradas, municipesFiltrados, mapZoom);
  }, [demandasFiltradas, municipesFiltrados, mapZoom, modoVisualizacao]);
  
  // Heatmap points - SÓ DADOS, SEM ÍCONES
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

  const handleModoChange = useCallback((modo: ModoVisualizacao) => {
    setModoVisualizacao(modo);
    setSelectedCluster(null);
    if (modo !== 'areas_tags') {
      setAreaVisualizacao('todas');
      setTagsVisualizacao([]);
    }
  }, []);

  const temFiltros = statusFiltro.length > 0 || areasFiltro.length > 0 || tagsFiltro.length > 0 || bairroFiltro || searchTerm;

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
                      <span className="flex items-center gap-2"><Layers className="h-4 w-4" />Padrão (Clusters)</span>
                    </SelectItem>
                    <SelectItem value="heatmap_demandas">
                      <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-blue-500" />Calor - Demandas</span>
                    </SelectItem>
                    <SelectItem value="heatmap_municipes">
                      <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-green-500" />Calor - Munícipes</span>
                    </SelectItem>
                    <SelectItem value="areas_tags">
                      <span className="flex items-center gap-2"><Grid3X3 className="h-4 w-4 text-purple-500" />Áreas x Tags</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* FILTROS POR MODO */}
              {modoVisualizacao === 'padrao' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  
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
              
              {modoVisualizacao === 'heatmap_demandas' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-2"><Flame className="h-4 w-4" />Mapa de Calor - Demandas</p>
                    <p className="text-xs text-blue-600 mt-1">Áreas mais escuras = maior concentração</p>
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
              
              {modoVisualizacao === 'heatmap_municipes' && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-2"><Flame className="h-4 w-4" />Mapa de Calor - Munícipes</p>
                    <p className="text-xs text-green-600 mt-1">Áreas mais escuras = maior concentração</p>
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
              
              {modoVisualizacao === 'areas_tags' && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-medium text-purple-800 flex items-center gap-2"><Grid3X3 className="h-4 w-4" />Áreas x Tags</p>
                    <p className="text-xs text-purple-600 mt-1">Demandas por área + Munícipes por tags</p>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Área das Demandas</Label>
                    <Select value={areaVisualizacao} onValueChange={setAreaVisualizacao}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as Áreas</SelectItem>
                        {areas.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.cor || '#666' }} />
                              {a.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Tags dos Munícipes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.length === 0 ? <span className="text-xs text-muted-foreground italic">Nenhuma</span> :
                        tags.map(t => (
                          <Badge key={t.id} variant={tagsVisualizacao.includes(t.id) ? "default" : "outline"} className="cursor-pointer text-xs"
                            style={tagsVisualizacao.includes(t.id) ? { backgroundColor: t.cor || '#666' } : {}}
                            onClick={() => toggleTagVisualizacao(t.id)}>{t.nome}</Badge>
                        ))}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between"><span>Demandas:</span><span className="font-medium">{demandasFiltradas.length}</span></div>
                    <div className="flex justify-between"><span>Munícipes:</span><span className="font-medium">{municipesFiltrados.length}</span></div>
                  </div>
                </div>
              )}
              
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
                  <span className="font-medium flex items-center gap-2"><Car className="h-4 w-4" />Roteiro</span>
                  {rota.pontosRota.length > 0 && <Button variant="ghost" size="sm" onClick={rota.limparRota}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium"><CircleDot className="h-4 w-4 text-red-500 flex-shrink-0" />Origem</div>
                  {rota.pontoOrigem ? (
                    <div className="flex items-center justify-between">
                      <div className="text-sm min-w-0"><p className="font-medium truncate">{rota.pontoOrigem.nome}</p></div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={rota.limparOrigem}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" onClick={rota.usarLocalizacaoAtual} disabled={rota.buscandoLocalizacao}>
                      <Locate className="h-4 w-4 mr-2" />{rota.buscandoLocalizacao ? 'Obtendo...' : 'Minha Localização'}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><MapPinned className="h-4 w-4" />Paradas ({rota.pontosRota.length})</div>
                  {rota.pontosRota.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3 border-2 border-dashed rounded-lg">Clique em <strong>+ Rota</strong> nos pontos</p>
                  ) : (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {rota.pontosRota.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 p-2 border rounded text-xs bg-background">
                          <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                          <span className="flex-1 truncate">{p.nome}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive flex-shrink-0" onClick={() => rota.removerPonto(p.id)}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {rota.rotaCalculada && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-green-700 font-medium"><Navigation2 className="h-4 w-4" />Rota OK!</div>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
                      <span>{formatarDistancia(rota.rotaCalculada.distancia)}</span>
                      <span>{formatarDuracao(rota.rotaCalculada.duracao)}</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 pb-4">
                  {!rota.rotaCalculada ? (
                    <Button className="w-full" size="sm" onClick={iniciarRota} disabled={rota.pontosRota.length === 0}>
                      <Navigation className="h-4 w-4 mr-2" />Calcular Rota
                    </Button>
                  ) : (
                    <>
                      <Button className="w-full" size="sm" onClick={() => setShowExportDialog(true)}>
                        <Play className="h-4 w-4 mr-2" />Navegar
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={rota.copiarEnderecos}><Copy className="h-3 w-3 mr-1" />Copiar</Button>
                        <Button variant="outline" size="sm" onClick={() => rota.calcularRotaOtimizada(true)}><RefreshCw className="h-3 w-3 mr-1" />Recalc</Button>
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
              
              {/* Origem */}
              {rota.pontoOrigem && (
                <Marker position={[rota.pontoOrigem.latitude, rota.pontoOrigem.longitude]} icon={createOrigemIcon()}>
                  <Popup><div className="text-center text-sm"><strong>🚗 Origem</strong><br/>{rota.pontoOrigem.nome}</div></Popup>
                </Marker>
              )}
              
              {/* Rota */}
              {rota.rotaCalculada && <Polyline positions={rota.rotaCalculada.polyline} color="#2563eb" weight={5} opacity={0.8} />}
              
              {/* MODO PADRÃO */}
              {modoVisualizacao === 'padrao' && (
                <>
                  {clusters.map(c => (
                    <Marker 
                      key={c.id} 
                      position={[c.lat, c.lng]} 
                      icon={createClusterIcon(c.total, c.demandas.length > 0, c.municipes.length > 0)} 
                      eventHandlers={{ click: () => abrirCluster(c) }} 
                    />
                  ))}
                  
                  {demandaIndividuais.map(d => {
                    const cor = STATUS_COLORS[d.status || 'default'] || STATUS_COLORS.default;
                    const naRota = rota.pontosRota.some(p => p.id === d.id);
                    return (
                      <Marker key={`d-${d.id}`} position={[d.latitude, d.longitude]} icon={createDemandaIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[180px]">
                            <Badge style={{ backgroundColor: cor }} className="text-white text-xs mb-1">{STATUS_LABELS[d.status || 'solicitada']}</Badge>
                            <p className="font-semibold text-sm">{d.titulo}</p>
                            {d.bairro && <p className="text-xs text-gray-500">📍 {d.bairro}</p>}
                            <div className="flex gap-1 mt-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}><Eye className="h-3 w-3 mr-1" />Ver</Button>
                              <Button size="sm" className="flex-1 text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>{naRota ? '✓' : '+'}</Button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  
                  {municipeIndividuais.map(m => {
                    const cor = m.tag_cores[0] || COR_MUNICIPE;
                    const naRota = rota.pontosRota.some(p => p.id === m.id);
                    return (
                      <Marker key={`m-${m.id}`} position={[m.latitude, m.longitude]} icon={createMunicipeIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[180px]">
                            <p className="font-semibold text-sm">👤 {m.nome}</p>
                            {m.telefone && <p className="text-xs text-gray-500">📞 {m.telefone}</p>}
                            {m.bairro && <p className="text-xs text-gray-500">📍 {m.bairro}</p>}
                            <Button size="sm" className="w-full text-xs h-7 mt-2" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>{naRota ? '✓ Rota' : '+ Rota'}</Button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              )}
              
              {/* HEATMAP DEMANDAS */}
              {modoVisualizacao === 'heatmap_demandas' && (
                <>
                  {heatmapDemandas.map((pt, i) => {
                    const radius = Math.max(300, 1500 / Math.pow(2, mapZoom - 10)) * (0.5 + pt.intensity * 0.5);
                    return <Circle key={i} center={[pt.lat, pt.lng]} radius={radius} pathOptions={{ fillColor: COR_DEMANDA, fillOpacity: 0.1 + pt.intensity * 0.5, stroke: true, color: COR_DEMANDA, weight: 1, opacity: 0.3 }} />;
                  })}
                  {demandasFiltradas.map(d => (
                    <CircleMarker key={d.id} center={[d.latitude, d.longitude]} radius={4} pathOptions={{ fillColor: COR_DEMANDA, fillOpacity: 0.8, stroke: true, color: '#fff', weight: 1 }}>
                      <Popup><div className="text-sm"><strong>{d.protocolo}</strong><br/>{d.titulo}</div></Popup>
                    </CircleMarker>
                  ))}
                </>
              )}
              
              {/* HEATMAP MUNÍCIPES */}
              {modoVisualizacao === 'heatmap_municipes' && (
                <>
                  {heatmapMunicipes.map((pt, i) => {
                    const radius = Math.max(300, 1500 / Math.pow(2, mapZoom - 10)) * (0.5 + pt.intensity * 0.5);
                    return <Circle key={i} center={[pt.lat, pt.lng]} radius={radius} pathOptions={{ fillColor: COR_MUNICIPE, fillOpacity: 0.1 + pt.intensity * 0.5, stroke: true, color: COR_MUNICIPE, weight: 1, opacity: 0.3 }} />;
                  })}
                  {municipesFiltrados.map(m => (
                    <CircleMarker key={m.id} center={[m.latitude, m.longitude]} radius={4} pathOptions={{ fillColor: COR_MUNICIPE, fillOpacity: 0.8, stroke: true, color: '#fff', weight: 1 }}>
                      <Popup><div className="text-sm"><strong>{m.nome}</strong>{m.telefone && <><br/>📞 {m.telefone}</>}</div></Popup>
                    </CircleMarker>
                  ))}
                </>
              )}
              
              {/* ÁREAS X TAGS */}
              {modoVisualizacao === 'areas_tags' && (
                <>
                  {demandasFiltradas.map(d => {
                    const cor = d.area_cor || COR_DEMANDA;
                    const naRota = rota.pontosRota.some(p => p.id === d.id);
                    return (
                      <Marker key={`da-${d.id}`} position={[d.latitude, d.longitude]} icon={createDemandaIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[180px]">
                            <Badge style={{ backgroundColor: cor }} className="text-white text-xs">{d.area_nome || 'Sem Área'}</Badge>
                            <p className="font-semibold text-sm mt-1">{d.titulo}</p>
                            <div className="flex gap-1 mt-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}><Eye className="h-3 w-3" /></Button>
                              <Button size="sm" className="flex-1 text-xs h-7" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>{naRota ? '✓' : '+'}</Button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  {municipesFiltrados.map(m => {
                    const cor = m.tag_cores[0] || COR_MUNICIPE;
                    const naRota = rota.pontosRota.some(p => p.id === m.id);
                    return (
                      <Marker key={`ma-${m.id}`} position={[m.latitude, m.longitude]} icon={createMunicipeIcon(cor, naRota)}>
                        <Popup>
                          <div className="p-1 min-w-[180px]">
                            <p className="font-semibold text-sm">👤 {m.nome}</p>
                            {m.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{m.tags.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>}
                            <Button size="sm" className="w-full text-xs h-7 mt-2" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>{naRota ? '✓' : '+'}</Button>
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
            <Card className="p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{modoVisualizacao === 'padrao' ? 'Padrão' : modoVisualizacao === 'heatmap_demandas' ? '🔥 Demandas' : modoVisualizacao === 'heatmap_municipes' ? '🔥 Munícipes' : '📊 Áreas/Tags'}</span>
                {(modoVisualizacao === 'padrao' || modoVisualizacao === 'areas_tags') && (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />D</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />M</span>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
        
        {/* Painel Cluster */}
        {selectedCluster && modoVisualizacao === 'padrao' && (
          <div className="w-72 border-l bg-background flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="font-semibold">{selectedCluster.total} itens</span>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCluster(null)}><X className="h-4 w-4" /></Button>
            </div>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
              <TabsList className="mx-3 mt-2">
                <TabsTrigger value="demandas" disabled={selectedCluster.demandas.length === 0}>D ({selectedCluster.demandas.length})</TabsTrigger>
                <TabsTrigger value="municipes" disabled={selectedCluster.municipes.length === 0}>M ({selectedCluster.municipes.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="demandas" className="flex-1 m-0 overflow-auto">
                <div className="p-3 space-y-2">
                  {selectedCluster.demandas.map(d => {
                    const naRota = rota.pontosRota.some(p => p.id === d.id);
                    return (
                      <Card key={d.id} className="p-2">
                        <Badge style={{ backgroundColor: STATUS_COLORS[d.status || 'default'] }} className="text-white text-xs">{STATUS_LABELS[d.status || 'solicitada']}</Badge>
                        <p className="text-sm font-medium mt-1">{d.titulo}</p>
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-6" onClick={() => { setSelectedDemanda(d); setShowViewDialog(true); }}>Ver</Button>
                          <Button size="sm" className="flex-1 text-xs h-6" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addDemandaRota(d)}>{naRota ? '✓' : '+'}</Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="municipes" className="flex-1 m-0 overflow-auto">
                <div className="p-3 space-y-2">
                  {selectedCluster.municipes.map(m => {
                    const naRota = rota.pontosRota.some(p => p.id === m.id);
                    return (
                      <Card key={m.id} className="p-2">
                        <p className="text-sm font-medium">👤 {m.nome}</p>
                        {m.telefone && <p className="text-xs text-gray-500">📞 {m.telefone}</p>}
                        <Button size="sm" className="w-full text-xs h-6 mt-2" variant={naRota ? "secondary" : "default"} onClick={() => !naRota && addMunicipeRota(m)}>{naRota ? '✓' : '+'}</Button>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
      
      {/* Dialogs */}
      <Dialog open={showRotaDialog} onOpenChange={setShowRotaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Calcular Rota</DialogTitle><DialogDescription>Otimizar ordem das visitas</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Origem</Label>
              {rota.pontoOrigem ? (
                <div className="p-2 border rounded mt-1 flex items-center justify-between">
                  <span className="text-sm">{rota.pontoOrigem.nome}</span>
                  <Button variant="ghost" size="sm" onClick={rota.limparOrigem}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full mt-1" onClick={rota.usarLocalizacaoAtual} disabled={rota.buscandoLocalizacao}>
                  <Locate className="h-4 w-4 mr-2" />{rota.buscandoLocalizacao ? 'Obtendo...' : 'Usar Localização'}
                </Button>
              )}
            </div>
            <div>
              <Label>{rota.pontosRota.length} Paradas</Label>
              <div className="max-h-[150px] overflow-auto mt-1 space-y-1">
                {rota.pontosRota.map((p, i) => (
                  <div key={p.id} className="p-2 border rounded text-sm flex items-center gap-2">
                    <span className="font-bold">{i + 1}.</span><span className="truncate">{p.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotaDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarCalculoRota} disabled={!rota.pontoOrigem || rota.calculandoRota}>{rota.calculandoRota ? 'Calculando...' : 'Otimizar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Iniciar Navegação</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <Button variant="outline" className="w-full h-14 justify-start gap-3" onClick={() => { rota.abrirNoGoogleMaps(); setShowExportDialog(false); }}>
              <MapPin className="h-5 w-5 text-blue-600" /><div className="text-left"><p className="font-medium">Google Maps</p><p className="text-xs text-muted-foreground">Todas as paradas</p></div>
            </Button>
            <Button variant="outline" className="w-full h-14 justify-start gap-3" onClick={() => { rota.abrirNoWaze(); setShowExportDialog(false); }}>
              <Navigation2 className="h-5 w-5 text-cyan-600" /><div className="text-left"><p className="font-medium">Waze</p><p className="text-xs text-muted-foreground">Primeiro ponto</p></div>
            </Button>
            <Separator />
            <Button variant="ghost" className="w-full justify-start gap-3" onClick={rota.copiarEnderecos}>
              <Copy className="h-5 w-5" /><span>Copiar roteiro</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {selectedDemanda && <ViewDemandaDialog demanda={selectedDemanda} open={showViewDialog} onOpenChange={o => { setShowViewDialog(o); if (!o) setSelectedDemanda(null); }} />}
    </div>
  );
}
