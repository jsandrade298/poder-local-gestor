import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DemandaMapa, MunicipeMapa, AreaMapa, CategoriaMapa } from '@/hooks/useMapaUnificado';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, FileText, User, ExternalLink } from 'lucide-react';
import { GeoJSONLayer, ModoVisualizacao } from './GeoJSONLayer';
import { CamadaGeografica } from '@/hooks/useCamadasGeograficas';

// Declaração de tipos para leaflet.heat (carregado via CDN)
declare global {
  interface Window {
    L: typeof L & {
      heatLayer?: (
        latlngs: Array<[number, number, number?]>,
        options?: {
          minOpacity?: number;
          maxZoom?: number;
          max?: number;
          radius?: number;
          blur?: number;
          gradient?: { [key: number]: string };
        }
      ) => L.Layer;
    };
  }
}

// Função para carregar script do CDN
function loadHeatmapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar se já está carregado
    if ((window.L as any)?.heatLayer) {
      resolve();
      return;
    }

    // Verificar se o script já existe
    const existingScript = document.querySelector('script[src*="leaflet-heat"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    // Criar e carregar o script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar leaflet.heat'));
    document.head.appendChild(script);
  });
}

// Fix para ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Cores por status de demanda (valores reais do banco)
const STATUS_COLORS: Record<string, string> = {
  'solicitada': '#3b82f6',    // Azul
  'em_producao': '#f59e0b',   // Amarelo/Laranja
  'encaminhado': '#8b5cf6',   // Roxo
  'atendido': '#22c55e',      // Verde
  'devolvido': '#ef4444',     // Vermelho
  'visitado': '#06b6d4',      // Ciano
};

// Criar ícone customizado para demanda (usa cor do STATUS)
function createDemandaIcon(status: string | null): L.DivIcon {
  const color = STATUS_COLORS[status || 'solicitada'] || '#3b82f6';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// SVG paths para diferentes formas de ícones de categoria
const ICON_SHAPES: Record<string, { viewBox: string; path: string }> = {
  circle: {
    viewBox: '0 0 24 24',
    path: '<circle cx="12" cy="12" r="10" fill="currentColor"/>'
  },
  star: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
  },
  square: {
    viewBox: '0 0 24 24',
    path: '<rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/>'
  },
  triangle: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 2L2 22h20L12 2z"/>'
  },
  hexagon: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/>'
  },
  pentagon: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 2l10 7.5-4 12H6l-4-12L12 2z"/>'
  },
  diamond: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 2l10 10-10 10L2 12 12 2z"/>'
  },
  rectangle: {
    viewBox: '0 0 24 24',
    path: '<rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/>'
  },
  cross: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7V2z"/>'
  },
  heart: {
    viewBox: '0 0 24 24',
    path: '<path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>'
  }
};

// Criar ícone customizado para munícipe (usa categoria e inicial do nome)
function createMunicipeIcon(nome: string, categoria?: CategoriaMapa | null): L.DivIcon {
  const inicial = nome.charAt(0).toUpperCase();
  const cor = categoria?.cor || '#8b5cf6'; // Roxo padrão se não tiver categoria
  const icone = categoria?.icone || 'circle';
  
  // Obter a forma do ícone
  const shape = ICON_SHAPES[icone] || ICON_SHAPES.circle;
  
  return L.divIcon({
    className: 'custom-marker-municipe',
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <svg 
          viewBox="${shape.viewBox}" 
          style="
            width: 36px; 
            height: 36px; 
            color: ${cor};
          "
        >
          ${shape.path}
          <text 
            x="12" 
            y="12" 
            text-anchor="middle" 
            dominant-baseline="central" 
            fill="white" 
            font-size="11" 
            font-weight="bold"
            font-family="Arial, sans-serif"
          >${inicial}</text>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

// Criar ícone padrão para munícipe sem categoria (círculo roxo com inicial)
function createMunicipeIconDefault(nome: string): L.DivIcon {
  return createMunicipeIcon(nome, null);
}

// Gradientes para heatmap
const HEATMAP_GRADIENTS = {
  demandas: {
    0.0: '#fee5d9',
    0.2: '#fcae91',
    0.4: '#fb6a4a',
    0.6: '#de2d26',
    0.8: '#a50f15',
    1.0: '#67000d'
  },
  municipes: {
    0.0: '#e0e0ff',
    0.2: '#b8b8ff',
    0.4: '#9370db',
    0.6: '#8a2be2',
    0.8: '#6a0dad',
    1.0: '#4b0082'
  }
};

// Componente interno para gerenciar o heatmap
function HeatmapControl({ 
  demandas, 
  municipes, 
  heatmapType,
  heatmapVisible
}: { 
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
  heatmapType: 'demandas' | 'municipes' | 'ambos';
  heatmapVisible: boolean;
}) {
  const map = useMap();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const layersRef = useRef<L.Layer[]>([]);
  
  // Carregar script do leaflet.heat via CDN
  useEffect(() => {
    loadHeatmapScript()
      .then(() => {
        setScriptLoaded(true);
      })
      .catch((err) => {
        console.error('❌ Erro ao carregar leaflet.heat:', err);
      });
  }, []);

  // Criar/remover camadas de heatmap
  useEffect(() => {
    // Limpar camadas anteriores
    layersRef.current.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // Ignorar erros de remoção
      }
    });
    layersRef.current = [];

    // Verificar se deve mostrar heatmap
    if (!heatmapVisible || !scriptLoaded) return;

    const heatLayerFn = (window.L as any)?.heatLayer;
    if (!heatLayerFn) {
      console.warn('⚠️ leaflet.heat não está disponível');
      return;
    }

    // Pontos de demandas
    if (heatmapType === 'demandas' || heatmapType === 'ambos') {
      const demandasPoints: Array<[number, number, number]> = demandas
        .filter(d => d.latitude && d.longitude)
        .map(d => [d.latitude!, d.longitude!, 1]);

      if (demandasPoints.length > 0) {
        const heatLayer = heatLayerFn(demandasPoints, {
          radius: 30,
          blur: 20,
          maxZoom: 17,
          max: 1.0,
          minOpacity: 0.4,
          gradient: HEATMAP_GRADIENTS.demandas
        });
        heatLayer.addTo(map);
        layersRef.current.push(heatLayer);
      }
    }

    // Pontos de munícipes
    if (heatmapType === 'municipes' || heatmapType === 'ambos') {
      const municipesPoints: Array<[number, number, number]> = municipes
        .filter(m => m.latitude && m.longitude)
        .map(m => [m.latitude!, m.longitude!, 1]);

      if (municipesPoints.length > 0) {
        const heatLayer = heatLayerFn(municipesPoints, {
          radius: 30,
          blur: 20,
          maxZoom: 17,
          max: 1.0,
          minOpacity: 0.4,
          gradient: HEATMAP_GRADIENTS.municipes
        });
        heatLayer.addTo(map);
        layersRef.current.push(heatLayer);
      }
    }

    // Cleanup ao desmontar
    return () => {
      layersRef.current.forEach(layer => {
        try {
          map.removeLayer(layer);
        } catch (e) {
          // Ignorar erros de remoção
        }
      });
      layersRef.current = [];
    };
  }, [map, demandas, municipes, heatmapType, heatmapVisible, scriptLoaded]);

  return null;
}

// ====================================================================
// Componente de controle de arraste rotacionado
// Quando o mapa está rotacionado via CSS, o arraste nativo do Leaflet
// não corresponde à direção visual. Este componente corrige isso
// interceptando os eventos de mouse/touch e aplicando a rotação inversa.
// ====================================================================
function RotationDragHandler({ rotation }: { rotation: number }) {
  const map = useMap();
  const isDragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Se não há rotação, usar arraste nativo do Leaflet
    if (rotation === 0) {
      map.dragging.enable();
      return;
    }

    // Desabilitar arraste nativo e implementar arraste rotacionado
    map.dragging.disable();

    const container = map.getContainer();
    const rad = -rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // --- Mouse handlers ---
    const onMouseDown = (e: MouseEvent) => {
      // Só botão esquerdo, ignorar se for sobre controles do Leaflet
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.leaflet-control') || target.closest('.leaflet-popup')) return;
      
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !lastPos.current) return;

      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;

      // Rotacionar os deltas para coordenadas do mapa
      const rdx = dx * cos - dy * sin;
      const rdy = dx * sin + dy * cos;

      map.panBy([-rdx, -rdy], { animate: false });
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
      lastPos.current = null;
      container.style.cursor = '';
    };

    // --- Touch handlers ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest('.leaflet-control') || target.closest('.leaflet-popup')) return;
      
      const touch = e.touches[0];
      lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !lastTouchPos.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchPos.current.x;
      const dy = touch.clientY - lastTouchPos.current.y;

      const rdx = dx * cos - dy * sin;
      const rdy = dx * sin + dy * cos;

      map.panBy([-rdx, -rdy], { animate: false });
      lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
      e.preventDefault();
    };

    const onTouchEnd = () => {
      lastTouchPos.current = null;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      map.dragging.enable();
      container.style.cursor = '';
    };
  }, [map, rotation]);

  return null;
}


interface ClusterMapProps {
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
  areas?: AreaMapa[]; // Lista de áreas para coloração por predominância
  categorias?: CategoriaMapa[]; // Lista de categorias para ícones de munícipes
  centro?: [number, number];
  zoom?: number;
  onDemandaClick?: (demanda: DemandaMapa) => void;
  onMunicipeClick?: (municipe: MunicipeMapa) => void;
  onClusterClick?: (dados: { demandas: DemandaMapa[]; municipes: MunicipeMapa[] }) => void;
  mostrarDemandas?: boolean;
  mostrarMunicipes?: boolean;
  heatmapVisible?: boolean;
  heatmapType?: 'demandas' | 'municipes' | 'ambos';
  // Props para camadas geográficas
  camadasGeograficas?: CamadaGeografica[];
  estatisticasPorRegiao?: Map<string, Map<string, { demandas: number; municipes: number }>>;
  colorirPorDensidade?: boolean;
  onRegiaoClick?: (camadaId: string, feature: any, nomeRegiao: string) => void;
  // Props para dados eleitorais
  votosPorCamada?: Map<string, Map<string, number>>;
  totalEleitoresPorCamada?: Map<string, Map<string, number>>;
  modoVisualizacao?: ModoVisualizacao;
  // Filtro de tipo para coloração
  tipoFiltro?: 'todos' | 'demandas' | 'municipes' | 'nenhum';
  // Controle de clustering
  clusterEnabled?: boolean;
}

export function ClusterMap({
  demandas,
  municipes,
  areas = [],
  categorias = [],
  centro,
  zoom = 13,
  onDemandaClick,
  onMunicipeClick,
  onClusterClick,
  mostrarDemandas = true,
  mostrarMunicipes = true,
  heatmapVisible = false,
  heatmapType = 'demandas',
  camadasGeograficas = [],
  estatisticasPorRegiao,
  colorirPorDensidade = false,
  onRegiaoClick,
  votosPorCamada,
  totalEleitoresPorCamada,
  modoVisualizacao = 'padrao',
  tipoFiltro = 'todos',
  clusterEnabled = true
}: ClusterMapProps) {

  // ============================
  // Estado de rotação do mapa
  // ============================
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });

  // Medir o container com ResizeObserver para reagir a mudanças de tamanho
  // (inclusive ao entrar/sair de tela cheia)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setContainerSize({ w: width, h: height });
      }
    };

    measure(); // medição inicial

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fator de escala para preencher os cantos ao rotacionar.
  // Para um retângulo W×H rotacionado por θ, a escala uniforme necessária
  // para que o retângulo rotacionado cubra 100% da viewport é:
  //   max( |cos θ| + (H/W)·|sin θ| ,  (W/H)·|sin θ| + |cos θ| )
  // Isso garante cobertura completa para qualquer aspect ratio.
  const rotationScale = useMemo(() => {
    if (rotation === 0) return 1;
    const rad = rotation * Math.PI / 180;
    const sinA = Math.abs(Math.sin(rad));
    const cosA = Math.abs(Math.cos(rad));
    const { w, h } = containerSize;
    const r = w / h; // aspect ratio
    return Math.max(
      cosA + (1 / r) * sinA,  // cobertura no eixo X
      r * sinA + cosA          // cobertura no eixo Y (dominante em viewports largas)
    );
  }, [rotation, containerSize]);

  const handleRotateLeft = useCallback(() => {
    setRotation(prev => prev - 15);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation(prev => prev + 15);
  }, []);

  const handleRotateReset = useCallback(() => {
    setRotation(0);
  }, []);

  // Normalizar ângulo para exibição (0-360)
  const displayAngle = useMemo(() => {
    return ((rotation % 360) + 360) % 360;
  }, [rotation]);

  // Mapa de categorias por ID para acesso rápido
  const categoriasMap = useMemo(() => {
    const map = new Map<string, CategoriaMapa>();
    categorias.forEach(cat => map.set(cat.id, cat));
    return map;
  }, [categorias]);

  // Função auxiliar para obter categoria de um munícipe
  const getCategoria = (categoriaId: string | null): CategoriaMapa | null => {
    if (!categoriaId) return null;
    return categoriasMap.get(categoriaId) || null;
  };

  // Calcular centro do mapa baseado nos pontos
  const centroCalculado = useMemo(() => {
    if (centro) return centro;
    
    const allPoints = [
      ...demandas.filter(d => d.latitude && d.longitude).map(d => ({ lat: d.latitude!, lng: d.longitude! })),
      ...municipes.filter(m => m.latitude && m.longitude).map(m => ({ lat: m.latitude!, lng: m.longitude! }))
    ];
    
    if (allPoints.length === 0) {
      return [-23.6639, -46.5310] as [number, number];
    }
    
    const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
    
    return [avgLat, avgLng] as [number, number];
  }, [centro, demandas, municipes]);

  // Formatar telefone para WhatsApp
  const formatWhatsAppLink = (telefone: string | null) => {
    if (!telefone) return null;
    const numero = telefone.replace(/\D/g, '');
    return `https://wa.me/55${numero}`;
  };

  // Handler para clique no cluster
  const handleClusterClick = (e: any) => {
    if (!onClusterClick) return;
    
    const markers = e.layer.getAllChildMarkers();
    const clusterDemandas: DemandaMapa[] = [];
    const clusterMunicipes: MunicipeMapa[] = [];
    
    markers.forEach((marker: any) => {
      const data = marker.options?.data;
      if (data?.tipo === 'demanda' && data?.item) {
        clusterDemandas.push(data.item);
      } else if (data?.tipo === 'municipe' && data?.item) {
        clusterMunicipes.push(data.item);
      }
    });
    
    onClusterClick({ demandas: clusterDemandas, municipes: clusterMunicipes });
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      {/* ============================================= */}
      {/* Container rotacionado do mapa                 */}
      {/* O scale compensa os cantos vazios ao girar    */}
      {/* ============================================= */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${rotation}deg) scale(${rotationScale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <MapContainer
          center={centroCalculado}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          className="rounded-lg z-0"
        >
          {/* Handler de arraste corrigido para rotação */}
          <RotationDragHandler rotation={rotation} />

          <LayersControl position="topright">
            {/* Camadas base */}
            <LayersControl.BaseLayer checked name="🗺️ Mapa de Ruas">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="🛰️ Satélite">
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="🏙️ Satélite com Rótulos">
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="⬜ Em Branco">
              <TileLayer
                attribution=''
                url=""
                opacity={0}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Camadas Geográficas (Shapefiles) */}
          {camadasGeograficas.map(camada => (
            <GeoJSONLayer
              key={camada.id}
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
              onFeatureClick={(feature, nomeRegiao) => {
                if (onRegiaoClick) {
                  onRegiaoClick(camada.id, feature, nomeRegiao);
                }
              }}
            />
          ))}

          {/* Camada de Heatmap */}
          <HeatmapControl 
            demandas={demandas}
            municipes={municipes}
            heatmapType={heatmapType}
            heatmapVisible={heatmapVisible}
          />

          {/* Marcadores de Demandas e Munícipes COM Cluster */}
          {!heatmapVisible && clusterEnabled && (
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={60}
              zoomToBoundsOnClick={false}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
              spiderfyDistanceMultiplier={1.5}
              eventHandlers={{
                clusterclick: handleClusterClick
              }}
              iconCreateFunction={(cluster) => {
                const markers = cluster.getAllChildMarkers();
                let demandasCount = 0;
                let municipesCount = 0;
                
                markers.forEach((marker: any) => {
                  const tipo = marker.options?.data?.tipo;
                  if (tipo === 'demanda') demandasCount++;
                  else if (tipo === 'municipe') municipesCount++;
                });
                
                const total = demandasCount + municipesCount;
                
                let size = 36;
                let fontSize = 12;
                if (total > 10) { size = 44; fontSize = 13; }
                if (total > 30) { size = 52; fontSize = 14; }
                if (total > 50) { size = 60; fontSize = 15; }
                
                if (municipesCount === 0) {
                  return L.divIcon({
                    html: `<div style="
                      background: linear-gradient(135deg, #ef4444, #dc2626);
                      width: ${size}px;
                      height: ${size}px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: white;
                      font-weight: bold;
                      font-size: ${fontSize}px;
                      border: 3px solid white;
                      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                      cursor: pointer;
                    ">${total}</div>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(size, size)
                  });
                }
                
                if (demandasCount === 0) {
                  return L.divIcon({
                    html: `<div style="
                      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                      width: ${size}px;
                      height: ${size}px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: white;
                      font-weight: bold;
                      font-size: ${fontSize}px;
                      border: 3px solid white;
                      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    ">${total}</div>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(size, size)
                  });
                }
                
                const demandaPercent = (demandasCount / total) * 100;
                
                return L.divIcon({
                  html: `
                    <div style="
                      width: ${size}px;
                      height: ${size}px;
                      border-radius: 50%;
                      background: conic-gradient(
                        #ef4444 0% ${demandaPercent}%,
                        #8b5cf6 ${demandaPercent}% 100%
                      );
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border: 3px solid white;
                      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                      position: relative;
                    ">
                      <div style="
                        background: white;
                        width: ${size - 16}px;
                        height: ${size - 16}px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: ${fontSize}px;
                        color: #374151;
                      ">${total}</div>
                    </div>
                    <div style="
                      position: absolute;
                      bottom: -18px;
                      left: 50%;
                      transform: translateX(-50%);
                      display: flex;
                      gap: 2px;
                      font-size: 9px;
                      font-weight: 600;
                      white-space: nowrap;
                    ">
                      <span style="color: #ef4444;">${demandasCount}D</span>
                      <span style="color: #8b5cf6;">${municipesCount}M</span>
                    </div>
                  `,
                  className: 'custom-cluster-icon-mixed',
                  iconSize: L.point(size, size + 20),
                  iconAnchor: L.point(size / 2, size / 2)
                });
              }}
            >
              {/* Marcadores de Demandas (com cluster) */}
              {mostrarDemandas && demandas.map((demanda) => (
                demanda.latitude && demanda.longitude && (
                  <Marker
                    key={`demanda-${demanda.id}`}
                    position={[demanda.latitude, demanda.longitude]}
                    icon={createDemandaIcon(demanda.status)}
                    data={{ tipo: 'demanda', item: demanda }}
                    eventHandlers={{
                      click: () => onDemandaClick?.(demanda)
                    }}
                  >
                    <Popup>
                      <div className="min-w-[220px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">{demanda.titulo}</span>
                            <span className="text-xs text-gray-500">{demanda.protocolo}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 text-xs text-gray-600">
                          {demanda.status && (
                            <div className="flex items-center gap-1">
                              <strong>Status:</strong>
                              <Badge 
                                variant="outline" 
                                className="text-xs h-5"
                                style={{ 
                                  backgroundColor: STATUS_COLORS[demanda.status] + '20',
                                  borderColor: STATUS_COLORS[demanda.status],
                                  color: STATUS_COLORS[demanda.status]
                                }}
                              >
                                {demanda.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          )}
                          
                          {demanda.area_nome && (
                            <p><strong>Área:</strong> {demanda.area_nome}</p>
                          )}
                          
                          {demanda.municipe_nome && (
                            <p><strong>Solicitante:</strong> {demanda.municipe_nome}</p>
                          )}
                          
                          {demanda.bairro && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {demanda.bairro}
                              {demanda.cidade && `, ${demanda.cidade}`}
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t flex gap-2">
                          {demanda.municipe_telefone && (
                            <a
                              href={formatWhatsAppLink(demanda.municipe_telefone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => onDemandaClick?.(demanda)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}

              {/* Marcadores de Munícipes (com cluster) */}
              {mostrarMunicipes && municipes.map((municipe) => (
                municipe.latitude && municipe.longitude && (
                  <Marker
                    key={`municipe-${municipe.id}`}
                    position={[municipe.latitude, municipe.longitude]}
                    icon={createMunicipeIcon(municipe.nome, getCategoria(municipe.categoria_id))}
                    data={{ tipo: 'municipe', item: municipe }}
                    eventHandlers={{
                      click: () => onMunicipeClick?.(municipe)
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="font-semibold text-sm">{municipe.nome}</span>
                        </div>
                        
                        <div className="space-y-1.5 text-xs text-gray-600">
                          {municipe.telefone && (
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {municipe.telefone}
                            </p>
                          )}
                          
                          {municipe.bairro && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {municipe.bairro}
                              {municipe.cidade && `, ${municipe.cidade}`}
                            </p>
                          )}
                          
                          {municipe.tags && municipe.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {municipe.tags.slice(0, 3).map((tag: any) => (
                                <Badge 
                                  key={tag.id || tag.nome} 
                                  variant="outline" 
                                  className="text-xs h-4 px-1"
                                  style={{
                                    backgroundColor: (tag.cor || '#6b7280') + '20',
                                    borderColor: tag.cor || '#6b7280',
                                  }}
                                >
                                  {tag.nome}
                                </Badge>
                              ))}
                              {municipe.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs h-5">
                                  +{municipe.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t flex gap-2">
                          {municipe.telefone && (
                            <a
                              href={formatWhatsAppLink(municipe.telefone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => onMunicipeClick?.(municipe)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MarkerClusterGroup>
          )}

          {/* Marcadores SEM Cluster (quando cluster desabilitado) */}
          {!heatmapVisible && !clusterEnabled && (
            <>
              {/* Marcadores de Demandas (sem cluster) */}
              {mostrarDemandas && demandas.map((demanda) => (
                demanda.latitude && demanda.longitude && (
                  <Marker
                    key={`demanda-nc-${demanda.id}`}
                    position={[demanda.latitude, demanda.longitude]}
                    icon={createDemandaIcon(demanda.status)}
                    eventHandlers={{
                      click: () => onDemandaClick?.(demanda)
                    }}
                  >
                    <Popup>
                      <div className="min-w-[220px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">{demanda.titulo}</span>
                            <span className="text-xs text-gray-500">{demanda.protocolo}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 text-xs text-gray-600">
                          {demanda.status && (
                            <div className="flex items-center gap-1">
                              <strong>Status:</strong>
                              <Badge 
                                variant="outline" 
                                className="text-xs h-5"
                                style={{ 
                                  backgroundColor: STATUS_COLORS[demanda.status] + '20',
                                  borderColor: STATUS_COLORS[demanda.status],
                                  color: STATUS_COLORS[demanda.status]
                                }}
                              >
                                {demanda.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          )}
                          
                          {demanda.area_nome && (
                            <p><strong>Área:</strong> {demanda.area_nome}</p>
                          )}
                          
                          {demanda.municipe_nome && (
                            <p><strong>Solicitante:</strong> {demanda.municipe_nome}</p>
                          )}
                          
                          {demanda.bairro && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {demanda.bairro}
                              {demanda.cidade && `, ${demanda.cidade}`}
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t flex gap-2">
                          {demanda.municipe_telefone && (
                            <a
                              href={formatWhatsAppLink(demanda.municipe_telefone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => onDemandaClick?.(demanda)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}

              {/* Marcadores de Munícipes (sem cluster) */}
              {mostrarMunicipes && municipes.map((municipe) => (
                municipe.latitude && municipe.longitude && (
                  <Marker
                    key={`municipe-nc-${municipe.id}`}
                    position={[municipe.latitude, municipe.longitude]}
                    icon={createMunicipeIcon(municipe.nome, getCategoria(municipe.categoria_id))}
                    eventHandlers={{
                      click: () => onMunicipeClick?.(municipe)
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="font-semibold text-sm">{municipe.nome}</span>
                        </div>
                        
                        <div className="space-y-1.5 text-xs text-gray-600">
                          {municipe.telefone && (
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {municipe.telefone}
                            </p>
                          )}
                          
                          {municipe.bairro && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {municipe.bairro}
                              {municipe.cidade && `, ${municipe.cidade}`}
                            </p>
                          )}
                          
                          {municipe.total_demandas !== undefined && municipe.total_demandas > 0 && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>{municipe.total_demandas} demanda{municipe.total_demandas !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t flex gap-2">
                          {municipe.telefone && (
                            <a
                              href={formatWhatsAppLink(municipe.telefone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => onMunicipeClick?.(municipe)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </>
          )}
        </MapContainer>
      </div>

      {/* ============================================= */}
      {/* CONTROLES DE ROTAÇÃO                          */}
      {/* Posicionados fora da área rotacionada para    */}
      {/* permanecerem fixos e sempre acessíveis.       */}
      {/* Funciona inclusive em tela cheia.              */}
      {/* ============================================= */}
      <div
        className="absolute bottom-6 left-4 z-[1000] flex flex-col items-center gap-1 select-none"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Bússola / Indicador de direção */}
        <div
          className="relative flex items-center justify-center mb-1"
          style={{ width: 48, height: 48 }}
        >
          {/* Anel externo da bússola */}
          <div
            className="absolute inset-0 rounded-full border-2 border-white/80 bg-white/90 dark:bg-gray-800/90 dark:border-gray-600/80"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          />
          {/* Agulha da bússola - gira inversamente à rotação do mapa */}
          <svg
            viewBox="0 0 48 48"
            className="absolute inset-0"
            style={{
              transform: `rotate(${-rotation}deg)`,
              transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Seta Norte (vermelha) */}
            <polygon
              points="24,6 20,24 28,24"
              fill="#ef4444"
              stroke="#dc2626"
              strokeWidth="0.5"
            />
            {/* Seta Sul (cinza) */}
            <polygon
              points="24,42 20,24 28,24"
              fill="#9ca3af"
              stroke="#6b7280"
              strokeWidth="0.5"
            />
            {/* Centro */}
            <circle cx="24" cy="24" r="3" fill="white" stroke="#374151" strokeWidth="1" />
          </svg>
          {/* Letra N - sempre visualmente no topo */}
          <span
            className="absolute text-[9px] font-bold text-red-600 dark:text-red-400"
            style={{ top: -2, left: '50%', transform: 'translateX(-50%)' }}
          >
            N
          </span>
        </div>

        {/* Botão rotacionar para esquerda (anti-horário) */}
        <button
          onClick={handleRotateLeft}
          className="w-9 h-9 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 
                     flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 
                     active:scale-95 transition-all shadow-md"
          title="Rotacionar para esquerda (-15°)"
          aria-label="Rotacionar mapa para esquerda"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 2v6h6" />
            <path d="M2.66 12.66A9 9 0 1 0 4.81 4.81L2.5 8" />
          </svg>
        </button>

        {/* Indicador de graus - só aparece quando rotacionado */}
        {displayAngle !== 0 && (
          <div className="px-2 py-0.5 rounded bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 shadow-md">
            <span className="text-[11px] font-mono font-semibold text-gray-700 dark:text-gray-300">
              {displayAngle}°
            </span>
          </div>
        )}

        {/* Botão rotacionar para direita (horário) */}
        <button
          onClick={handleRotateRight}
          className="w-9 h-9 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 
                     flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 
                     active:scale-95 transition-all shadow-md"
          title="Rotacionar para direita (+15°)"
          aria-label="Rotacionar mapa para direita"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 12.66A9 9 0 1 1 19.19 4.81L21.5 8" />
          </svg>
        </button>

        {/* Botão reset (voltar ao Norte) - só aparece quando rotacionado */}
        {displayAngle !== 0 && (
          <button
            onClick={handleRotateReset}
            className="w-9 h-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white
                       flex items-center justify-center 
                       active:scale-95 transition-all shadow-md mt-1"
            title="Voltar ao Norte (0°)"
            aria-label="Resetar rotação do mapa"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="16" />
              <polygon points="12,2 8,8 16,8" fill="currentColor" stroke="none" />
              <line x1="5" y1="22" x2="19" y2="22" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default ClusterMap;
