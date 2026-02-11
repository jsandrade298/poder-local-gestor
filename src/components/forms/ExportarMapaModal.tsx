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
  CheckCircle,
  Vote,
  PieChart,
  TrendingUp,
  RotateCcw,
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

  // Refs
  const captureRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<L.Map | null>(null);

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

  // Status visíveis no mapa
  const statusVisiveis = useMemo(() => {
    if (!mostrarDemandas) return [];
    const slugs = new Set(demandas.map(d => d.status).filter(Boolean));
    return statusList.filter(s => slugs.has(s.slug));
  }, [demandas, mostrarDemandas, statusList]);

  // Categorias visíveis
  const categoriasVisiveis = useMemo(() => {
    if (!mostrarMunicipes) return [];
    const ids = new Set(municipes.map(m => m.categoria_id).filter(Boolean));
    return categorias.filter(c => ids.has(c.id));
  }, [municipes, mostrarMunicipes, categorias]);

  // Áreas visíveis
  const areasVisiveis = useMemo(() => {
    if (!mostrarDemandas) return [];
    const ids = new Set(demandas.map(d => d.area_id).filter(Boolean));
    return areas.filter(a => ids.has(a.id));
  }, [demandas, mostrarDemandas, areas]);

  // Display angle
  const displayAngle = useMemo(() => ((rotation % 360) + 360) % 360, [rotation]);

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
      // Aguardar tiles carregarem
      if (previewMapRef.current) {
        previewMapRef.current.invalidateSize();
        await new Promise(r => setTimeout(r, 2000));
      }

      // Dynamic imports — tenta npm, fallback CDN
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
        toast.error(
          'Bibliotecas não disponíveis. Execute no terminal: npm install html2canvas jspdf',
          { duration: 8000 }
        );
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
      });

      const pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: [pw, ph] });

      const margin = 8;
      const contentW = pw - margin * 2;
      const contentH = ph - margin * 2;

      // Título
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(titulo, pw / 2, margin + 5, { align: 'center' });

      // Data
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const dataAtual = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      pdf.text(`Exportado em: ${dataAtual}`, pw - margin, margin + 5, { align: 'right' });

      // Imagem
      const imgData = canvas.toDataURL('image/png');
      const topOffset = margin + 10;
      const availH = contentH - 10;
      const imgRatio = canvas.width / canvas.height;
      let imgW = contentW;
      let imgH = imgW / imgRatio;
      if (imgH > availH) { imgH = availH; imgW = imgH * imgRatio; }
      const imgX = margin + (contentW - imgW) / 2;
      pdf.addImage(imgData, 'PNG', imgX, topOffset, imgW, imgH);

      // Rodapé
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Poder Local Gestor - Gestão Territorial', pw / 2, ph - 3, { align: 'center' });

      pdf.save(`mapa_${tamanhoPapel}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF. Verifique se html2canvas e jspdf estão instalados.');
    } finally {
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

      if (mostrarDemandas) {
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

      if (mostrarMunicipes) {
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
  // Legenda component
  // ============================================
  const LegendContent = () => (
    <div className="space-y-3 text-xs">
      {/* ---- Modo de Análise Ativo ---- */}
      {modoVisualizacao !== 'padrao' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {modoVisualizacao === 'resolutividade' && <><CheckCircle className="h-3 w-3" /> Resolutividade</>}
            {modoVisualizacao === 'votos' && <><Vote className="h-3 w-3" /> Votos</>}
            {modoVisualizacao === 'predominancia' && <><PieChart className="h-3 w-3" /> DNA do Bairro</>}
            {modoVisualizacao === 'comparativo' && <><TrendingUp className="h-3 w-3" /> Oportunidade</>}
          </div>

          {modoVisualizacao === 'resolutividade' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]" /><span>Excelente (&gt;80%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#eab308]" /><span>Atenção (50-80%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]" /><span>Crítico (&lt;50%)</span></div>
            </div>
          )}

          {modoVisualizacao === 'votos' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#7c3aed]" /><span>Alta concentração</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#c4b5fd]" /><span>Baixa concentração</span></div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">Menos</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(to right, #c4b5fd, #7c3aed)' }} />
                <span className="text-[10px] text-muted-foreground">Mais</span>
              </div>
            </div>
          )}

          {modoVisualizacao === 'predominancia' && (
            <div className="space-y-1">
              {areas.map(area => (
                <div key={area.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: area.cor || '#6b7280' }} />
                  <span className="truncate">{area.nome}</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Cor da área temática predominante na região
              </p>
            </div>
          )}

          {modoVisualizacao === 'comparativo' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ef4444]" /><span>Risco</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]" /><span>Equilíbrio</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#22c55e]" /><span>Potencial</span></div>
            </div>
          )}

          <Separator />
        </div>
      )}

      {/* ---- Status das demandas ---- */}
      {statusVisiveis.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Demandas por Status</span>
          {statusVisiveis.map(s => (
            <div key={s.slug} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.cor }} />
              <span className="truncate flex-1">{s.nome}</span>
              <span className="text-muted-foreground tabular-nums">{demandas.filter(d => d.status === s.slug).length}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- Categorias de munícipes ---- */}
      {categoriasVisiveis.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Munícipes por Categoria</span>
          {categoriasVisiveis.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
              <span className="truncate flex-1">{c.nome}</span>
              <span className="text-muted-foreground tabular-nums">{municipes.filter(m => m.categoria_id === c.id).length}</span>
            </div>
          ))}
          {municipes.some(m => !m.categoria_id) && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#8b5cf6]" />
              <span className="truncate flex-1">Sem categoria</span>
              <span className="text-muted-foreground tabular-nums">{municipes.filter(m => !m.categoria_id).length}</span>
            </div>
          )}
        </div>
      )}

      {/* ---- Munícipes sem categoria (sem categorias visíveis) ---- */}
      {mostrarMunicipes && categoriasVisiveis.length === 0 && municipes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Munícipes</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#8b5cf6]" />
            <span className="flex-1">Munícipes</span>
            <span className="text-muted-foreground tabular-nums">{municipes.length}</span>
          </div>
        </div>
      )}

      {/* ---- Áreas (no modo padrão) ---- */}
      {areasVisiveis.length > 0 && modoVisualizacao === 'padrao' && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Áreas</span>
          {areasVisiveis.map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: a.cor || '#6b7280', border: `1px solid ${a.cor || '#6b7280'}` }} />
              <span className="truncate">{a.nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- Camadas geográficas ---- */}
      {camadasGeograficas.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Camadas Geográficas</span>
          {camadasGeograficas.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <div className="w-4 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: `${c.cor_padrao}50`, border: `1px solid ${c.cor_padrao}` }} />
              <span className="truncate">{c.nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- Heatmap ---- */}
      {heatmapVisible && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Mapa de Calor</span>
          <div className="flex items-center gap-2">
            <div className="flex h-2.5 rounded-full overflow-hidden w-16 flex-shrink-0">
              <div style={{ flex: 1, backgroundColor: '#fee5d9' }} />
              <div style={{ flex: 1, backgroundColor: '#fcae91' }} />
              <div style={{ flex: 1, backgroundColor: '#fb6a4a' }} />
              <div style={{ flex: 1, backgroundColor: '#de2d26' }} />
              <div style={{ flex: 1, backgroundColor: '#67000d' }} />
            </div>
            <span className="text-muted-foreground">
              {heatmapType === 'demandas' ? 'Demandas' : heatmapType === 'municipes' ? 'Munícipes' : 'Todos'}
            </span>
          </div>
        </div>
      )}

      {/* ---- Rotação ---- */}
      {displayAngle !== 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Orientação</span>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
            <span>Rotação: {displayAngle}°</span>
          </div>
        </div>
      )}

      {/* ---- Totais ---- */}
      <Separator />
      <div className="space-y-0.5 text-[10px] text-muted-foreground">
        {mostrarDemandas && <div>{demandas.filter(d => d.latitude && d.longitude).length} demandas no mapa</div>}
        {mostrarMunicipes && <div>{municipes.filter(m => m.latitude && m.longitude).length} munícipes no mapa</div>}
        {camadasGeograficas.length > 0 && <div>{camadasGeograficas.length} camada(s) geográfica(s)</div>}
      </div>
    </div>
  );

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
            Ajuste a visualização do mapa e configure o formato de exportação
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* ================================================= */}
          {/* ESQUERDA: Legenda (fora da captura, mas inclusa    */}
          {/* no captureRef para PDF quando ativada)             */}
          {/* ================================================= */}
          {incluirLegenda && (
            <div className="w-[220px] flex-shrink-0 border-r bg-muted/20 flex flex-col">
              <div className="px-3 pt-3 pb-2 border-b">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legenda</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-3 py-3">
                  <LegendContent />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ================================================= */}
          {/* CENTRO: Prévia do Mapa (área de captura)           */}
          {/* ================================================= */}
          <div className="flex-1 flex flex-col min-w-0">
            <div ref={captureRef} className="flex-1 relative min-h-[300px] bg-white overflow-hidden">
              {/* Container com rotação aplicada */}
              {open && (
                <div
                  style={{
                    position: 'absolute',
                    inset: rotation !== 0 ? '-25%' : '0',
                    transform: rotation !== 0 ? `rotate(${rotation}deg)` : 'none',
                    transformOrigin: 'center center',
                  }}
                >
                  <MapContainer
                    center={centroCalculado}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                  >
                    <MapSyncReady onReady={handleMapReady} />

                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      crossOrigin="anonymous"
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

                    {/* Marcadores */}
                    {!heatmapVisible && (
                      <>
                        {mostrarDemandas && demandas.map(d =>
                          d.latitude && d.longitude ? (
                            <Marker
                              key={`exp-d-${d.id}`}
                              position={[d.latitude, d.longitude]}
                              icon={createSimpleDemandaIcon(d.status)}
                            />
                          ) : null
                        )}
                        {mostrarMunicipes && municipes.map(m =>
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

              {/* Badge rotação */}
              {displayAngle !== 0 && (
                <div className="absolute top-3 right-3 z-[500] bg-black/60 text-white text-xs px-2.5 py-1 rounded-full pointer-events-none flex items-center gap-1.5">
                  <RotateCcw className="h-3 w-3" />
                  {displayAngle}°
                </div>
              )}

              {/* Instrução */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                Arraste e use o zoom para definir o recorte
              </div>
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
                      <Label className="text-xs">Incluir legenda</Label>
                      <Switch checked={incluirLegenda} onCheckedChange={setIncluirLegenda} />
                    </div>
                  </div>
                )}

                {/* Config GeoJSON */}
                {formato === 'geojson' && (
                  <div className="space-y-4">
                    <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Conteúdo do GeoJSON</Label>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-red-500" /><span>Demandas</span></div>
                        <Badge variant="secondary" className="text-xs">{mostrarDemandas ? demandas.filter(d => d.latitude && d.longitude).length : 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-purple-500" /><span>Munícipes</span></div>
                        <Badge variant="secondary" className="text-xs">{mostrarMunicipes ? municipes.filter(m => m.latitude && m.longitude).length : 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-background rounded-md">
                        <div className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-blue-500" /><span>Camadas</span></div>
                        <Badge variant="secondary" className="text-xs">{camadasGeograficas.length}</Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Arquivo GeoJSON com todos os pontos e polígonos visíveis. Compatível com QGIS, Google Earth e softwares de geoprocessamento.
                    </p>
                  </div>
                )}

                <Separator />

                {/* Resumo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground tracking-wide">Resumo</Label>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {mostrarDemandas && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{demandas.filter(d => d.latitude && d.longitude).length} demandas</span></div>}
                    {mostrarMunicipes && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{municipes.filter(m => m.latitude && m.longitude).length} munícipes</span></div>}
                    {camadasGeograficas.length > 0 && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>{camadasGeograficas.length} camada(s)</span></div>}
                    {heatmapVisible && <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /><span>Mapa de calor ativo</span></div>}
                    {displayAngle !== 0 && <div className="flex items-center gap-1.5"><RotateCcw className="h-3 w-3" /><span>Rotação: {displayAngle}°</span></div>}
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
