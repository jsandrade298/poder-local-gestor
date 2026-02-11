import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DemandaMapa, MunicipeMapa, AreaMapa, CategoriaMapa } from '@/hooks/useMapaUnificado';
import { GeoJSONLayer, ModoVisualizacao } from '@/components/mapa/GeoJSONLayer';
import { CamadaGeografica } from '@/hooks/useCamadasGeograficas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Download,
  FileText,
  Loader2,
  FileJson,
  FileDown,
  Printer,
  User,
  Layers,
  Eye,
  EyeOff,
  CheckCircle,
  Vote,
  PieChart,
  TrendingUp,
  RotateCcw,
  GripVertical,
  Move,
  Map as MapIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// Tamanhos de papel em mm
// ============================================
const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210×297 mm)' },
  A3: { width: 297, height: 420, label: 'A3 (297×420 mm)' },
  A2: { width: 420, height: 594, label: 'A2 (420×594 mm)' },
  A1: { width: 594, height: 841, label: 'A1 (594×841 mm)' },
  A0: { width: 841, height: 1189, label: 'A0 (841×1189 mm)' },
};

// ============================================
// Opções de camada base (tile layers)
// ============================================
const TILE_LAYERS: Record<string, { url: string; attribution: string; label: string; opacity?: number }> = {
  ruas: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    label: '🗺️ Mapa de Ruas',
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: '🛰️ Satélite',
  },
  satelite_rotulos: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: '🏙️ Satélite com Rótulos',
  },
  branco: {
    url: '',
    attribution: '',
    label: '⬜ Em Branco',
    opacity: 0,
  },
};

// ============================================
// Ícones de marcador simplificados
// ============================================
const STATUS_COLORS: Record<string, string> = {
  'solicitada': '#3b82f6', 'em_producao': '#f59e0b', 'encaminhado': '#8b5cf6',
  'atendido': '#22c55e', 'devolvido': '#ef4444', 'visitado': '#06b6d4',
};

function createSimpleDemandaIcon(status: string | null): L.DivIcon {
  const color = STATUS_COLORS[status || 'solicitada'] || '#3b82f6';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg style="transform:rotate(45deg);width:13px;height:13px;color:white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function createSimpleMunicipeIcon(nome: string, cor: string): L.DivIcon {
  const inicial = nome.charAt(0).toUpperCase();
  return L.divIcon({
    className: 'custom-marker-municipe',
    html: `<div style="position:relative;width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
      <svg viewBox="0 0 24 24" style="width:28px;height:28px;color:${cor};">
        <circle cx="12" cy="12" r="10" fill="currentColor"/>
        <text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="white" font-size="11" font-weight="bold" font-family="Arial">${inicial}</text>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ============================================
// Componente interno: sync do mapa preview
// ============================================
function MapSyncReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

// ============================================
// Corrige coordenadas do mouse quando o mapa
// do modal de exportação está rotacionado,
// para que tooltips/popups fiquem junto ao cursor.
// ============================================
function ExportRotationDragHandler({ rotation }: { rotation: number }) {
  const map = useMap();
  const originalRef = useRef<any>(null);

  useEffect(() => {
    if (!originalRef.current) {
      originalRef.current = map.mouseEventToContainerPoint.bind(map);
    }

    if (rotation === 0) {
      map.mouseEventToContainerPoint = originalRef.current;
      return;
    }

    const container = map.getContainer();
    const rad = -rotation * Math.PI / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    map.mouseEventToContainerPoint = function (e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const rx = dx * cosR - dy * sinR;
      const ry = dx * sinR + dy * cosR;
      return new L.Point(
        rx + container.offsetWidth / 2,
        ry + container.offsetHeight / 2
      );
    };

    return () => {
      if (originalRef.current) {
        map.mouseEventToContainerPoint = originalRef.current;
      }
    };
  }, [map, rotation]);

  return null;
}

// ============================================
// Contra-rotaciona controles, tooltips e popups
// dentro do mapa do modal de exportação.
// Usa a propriedade CSS "rotate" para tooltips
// (não "transform: rotate") para preservar o
// translate3d que o Leaflet aplica inline.
// ============================================
function ExportRotationHelper({ rotation, oversizeFactor }: { rotation: number; oversizeFactor: number }) {
  const map = useMap();
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const container = map.getContainer();

    if (!styleRef.current) {
      const el = document.createElement('style');
      el.id = 'export-map-rotation-styles';
      container.appendChild(el);
      styleRef.current = el;
    }

    const styleEl = styleRef.current;

    if (rotation === 0 || oversizeFactor <= 1) {
      styleEl.textContent = '';
      requestAnimationFrame(() => map.invalidateSize());
      return;
    }

    const counterDeg = -rotation;
    const invScale = (1 / oversizeFactor).toFixed(6);
    const fwdScale = oversizeFactor.toFixed(6);

    styleEl.textContent = `
      .leaflet-control-container {
        transform: rotate(${counterDeg}deg) scale(${invScale}) !important;
        transform-origin: center center !important;
        pointer-events: none;
      }
      .leaflet-control-container .leaflet-control {
        pointer-events: auto;
        transform: scale(${fwdScale});
      }
      .leaflet-top.leaflet-right .leaflet-control { transform-origin: top right; }
      .leaflet-top.leaflet-left .leaflet-control { transform-origin: top left; }
      .leaflet-bottom.leaflet-right .leaflet-control { transform-origin: bottom right; }
      .leaflet-bottom.leaflet-left .leaflet-control { transform-origin: bottom left; }
      .leaflet-popup-content-wrapper {
        transform: rotate(${counterDeg}deg) !important;
        transform-origin: bottom center;
      }
      .leaflet-popup-tip-container {
        transform: rotate(${counterDeg}deg) !important;
        transform-origin: top center;
      }
      /* Usa 'rotate' (não 'transform: rotate') para NÃO sobrescrever
         o 'transform: translate3d(x,y,0)' que o Leaflet define inline
         para posicionar o tooltip. Ambas as propriedades se compõem. */
      .leaflet-tooltip {
        rotate: ${counterDeg}deg !important;
      }
    `;

    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 400);

    return () => clearTimeout(timer);
  }, [map, rotation, oversizeFactor]);

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

// ============================================
// Fallback: carregar script via CDN
// ============================================
function loadScriptFallback(src: string, check: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
    document.head.appendChild(s);
  });
}

// ============================================
// Props do modal
// ============================================
export interface ExportarMapaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
  areas: AreaMapa[];
  categorias: CategoriaMapa[];
  mostrarDemandas: boolean;
  mostrarMunicipes: boolean;
  heatmapVisible: boolean;
  heatmapType: 'demandas' | 'municipes' | 'ambos';
  clusterEnabled: boolean;
  tipoFiltro: 'todos' | 'demandas' | 'municipes' | 'nenhum';
  camadasGeograficas: CamadaGeografica[];
  estatisticasPorRegiao?: Map<string, Map<string, { demandas: number; municipes: number }>>;
  colorirPorDensidade: boolean;
  votosPorCamada?: Map<string, Map<string, number>>;
  totalEleitoresPorCamada?: Map<string, Map<string, number>>;
  modoVisualizacao: ModoVisualizacao;
  statusList: { slug: string; nome: string; cor: string }[];
  rotation: number;
}

// ============================================
// Componente principal
// ============================================
export function ExportarMapaModal({
  open,
  onOpenChange,
  demandas,
  municipes,
  areas,
  categorias,
  mostrarDemandas,
  mostrarMunicipes,
  heatmapVisible,
  heatmapType,
  clusterEnabled,
  tipoFiltro,
  camadasGeograficas,
  estatisticasPorRegiao,
  colorirPorDensidade,
  votosPorCamada,
  totalEleitoresPorCamada,
  modoVisualizacao,
  statusList,
  rotation,
}: ExportarMapaModalProps) {
  // Config states
  const [formato, setFormato] = useState<'pdf' | 'geojson'>('pdf');
  const [tamanhoPapel, setTamanhoPapel] = useState('A4');
  const [orientacao, setOrientacao] = useState<'portrait' | 'landscape'>('landscape');
  const [incluirLegenda, setIncluirLegenda] = useState(true);
  const [titulo, setTitulo] = useState('Mapa - Gestão Territorial');
  const [exportando, setExportando] = useState(false);
  const [capturando, setCapturando] = useState(false);

  // Tile layer selecionada para exportação
  const [tileLayerKey, setTileLayerKey] = useState<string>('ruas');

  // Visibilidade exclusiva para exportação (não altera filtros do mapa principal)
  const [exibirDemandasExport, setExibirDemandasExport] = useState(true);
  const [exibirMunicipesExport, setExibirMunicipesExport] = useState(true);

  // Resetar quando modal abre
  useEffect(() => {
    if (open) {
      setExibirDemandasExport(mostrarDemandas);
      setExibirMunicipesExport(mostrarMunicipes);
    }
  }, [open, mostrarDemandas, mostrarMunicipes]);

  // Estado da legenda draggable
  const [legendPos, setLegendPos] = useState({ x: 12, y: 12 });
  const [legendSize, setLegendSize] = useState({ width: 280, height: 350 });
  const legendDragging = useRef(false);
  const legendResizing = useRef(false);
  const legendDragOffset = useRef({ x: 0, y: 0 });
  const legendStartSize = useRef({ width: 0, height: 0 });
  const legendStartPos = useRef({ x: 0, y: 0 });

  // Refs
  const captureRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 });

  // Medir container para calcular oversize factor
  useEffect(() => {
    if (!open) return;
    const el = mapContainerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Calcular oversize factor para cobertura completa quando rotacionado
  const oversizeFactor = useMemo(() => {
    if (rotation === 0) return 1;
    const rad = rotation * Math.PI / 180;
    const sinA = Math.abs(Math.sin(rad));
    const cosA = Math.abs(Math.cos(rad));
    const { w, h } = containerSize;
    const r = w / h;
    const s = Math.max(cosA + sinA / r, r * sinA + cosA);
    return s * 1.15;
  }, [rotation, containerSize]);

  const oversizePercent = oversizeFactor * 100;
  const offsetPercent = -(oversizeFactor - 1) * 50;

  // Handlers para drag da legenda
  const handleLegendDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    legendDragging.current = true;
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    legendDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleLegendResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    legendResizing.current = true;
    legendStartSize.current = { ...legendSize };
    legendStartPos.current = { x: e.clientX, y: e.clientY };
  }, [legendSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (legendDragging.current && captureRef.current) {
        const container = captureRef.current.getBoundingClientRect();
        let newX = e.clientX - container.left - legendDragOffset.current.x;
        let newY = e.clientY - container.top - legendDragOffset.current.y;
        newX = Math.max(0, Math.min(newX, container.width - legendSize.width));
        newY = Math.max(0, Math.min(newY, container.height - legendSize.height));
        setLegendPos({ x: newX, y: newY });
      }
      if (legendResizing.current) {
        const dx = e.clientX - legendStartPos.current.x;
        const dy = e.clientY - legendStartPos.current.y;
        setLegendSize({
          width: Math.max(160, Math.min(400, legendStartSize.current.width + dx)),
          height: Math.max(150, Math.min(800, legendStartSize.current.height + dy)),
        });
      }
    };
    const handleMouseUp = () => {
      legendDragging.current = false;
      legendResizing.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [legendSize]);

  // Centro calculado
  const centroCalculado = useMemo((): [number, number] => {
    const allPoints = [
      ...demandas.filter(d => d.latitude && d.longitude).map(d => ({ lat: d.latitude!, lng: d.longitude! })),
      ...municipes.filter(m => m.latitude && m.longitude).map(m => ({ lat: m.latitude!, lng: m.longitude! })),
    ];
    if (allPoints.length === 0) return [-23.6639, -46.5310];
    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [demandas, municipes]);

  // Categorias map
  const categoriasMap = useMemo(() => {
    const m = new Map<string, CategoriaMapa>();
    categorias.forEach(c => m.set(c.id, c));
    return m;
  }, [categorias]);

  // Visibilidade efetiva (filtro principal + toggle de exportação)
  const mostrarDemandasEfetivo = mostrarDemandas && exibirDemandasExport;
  const mostrarMunicipesEfetivo = mostrarMunicipes && exibirMunicipesExport;

  // Status visíveis no mapa
  const statusVisiveis = useMemo(() => {
    if (!mostrarDemandasEfetivo) return [];
    const slugs = new Set(demandas.map(d => d.status).filter(Boolean));
    return statusList.filter(s => slugs.has(s.slug));
  }, [demandas, mostrarDemandasEfetivo, statusList]);

  // Categorias visíveis
  const categoriasVisiveis = useMemo(() => {
    if (!mostrarMunicipesEfetivo) return [];
    const ids = new Set(municipes.map(m => m.categoria_id).filter(Boolean));
    return categorias.filter(c => ids.has(c.id));
  }, [municipes, mostrarMunicipesEfetivo, categorias]);

  // Áreas visíveis
  const areasVisiveis = useMemo(() => {
    if (!mostrarDemandasEfetivo) return [];
    const ids = new Set(demandas.map(d => d.area_id).filter(Boolean));
    return areas.filter(a => ids.has(a.id));
  }, [demandas, mostrarDemandasEfetivo, areas]);

  // Display angle
  const displayAngle = useMemo(() => ((rotation % 360) + 360) % 360, [rotation]);

  // Tile layer atual
  const currentTile = TILE_LAYERS[tileLayerKey] || TILE_LAYERS.ruas;

  // Map ready callback
  const handleMapReady = useCallback((map: L.Map) => {
    previewMapRef.current = map;
    setTimeout(() => map.invalidateSize(), 300);
  }, []);

  // ============================================
  // Exportar PDF
  // ============================================
  const exportarPDF = async () => {
    if (!captureRef.current) return;
    setExportando(true);

    try {
      if (previewMapRef.current) {
        previewMapRef.current.invalidateSize();
        await new Promise(r => setTimeout(r, 2000));
      }

      setCapturando(true);
      await new Promise(r => setTimeout(r, 300));

      let html2canvas: any;
      let jsPDF: any;

      try {
        const h2c = await import('html2canvas');
        html2canvas = h2c.default || h2c;
        const jpdf = await import('jspdf');
        jsPDF = jpdf.jsPDF || jpdf.default;
      } catch {
        try {
          await loadScriptFallback(
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
            () => !!(window as any).html2canvas
          );
          await loadScriptFallback(
            'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
            () => !!(window as any).jspdf
          );
          html2canvas = (window as any).html2canvas;
          jsPDF = (window as any).jspdf?.jsPDF;
        } catch (cdnErr) {
          console.error('CDN fallback failed:', cdnErr);
        }
      }

      if (!html2canvas || !jsPDF) {
        toast.error('Bibliotecas não disponíveis. Execute: npm install html2canvas jspdf', { duration: 8000 });
        return;
      }

      const paper = PAPER_SIZES[tamanhoPapel];
      const pw = orientacao === 'landscape' ? paper.height : paper.width;
      const ph = orientacao === 'landscape' ? paper.width : paper.height;

      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 10000,
        onclone: (clonedDoc: Document) => {
          const canvasElements = clonedDoc.querySelectorAll('canvas');
          canvasElements.forEach((c: HTMLCanvasElement) => { c.style.display = 'block'; });
          const svgElements = clonedDoc.querySelectorAll('.leaflet-overlay-pane svg');
          svgElements.forEach((svg: Element) => {
            (svg as HTMLElement).style.display = 'block';
            (svg as HTMLElement).style.overflow = 'visible';
          });
          // Esconder handles de drag/resize no clone do PDF
          const dragHandles = clonedDoc.querySelectorAll('[data-export-hide]');
          dragHandles.forEach((el: Element) => { (el as HTMLElement).style.display = 'none'; });
        },
      });

      setCapturando(false);

      const pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: [pw, ph] });
      const margin = 8;
      const contentW = pw - margin * 2;
      const contentH = ph - margin * 2;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(titulo, pw / 2, margin + 5, { align: 'center' });

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const dataAtual = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      pdf.text(`Exportado em: ${dataAtual}`, pw - margin, margin + 5, { align: 'right' });

      const imgData = canvas.toDataURL('image/png');
      const topOffset = margin + 10;
      const availH = contentH - 10;
      const imgRatio = canvas.width / canvas.height;
      let imgW = contentW;
      let imgH = imgW / imgRatio;
      if (imgH > availH) { imgH = availH; imgW = imgH * imgRatio; }
      const imgX = margin + (contentW - imgW) / 2;
      pdf.addImage(imgData, 'PNG', imgX, topOffset, imgW, imgH);

      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Poder Local Gestor - Gestão Territorial', pw / 2, ph - 3, { align: 'center' });

      pdf.save(`mapa_${tamanhoPapel}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF. Verifique se html2canvas e jspdf estão instalados.');
    } finally {
      setCapturando(false);
      setExportando(false);
    }
  };

  // ============================================
  // Exportar GeoJSON
  // ============================================
  const exportarGeoJSON = () => {
    setExportando(true);
    try {
      const features: any[] = [];

      if (mostrarDemandasEfetivo) {
        demandas.forEach(d => {
          if (d.latitude && d.longitude) {
            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] },
              properties: {
                tipo: 'demanda', id: d.id, titulo: d.titulo, protocolo: d.protocolo,
                status: d.status, prioridade: d.prioridade, area: d.area_nome,
                bairro: d.bairro, cidade: d.cidade, municipe: d.municipe_nome,
                data_prazo: d.data_prazo, created_at: d.created_at,
              },
            });
          }
        });
      }

      if (mostrarMunicipesEfetivo) {
        municipes.forEach(m => {
          if (m.latitude && m.longitude) {
            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
              properties: {
                tipo: 'municipe', id: m.id, nome: m.nome, bairro: m.bairro,
                cidade: m.cidade, tags: m.tags?.map(t => t.nome).join(', '),
                total_demandas: m.demandas_count,
              },
            });
          }
        });
      }

      camadasGeograficas.forEach(camada => {
        if (camada.geojson) {
          const geojson = typeof camada.geojson === 'string' ? JSON.parse(camada.geojson) : camada.geojson;
          if (geojson.features) {
            geojson.features.forEach((f: any) => {
              features.push({ ...f, properties: { ...f.properties, _camada: camada.nome, _tipo: 'camada_geografica' } });
            });
          }
        }
      });

      const geojsonData = {
        type: 'FeatureCollection',
        metadata: {
          exportado_em: new Date().toISOString(), titulo,
          total_demandas: demandas.filter(d => d.latitude && d.longitude).length,
          total_municipes: municipes.filter(m => m.latitude && m.longitude).length,
          total_camadas: camadasGeograficas.length,
        },
        features,
      };

      const blob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapa_${new Date().toISOString().slice(0, 10)}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`GeoJSON exportado com ${features.length} features!`);
    } catch (err) {
      console.error('Erro ao exportar GeoJSON:', err);
      toast.error('Erro ao gerar GeoJSON.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportar = () => {
    if (formato === 'pdf') exportarPDF();
    else exportarGeoJSON();
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] w-[1550px] h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden"
        style={{ zIndex: 9999 }}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Exportar Mapa
          </DialogTitle>
          <DialogDescription>
            Ajuste a visualização, posicione a legenda e configure o formato de exportação
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* ================================================= */}
          {/* CENTRO: Prévia do Mapa (área de captura)           */}
          {/* ================================================= */}
          <div className="flex-1 flex flex-col min-w-0">
            <div ref={captureRef} className="flex-1 relative min-h-[300px] bg-white overflow-hidden">
              {/* Div invisível para medir o tamanho real do container */}
              <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

              {/* Container com rotação e oversize calculados */}
              {open && (
                <div
                  style={{
                    position: 'absolute',
                    width: rotation !== 0 ? `${oversizePercent}%` : '100%',
                    height: rotation !== 0 ? `${oversizePercent}%` : '100%',
                    top: rotation !== 0 ? `${offsetPercent}%` : '0',
                    left: rotation !== 0 ? `${offsetPercent}%` : '0',
                    transform: rotation !== 0 ? `rotate(${rotation}deg)` : 'none',
                    transformOrigin: 'center center',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s ease, height 0.35s ease, top 0.35s ease, left 0.35s ease',
                  }}
                >
                  <MapContainer
                    center={centroCalculado}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    preferCanvas={true}
                  >
                    <MapSyncReady onReady={handleMapReady} />

                    {/* Helpers de rotação — corrigem tooltips, controles e popups */}
                    <ExportRotationHelper rotation={rotation} oversizeFactor={oversizeFactor} />
                    <ExportRotationDragHandler rotation={rotation} />

                    {/* Tile layer selecionada pelo usuário */}
                    <TileLayer
                      key={tileLayerKey}
                      attribution={currentTile.attribution}
                      url={currentTile.url}
                      crossOrigin="anonymous"
                      {...(currentTile.opacity !== undefined ? { opacity: currentTile.opacity } : {})}
                    />

                    {/* Camadas Geográficas */}
                    {camadasGeograficas.map(camada => (
                      <GeoJSONLayer
                        key={`export-${camada.id}`}
                        data={camada.geojson}
                        cor={camada.cor_padrao}
                        opacidade={camada.opacidade}
                        nome={camada.nome}
                        demandas={demandas}
                        areas={areas}
                        estatisticas={estatisticasPorRegiao?.get(camada.id)}
                        votosPorRegiao={votosPorCamada?.get(camada.id)}
                        totalEleitoresPorRegiao={totalEleitoresPorCamada?.get(camada.id)}
                        modoVisualizacao={modoVisualizacao}
                        tipoFiltro={tipoFiltro}
                        colorirPorDensidade={colorirPorDensidade}
                      />
                    ))}

                    {/* Marcadores — controlados pelos toggles de exportação */}
                    {!heatmapVisible && (
                      <>
                        {mostrarDemandasEfetivo && demandas.map(d =>
                          d.latitude && d.longitude ? (
                            <Marker
                              key={`exp-d-${d.id}`}
                              position={[d.latitude, d.longitude]}
                              icon={createSimpleDemandaIcon(d.status)}
                            />
                          ) : null
                        )}
                        {mostrarMunicipesEfetivo && municipes.map(m =>
                          m.latitude && m.longitude ? (
                            <Marker
                              key={`exp-m-${m.id}`}
                              position={[m.latitude, m.longitude]}
                              icon={createSimpleMunicipeIcon(
                                m.nome,
                                (m.categoria_id && categoriasMap.get(m.categoria_id)?.cor) || '#8b5cf6'
                              )}
                            />
                          ) : null
                        )}
                      </>
                    )}
                  </MapContainer>
                </div>
              )}

              {/* Badge rotação — escondida durante captura */}
              {displayAngle !== 0 && !capturando && (
                <div className="absolute top-3 right-3 z-[500] bg-black/60 text-white text-xs px-2.5 py-1 rounded-full pointer-events-none flex items-center gap-1.5">
                  <RotateCcw className="h-3 w-3" />
                  {displayAngle}°
                </div>
              )}

              {/* ============================================= */}
              {/* LEGENDA FLUTUANTE / ARRASTÁVEL                 */}
              {/* ============================================= */}
              {incluirLegenda && (
                <div
                  style={{
                    position: 'absolute',
                    left: legendPos.x,
                    top: legendPos.y,
                    width: legendSize.width,
                    height: legendSize.height,
                    zIndex: 600,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontSize: '11px',
                    lineHeight: '1.4',
                  }}
                >
                  {/* Header arrastável — escondido no PDF */}
                  <div
                    onMouseDown={handleLegendDragStart}
                    data-export-hide="true"
                    style={{
                      padding: '5px 10px',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'move',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(249,250,251,0.9)',
                      flexShrink: 0,
                      userSelect: 'none',
                    }}
                  >
                    <Move style={{ width: 12, height: 12, color: '#9ca3af', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '10px', color: '#9ca3af', flex: 1 }}>
                      Arraste para posicionar
                    </span>
                  </div>

                  {/* Título "Legenda" — aparece no PDF */}
                  <div style={{ padding: '8px 12px 4px 12px', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
                      Legenda
                    </div>
                  </div>

                  {/* Conteúdo scrollável */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 8px 12px', wordBreak: 'break-word' }}>
                    {/* Modo de Análise */}
                    {modoVisualizacao !== 'padrao' && (
                      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>
                          {modoVisualizacao === 'resolutividade' ? 'Resolutividade' :
                           modoVisualizacao === 'votos' ? 'Votos' :
                           modoVisualizacao === 'predominancia' ? 'DNA do Bairro' : 'Oportunidade'}
                        </div>
                        {modoVisualizacao === 'resolutividade' && (<div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} /><span>Excelente (&gt;80%)</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#eab308', flexShrink: 0 }} /><span>Atenção (50-80%)</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} /><span>Crítico (&lt;50%)</span></div>
                        </div>)}
                        {modoVisualizacao === 'votos' && (<div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#7c3aed', flexShrink: 0 }} /><span>Alta concentração</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#c4b5fd', flexShrink: 0 }} /><span>Baixa concentração</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '9px', color: '#9ca3af' }}>Menos</span>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'linear-gradient(to right, #c4b5fd, #7c3aed)' }} />
                            <span style={{ fontSize: '9px', color: '#9ca3af' }}>Mais</span>
                          </div>
                        </div>)}
                        {modoVisualizacao === 'predominancia' && (<div>
                          {areas.map(area => (
                            <div key={area.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: area.cor || '#6b7280', flexShrink: 0 }} />
                              <span style={{ wordBreak: 'break-word' }}>{area.nome}</span>
                            </div>
                          ))}
                        </div>)}
                        {modoVisualizacao === 'comparativo' && (<div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef4444', flexShrink: 0 }} /><span>Risco</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#3b82f6', flexShrink: 0 }} /><span>Equilíbrio</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#22c55e', flexShrink: 0 }} /><span>Potencial</span></div>
                        </div>)}
                      </div>
                    )}

                    {/* Status das demandas */}
                    {statusVisiveis.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Demandas por Status</div>
                        {statusVisiveis.map(s => (
                          <div key={s.slug} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.cor, flexShrink: 0 }} />
                            <span style={{ flex: 1, wordBreak: 'break-word' }}>{s.nome}</span>
                            <span style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{demandas.filter(d => d.status === s.slug).length}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Categorias de munícipes */}
                    {categoriasVisiveis.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Munícipes por Categoria</div>
                        {categoriasVisiveis.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c.cor, flexShrink: 0 }} />
                            <span style={{ flex: 1, wordBreak: 'break-word' }}>{c.nome}</span>
                            <span style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{municipes.filter(m => m.categoria_id === c.id).length}</span>
                          </div>
                        ))}
                        {municipes.some(m => !m.categoria_id) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8b5cf6', flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>Sem categoria</span>
                            <span style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{municipes.filter(m => !m.categoria_id).length}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Munícipes sem categorias visíveis */}
                    {mostrarMunicipesEfetivo && categoriasVisiveis.length === 0 && municipes.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Munícipes</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8b5cf6', flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>Munícipes</span>
                          <span style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{municipes.length}</span>
                        </div>
                      </div>
                    )}

                    {/* Áreas (modo padrão) */}
                    {areasVisiveis.length > 0 && modoVisualizacao === 'padrao' && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Áreas</div>
                        {areasVisiveis.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: a.cor || '#6b7280', border: `1px solid ${a.cor || '#6b7280'}`, flexShrink: 0 }} />
                            <span style={{ wordBreak: 'break-word' }}>{a.nome}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Camadas geográficas */}
                    {camadasGeograficas.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Camadas Geográficas</div>
                        {camadasGeograficas.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <div style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: `${c.cor_padrao}50`, border: `1px solid ${c.cor_padrao}`, flexShrink: 0 }} />
                            <span style={{ wordBreak: 'break-word' }}>{c.nome}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Heatmap */}
                    {heatmapVisible && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Mapa de Calor</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', width: 50, flexShrink: 0 }}>
                            <div style={{ flex: 1, backgroundColor: '#fee5d9' }} />
                            <div style={{ flex: 1, backgroundColor: '#fcae91' }} />
                            <div style={{ flex: 1, backgroundColor: '#fb6a4a' }} />
                            <div style={{ flex: 1, backgroundColor: '#de2d26' }} />
                            <div style={{ flex: 1, backgroundColor: '#67000d' }} />
                          </div>
                          <span style={{ color: '#9ca3af' }}>
                            {heatmapType === 'demandas' ? 'Demandas' : heatmapType === 'municipes' ? 'Munícipes' : 'Todos'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Totais */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '6px', marginTop: '4px', fontSize: '10px', color: '#9ca3af' }}>
                      {mostrarDemandasEfetivo && <div>{demandas.filter(d => d.latitude && d.longitude).length} demandas no mapa</div>}
                      {mostrarMunicipesEfetivo && <div>{municipes.filter(m => m.latitude && m.longitude).length} munícipes no mapa</div>}
                      {camadasGeograficas.length > 0 && <div>{camadasGeograficas.length} camada(s) geográfica(s)</div>}
                    </div>
                  </div>

                  {/* Handle de redimensionamento — escondido no PDF */}
                  <div
                    onMouseDown={handleLegendResizeStart}
                    data-export-hide="true"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 18,
                      height: 18,
                      cursor: 'nwse-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GripVertical style={{ width: 10, height: 10, color: '#9ca3af', transform: 'rotate(-45deg)' }} />
                  </div>
                </div>
              )}

              {/* Instrução — escondida durante captura */}
              {!capturando && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                  Arraste e use o zoom para definir o recorte
                </div>
              )}
            </div>
          </div>

          {/* ================================================= */}
          {/* DIREITA: Configurações de exportação               */}
          {/* ================================================= */}
          <div className="w-[310px] flex flex-col flex-shrink-0 bg-muted/30 border-l">
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Título */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Título do mapa</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título que aparecerá no PDF"
                    className="text-sm"
                  />
                </div>

                <Separator />

                {/* Formato */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Formato</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFormato('pdf')}
                      className={`flex flex-col items-center gap-2 p-3.5 rounded-lg border-2 transition-all ${
                        formato === 'pdf' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <FileDown className="h-7 w-7" />
                      <span className="text-sm font-medium">PDF</span>
                      <span className="text-[10px] text-muted-foreground">Imagem do mapa</span>
                    </button>
                    <button
                      onClick={() => setFormato('geojson')}
                      className={`flex flex-col items-center gap-2 p-3.5 rounded-lg border-2 transition-all ${
                        formato === 'geojson' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <FileJson className="h-7 w-7" />
                      <span className="text-sm font-medium">GeoJSON</span>
                      <span className="text-[10px] text-muted-foreground">Dados geográficos</span>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Tipo de Visualização do Mapa (camada base) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                    <MapIcon className="h-3.5 w-3.5" />
                    Camada base
                  </Label>
                  <Select value={tileLayerKey} onValueChange={setTileLayerKey}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TILE_LAYERS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Visibilidade na exportação */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Elementos visíveis</Label>
                  <p className="text-[10px] text-muted-foreground -mt-1">
                    Oculte elementos apenas na exportação, sem alterar os filtros do mapa.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs">Demandas</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{demandas.filter(d => d.latitude && d.longitude).length}</Badge>
                      </div>
                      <Switch
                        checked={exibirDemandasExport}
                        onCheckedChange={setExibirDemandasExport}
                        disabled={!mostrarDemandas}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-xs">Munícipes</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{municipes.filter(m => m.latitude && m.longitude).length}</Badge>
                      </div>
                      <Switch
                        checked={exibirMunicipesExport}
                        onCheckedChange={setExibirMunicipesExport}
                        disabled={!mostrarMunicipes}
                      />
                    </div>
                  </div>
                  {(!mostrarDemandas || !mostrarMunicipes) && (
                    <p className="text-[10px] text-amber-600 italic">
                      {!mostrarDemandas && !mostrarMunicipes
                        ? 'Demandas e munícipes estão ocultos nos filtros do mapa.'
                        : !mostrarDemandas
                        ? 'Demandas estão ocultas nos filtros do mapa.'
                        : 'Munícipes estão ocultos nos filtros do mapa.'}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Config PDF */}
                {formato === 'pdf' && (
                  <div className="space-y-4">
                    <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Configurações do PDF</Label>

                    <div className="space-y-2">
                      <Label className="text-xs">Tamanho do papel</Label>
                      <Select value={tamanhoPapel} onValueChange={setTamanhoPapel}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAPER_SIZES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Orientação</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setOrientacao('landscape')}
                          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all ${
                            orientacao === 'landscape' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="w-6 h-4 border-2 rounded-sm" style={{ borderColor: orientacao === 'landscape' ? 'currentColor' : '#d1d5db' }} />
                          Paisagem
                        </button>
                        <button
                          onClick={() => setOrientacao('portrait')}
                          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all ${
                            orientacao === 'portrait' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="w-4 h-6 border-2 rounded-sm" style={{ borderColor: orientacao === 'portrait' ? 'currentColor' : '#d1d5db' }} />
                          Retrato
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Incluir legenda no mapa</Label>
                      <Switch checked={incluirLegenda} onCheckedChange={setIncluirLegenda} />
                    </div>
                    {incluirLegenda && (
                      <p className="text-[10px] text-muted-foreground italic -mt-2">
                        Arraste a legenda sobre o mapa para posicioná-la. Use o canto inferior direito para redimensionar.
                      </p>
                    )}
                  </div>
                )}

                {/* Config GeoJSON */}
                {formato === 'geojson' && (
                  <div className="space-y-4">
                    <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Conteúdo do GeoJSON</Label>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-red-500" /><span>Demandas</span></div>
                        <Badge variant="secondary" className="text-xs">{mostrarDemandasEfetivo ? demandas.filter(d => d.latitude && d.longitude).length : 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-purple-500" /><span>Munícipes</span></div>
                        <Badge variant="secondary" className="text-xs">{mostrarMunicipesEfetivo ? municipes.filter(m => m.latitude && m.longitude).length : 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-blue-500" /><span>Camadas</span></div>
                        <Badge variant="secondary" className="text-xs">{camadasGeograficas.length}</Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Arquivo GeoJSON compatível com QGIS, Google Earth e softwares de geoprocessamento.
                    </p>
                  </div>
                )}

                <Separator />

                {/* Resumo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Resumo</Label>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {mostrarDemandasEfetivo && (
                      <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{demandas.filter(d => d.latitude && d.longitude).length} demandas</span></div>
                    )}
                    {mostrarDemandas && !exibirDemandasExport && (
                      <div className="flex items-center gap-1.5 text-amber-600"><EyeOff className="h-3 w-3" /><span>Demandas ocultas na exportação</span></div>
                    )}
                    {mostrarMunicipesEfetivo && (
                      <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{municipes.filter(m => m.latitude && m.longitude).length} munícipes</span></div>
                    )}
                    {mostrarMunicipes && !exibirMunicipesExport && (
                      <div className="flex items-center gap-1.5 text-amber-600"><EyeOff className="h-3 w-3" /><span>Munícipes ocultos na exportação</span></div>
                    )}
                    {camadasGeograficas.length > 0 && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{camadasGeograficas.length} camada(s)</span></div>}
                    {heatmapVisible && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>Mapa de calor ativo</span></div>}
                    {displayAngle !== 0 && <div className="flex items-center gap-1.5"><RotateCcw className="h-3 w-3" /><span>Rotação: {displayAngle}°</span></div>}
                    {tileLayerKey !== 'ruas' && (
                      <div className="flex items-center gap-1.5"><MapIcon className="h-3 w-3" /><span>Base: {TILE_LAYERS[tileLayerKey]?.label}</span></div>
                    )}
                    {modoVisualizacao !== 'padrao' && (
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3" />
                        <span>Análise: {
                          modoVisualizacao === 'resolutividade' ? 'Resolutividade' :
                          modoVisualizacao === 'votos' ? 'Votos' :
                          modoVisualizacao === 'predominancia' ? 'DNA do Bairro' : 'Oportunidade'
                        }</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Botão exportar */}
            <div className="p-4 border-t bg-background">
              <Button
                onClick={handleExportar}
                disabled={exportando}
                className="w-full h-11 text-sm font-medium"
                size="lg"
              >
                {exportando ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
                ) : formato === 'pdf' ? (
                  <><Printer className="h-4 w-4 mr-2" />Exportar PDF ({tamanhoPapel})</>
                ) : (
                  <><FileJson className="h-4 w-4 mr-2" />Exportar GeoJSON</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
