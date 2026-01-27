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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  MapPin, RefreshCw, Search, X, Layers, Navigation, 
  ChevronDown, ChevronUp, Route, Trash2, ExternalLink, Users, 
  FileText, Eye, Menu, Phone, MapPinned, Locate, Copy, 
  Navigation2, Car, Play, GripVertical, CircleDot
} from 'lucide-react';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useMapaRota, formatarDistancia, formatarDuracao, PontoRota } from '@/hooks/useMapaRota';
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
interface ClusterUnificado {
  id: string; lat: number; lng: number;
  demandas: DemandaMapa[]; municipes: MunicipeMapa[]; total: number;
}

// === ÍCONES ===
function createDemandaIcon(color: string, isSelected: boolean = false): Icon {
  const size = isSelected ? 42 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
    <circle fill="#fff" cx="12" cy="8.5" r="3"/>
  </svg>`;
  return new Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size] });
}

function createMunicipeIcon(color: string = COR_MUNICIPE, isSelected: boolean = false): Icon {
  const size = isSelected ? 38 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${color}" stroke="#fff" stroke-width="1.5" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="9" r="3"/>
    <path fill="#fff" d="M12 14c-3 0-5.5 1.5-5.5 3.5v.5h11v-.5c0-2-2.5-3.5-5.5-3.5z"/>
  </svg>`;
  return new Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2] });
}

function createOrigemIcon(): Icon {
  const size = 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle fill="${COR_ORIGEM}" stroke="#fff" stroke-width="2" cx="12" cy="12" r="10"/>
    <circle fill="#fff" cx="12" cy="12" r="4"/>
    <circle fill="${COR_ORIGEM}" cx="12" cy="12" r="2"/>
  </svg>`;
  return new Icon({ iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`, iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function createClusterIcon(cluster: ClusterUnificado): DivIcon {
  const temDemandas = cluster.demandas.length > 0;
  const temMunicipes = cluster.municipes.length > 0;
  const isMisto = temDemandas && temMunicipes;
  const size = Math.min(44 + Math.floor(cluster.total / 10) * 4, 60);
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  
  let svg: string;
  if (isMisto) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs><clipPath id="left${cluster.id}"><rect x="0" y="0" width="${cx}" height="${size}"/></clipPath>
      <clipPath id="right${cluster.id}"><rect x="${cx}" y="0" width="${cx}" height="${size}"/></clipPath></defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_DEMANDA}" clip-path="url(#left${cluster.id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR_MUNICIPE}" clip-path="url(#right${cluster.id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="3"/>
      <line x1="${cx}" y1="2" x2="${cx}" y2="${size-2}" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="13" font-family="Arial">${cluster.total}</text>
    </svg>`;
  } else {
    const cor = temDemandas ? COR_DEMANDA : COR_MUNICIPE;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}" stroke="#fff" stroke-width="3"/>
      <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="#fff" font-weight="bold" font-size="13" font-family="Arial">${cluster.total}</text>
    </svg>`;
  }
  return new DivIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
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

// === MAP EVENTS ===
function MapEvents({ onZoomEnd }: { onZoomEnd: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoomEnd(map.getZoom()) });
  return null;
}

// === COMPONENTE PRINCIPAL ===
export default function MapaUnificado() {
  // Filtros
  const [mostrarDemandas, setMostrarDemandas] = useState(true);
  const [mostrarMunicipes, setMostrarMunicipes] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [areasFiltro, setAreasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [bairroFiltro, setBairroFiltro] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
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
  
  // Filtros
  const demandasFiltradas = useMemo(() => {
    if (!mostrarDemandas) return [];
    return demandas.filter(d => {
      if (statusFiltro.length > 0 && !statusFiltro.includes(d.status || 'solicitada')) return false;
      if (areasFiltro.length > 0 && d.area_id && !areasFiltro.includes(d.area_id)) return false;
      if (bairroFiltro && d.bairro !== bairroFiltro) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!d.titulo?.toLowerCase().includes(t) && !d.protocolo?.toLowerCase().includes(t) && 
            !d.bairro?.toLowerCase().includes(t) && !d.municipe_nome?.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [demandas, mostrarDemandas, statusFiltro, areasFiltro, bairroFiltro, searchTerm]);
  
  const municipesFiltrados = useMemo(() => {
    if (!mostrarMunicipes) return [];
    return municipes.filter(m => {
      if (tagsFiltro.length > 0 && !tagsFiltro.some(t => m.tag_ids.includes(t))) return false;
      if (bairroFiltro && m.bairro !== bairroFiltro) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!m.nome?.toLowerCase().includes(t) && !m.bairro?.toLowerCase().includes(t) && !m.telefone?.includes(t)) return false;
      }
      return true;
    });
  }, [municipes, mostrarMunicipes, tagsFiltro, bairroFiltro, searchTerm]);
  
  // Clustering
  const { clusters, demandaIndividuais, municipeIndividuais } = useMemo(() => {
    return calcularClusters(demandasFiltradas, municipesFiltrados, mapZoom);
  }, [demandasFiltradas, municipesFiltrados, mapZoom]);
  
  // Stats
  const stats = useMemo(() => ({
    totalDemandas: demandasFiltradas.length,
    totalMunicipes: municipesFiltrados.length,
  }), [demandasFiltradas, municipesFiltrados]);
  
  // Handlers
  const handleZoomEnd = useCallback((z: number) => setMapZoom(z), []);
  const limparFiltros = useCallback(() => { setStatusFiltro([]); setAreasFiltro([]); setTagsFiltro([]); setBairroFiltro(''); setSearchTerm(''); }, []);
  const toggleStatus = useCallback((s: string) => setStatusFiltro(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);
  const toggleArea = useCallback((a: string) => setAreasFiltro(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]), []);
  const toggleTag = useCallback((t: string) => setTagsFiltro(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]), []);
  
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
    if (resultado) {
      setShowRotaDialog(false);
    }
  }, [rota]);

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
              
              <Separator />
              
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
              
              <Separator />
              
              {/* Bairro */}
              <div>
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <select value={bairroFiltro} onChange={e => setBairroFiltro(e.target.value)} className="w-full p-2 border rounded text-sm bg-background mt-1">
                  <option value="">Todos</option>
                  {bairrosUnicos.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              
              {temFiltros && <Button variant="ghost" size="sm" onClick={limparFiltros} className="w-full"><X className="h-4 w-4 mr-2" />Limpar</Button>}
              
              <Separator />
              
              {/* ROTA - Nova Interface */}
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
                    <CircleDot className="h-4 w-4 text-red-500" />
                    Ponto de Origem
                  </div>
                  {rota.pontoOrigem ? (
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-medium">{rota.pontoOrigem.nome}</p>
                        <p className="text-xs text-muted-foreground">{rota.pontoOrigem.endereco}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rota.limparOrigem}>
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
                    <MapPinned className="h-4 w-4" />
                    Paradas ({rota.pontosRota.length})
                  </div>
                  
                  {rota.pontosRota.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                      Clique em <strong>+ Rota</strong> nos pontos do mapa para adicionar paradas
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {rota.pontosRota.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 p-2 border rounded text-sm bg-background">
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">{p.tipo === 'demanda' ? '📄 Demanda' : '👤 Munícipe'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => rota.moverPonto(i, 'up')} disabled={i === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => rota.moverPonto(i, 'down')} disabled={i === rota.pontosRota.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => rota.removerPonto(p.id)}>
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
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                    <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                      <Navigation2 className="h-4 w-4" />
                      Rota Otimizada!
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Distância:</span>
                      <span className="font-medium">{formatarDistancia(rota.rotaCalculada.distancia)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tempo estimado:</span>
                      <span className="font-medium">{formatarDuracao(rota.rotaCalculada.duracao)}</span>
                    </div>
                  </div>
                )}
                
                {/* Botões de Ação */}
                <div className="space-y-2">
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
                        <Button variant="outline" size="sm" onClick={rota.copiarEnderecos}>
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => rota.calcularRotaOtimizada(true)}>
                          <RefreshCw className="h-4 w-4 mr-1" />
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
                            <Route className="h-3 w-3 mr-1" />{naRota ? '✓ Rota' : '+ Rota'}
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
            </MapContainer>
          )}
          
          {/* Legenda */}
          <div className="absolute bottom-4 right-4 z-[400]">
            <Card className="p-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-medium">Legenda:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />Demanda</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />Munícipe</span>
                {rota.pontoOrigem && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_ORIGEM }} />Origem</span>}
              </div>
            </Card>
          </div>
        </div>
        
        {/* Painel do Cluster */}
        {selectedCluster && (
          <div className="w-80 border-l bg-background flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">{selectedCluster.total} itens</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCluster(null)}><X className="h-4 w-4" /></Button>
            </div>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="demandas" disabled={selectedCluster.demandas.length === 0} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_DEMANDA }} />
                  Demandas ({selectedCluster.demandas.length})
                </TabsTrigger>
                <TabsTrigger value="municipes" disabled={selectedCluster.municipes.length === 0} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_MUNICIPE }} />
                  Munícipes ({selectedCluster.municipes.length})
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
                              <Route className="h-3 w-3 mr-1" />{naRota ? '✓ Rota' : '+ Rota'}
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
                            <Route className="h-3 w-3 mr-1" />{naRota ? '✓ Rota' : '+ Rota'}
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
            <DialogDescription>
              O sistema irá calcular a melhor ordem de visitas para otimizar seu trajeto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Origem */}
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
                  <Locate className="h-4 w-4 mr-2" />
                  {rota.buscandoLocalizacao ? 'Obtendo localização...' : 'Usar Minha Localização Atual'}
                </Button>
              )}
            </div>
            
            {/* Paradas */}
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
            
            {/* Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium">💡 Otimização automática</p>
              <p className="text-xs mt-1">A ordem das paradas será reorganizada para minimizar a distância total percorrida.</p>
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
            <DialogDescription>
              Escolha o aplicativo de navegação para iniciar seu roteiro de visitas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="h-16 justify-start gap-4" onClick={() => { rota.abrirNoGoogleMaps(); setShowExportDialog(false); }}>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Google Maps</p>
                <p className="text-xs text-muted-foreground">Abre com todas as paradas no navegador</p>
              </div>
            </Button>
            
            <Button variant="outline" className="h-16 justify-start gap-4" onClick={() => { rota.abrirNoWaze(); setShowExportDialog(false); }}>
              <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                <Navigation2 className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Waze</p>
                <p className="text-xs text-muted-foreground">Navega até o primeiro ponto (melhor no celular)</p>
              </div>
            </Button>
            
            <Separator className="my-2" />
            
            <Button variant="ghost" className="justify-start gap-4" onClick={() => { rota.copiarEnderecos(); }}>
              <Copy className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">Copiar roteiro</p>
                <p className="text-xs text-muted-foreground">Lista de endereços para WhatsApp, email, etc.</p>
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
