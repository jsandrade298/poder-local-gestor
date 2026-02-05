import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DemandaMapa, MunicipeMapa, AreaMapa } from '@/hooks/useMapaUnificado';
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
    if ((window.L as any)?.heatLayer) {
      resolve();
      return;
    }
    const existingScript = document.querySelector('script[src*="leaflet-heat"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }
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

// Cores por status de demanda
const STATUS_COLORS: Record<string, string> = {
  'solicitada': '#3b82f6',    // Azul
  'em_producao': '#f59e0b',   // Amarelo/Laranja
  'encaminhado': '#8b5cf6',   // Roxo
  'atendido': '#22c55e',      // Verde
  'devolvido': '#ef4444',     // Vermelho
  'visitado': '#06b6d4',      // Ciano
};

// Ícone customizado para demanda
function createDemandaIcon(status: string | null, cor?: string | null, rotacao: number = 0): L.DivIcon {
  const color = cor || STATUS_COLORS[status || 'aberta'] || '#3b82f6';
  // Contra-rotação para manter o ícone em pé se o mapa girar
  const styleRotacao = rotacao !== 0 ? `transform: rotate(${-rotacao}deg); transition: transform 0.3s ease;` : '';
  
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
        ${styleRotacao}
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

// Ícone customizado para munícipe
function createMunicipeIcon(rotacao: number = 0): L.DivIcon {
  const styleRotacao = rotacao !== 0 ? `transform: rotate(${-rotacao}deg); transition: transform 0.3s ease;` : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #8b5cf6;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        ${styleRotacao}
      ">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

const HEATMAP_GRADIENTS = {
  demandas: { 0.0: '#fee5d9', 0.2: '#fcae91', 0.4: '#fb6a4a', 0.6: '#de2d26', 0.8: '#a50f15', 1.0: '#67000d' },
  municipes: { 0.0: '#e0e0ff', 0.2: '#b8b8ff', 0.4: '#9370db', 0.6: '#8a2be2', 0.8: '#6a0dad', 1.0: '#4b0082' }
};

// Componente de Heatmap
function HeatmapControl({ demandas, municipes, heatmapType, heatmapVisible }: any) {
  const map = useMap();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const layersRef = useRef<L.Layer[]>([]);
  
  useEffect(() => {
    loadHeatmapScript().then(() => setScriptLoaded(true)).catch(console.error);
  }, []);

  useEffect(() => {
    layersRef.current.forEach(layer => { try { map.removeLayer(layer); } catch(e){} });
    layersRef.current = [];
    if (!heatmapVisible || !scriptLoaded || !(window.L as any)?.heatLayer) return;

    const heatLayerFn = (window.L as any).heatLayer;

    if (heatmapType === 'demandas' || heatmapType === 'ambos') {
      const pts = demandas.filter((d: any) => d.latitude && d.longitude).map((d: any) => [d.latitude, d.longitude, 1]);
      if (pts.length) {
        const l = heatLayerFn(pts, { radius: 30, blur: 20, maxZoom: 17, max: 1.0, minOpacity: 0.4, gradient: HEATMAP_GRADIENTS.demandas });
        l.addTo(map);
        layersRef.current.push(l);
      }
    }
    if (heatmapType === 'municipes' || heatmapType === 'ambos') {
      const pts = municipes.filter((m: any) => m.latitude && m.longitude).map((m: any) => [m.latitude, m.longitude, 1]);
      if (pts.length) {
        const l = heatLayerFn(pts, { radius: 30, blur: 20, maxZoom: 17, max: 1.0, minOpacity: 0.4, gradient: HEATMAP_GRADIENTS.municipes });
        l.addTo(map);
        layersRef.current.push(l);
      }
    }
    return () => { layersRef.current.forEach(l => { try { map.removeLayer(l); } catch(e){} }); layersRef.current = []; };
  }, [map, demandas, municipes, heatmapType, heatmapVisible, scriptLoaded]);
  return null;
}

interface ClusterMapProps {
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
  areas?: AreaMapa[];
  centro?: [number, number];
  zoom?: number;
  rotacao?: number; // Prop de Rotação
  onDemandaClick?: (demanda: DemandaMapa) => void;
  onMunicipeClick?: (municipe: MunicipeMapa) => void;
  onClusterClick?: (dados: { demandas: DemandaMapa[]; municipes: MunicipeMapa[] }) => void;
  mostrarDemandas?: boolean;
  mostrarMunicipes?: boolean;
  heatmapVisible?: boolean;
  heatmapType?: 'demandas' | 'municipes' | 'ambos';
  camadasGeograficas?: CamadaGeografica[];
  estatisticasPorRegiao?: Map<string, Map<string, { demandas: number; municipes: number }>>;
  colorirPorDensidade?: boolean;
  onRegiaoClick?: (camadaId: string, feature: any, nomeRegiao: string) => void;
  votosPorCamada?: Map<string, Map<string, number>>;
  totalEleitoresPorCamada?: Map<string, Map<string, number>>;
  modoVisualizacao?: ModoVisualizacao;
  tipoFiltro?: 'todos' | 'demandas' | 'municipes' | 'nenhum';
  clusterEnabled?: boolean;
}

export function ClusterMap({
  demandas,
  municipes,
  areas = [],
  centro,
  zoom = 13,
  rotacao = 0,
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
  // Centro
  const centroCalculado = useMemo(() => {
    if (centro) return centro;
    const allPoints = [
      ...demandas.filter(d => d.latitude && d.longitude).map(d => ({ lat: d.latitude!, lng: d.longitude! })),
      ...municipes.filter(m => m.latitude && m.longitude).map(m => ({ lat: m.latitude!, lng: m.longitude! }))
    ];
    if (allPoints.length === 0) return [-23.6639, -46.5310] as [number, number];
    const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
    return [avgLat, avgLng] as [number, number];
  }, [centro, demandas, municipes]);

  const formatWhatsAppLink = (telefone: string | null) => {
    if (!telefone) return null;
    const numero = telefone.replace(/\D/g, '');
    return `https://wa.me/55${numero}`;
  };

  const handleClusterClick = (e: any) => {
    if (!onClusterClick) return;
    const markers = e.layer.getAllChildMarkers();
    const clusterDemandas: DemandaMapa[] = [];
    const clusterMunicipes: MunicipeMapa[] = [];
    markers.forEach((marker: any) => {
      const data = marker.options?.data;
      if (data?.tipo === 'demanda' && data?.item) clusterDemandas.push(data.item);
      else if (data?.tipo === 'municipe' && data?.item) clusterMunicipes.push(data.item);
    });
    onClusterClick({ demandas: clusterDemandas, municipes: clusterMunicipes });
  };

  // ESTILO DE ROTAÇÃO APLICADO AO WRAPPER
  const wrapperStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    minHeight: '400px',
    overflow: 'hidden',
    borderRadius: '0.5rem',
    position: 'relative',
    // Aplicando a rotação aqui na div externa
    transform: `rotate(${rotacao}deg)`,
    transition: 'transform 0.3s ease',
    // Opcional: Escala para evitar bordas brancas se desejar (removido por enquanto para simplicidade)
    // transform: `rotate(${rotacao}deg) scale(${rotacao % 90 !== 0 ? 1.4 : 1})`, 
  };

  return (
    // WRAPPER DIV PARA ROTAÇÃO
    <div style={wrapperStyle} className="map-rotation-wrapper shadow-sm border border-border">
      <MapContainer
        center={centroCalculado}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        attributionControl={false} // Remover atribuição padrão para limpar visual na rotação
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="🗺️ Padrão (OSM)">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="💎 Clean (Carto Positron)">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🌙 Escuro (Carto Dark)">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🛰️ Satélite (Esri)">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🌍 Google Satélite">
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🛣️ Google Híbrido">
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="⛰️ Topográfico">
            <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="⬜ Em Branco">
            <TileLayer url="" opacity={0} />
          </LayersControl.BaseLayer>
        </LayersControl>

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
            onFeatureClick={(feature, nomeRegiao) => onRegiaoClick?.(camada.id, feature, nomeRegiao)}
          />
        ))}

        <HeatmapControl demandas={demandas} municipes={municipes} heatmapType={heatmapType} heatmapVisible={heatmapVisible} />

        {!heatmapVisible && clusterEnabled && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={60}
            zoomToBoundsOnClick={false}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={1.5}
            eventHandlers={{ clusterclick: handleClusterClick }}
            iconCreateFunction={(cluster) => {
              const markers = cluster.getAllChildMarkers();
              let dCount = 0, mCount = 0;
              markers.forEach((m: any) => m.options?.data?.tipo === 'demanda' ? dCount++ : mCount++);
              const total = dCount + mCount;
              let size = 36; let fontSize = 12;
              if (total > 10) { size = 44; fontSize = 13; }
              if (total > 30) { size = 52; fontSize = 14; }
              if (total > 50) { size = 60; fontSize = 15; }
              
              // Contra-rotação aplicada aqui no cluster
              const counterRotateStyle = `transform: rotate(${-rotacao}deg); transition: transform 0.3s ease;`;

              if (municipesCount === 0) {
                return L.divIcon({
                  html: `<div style="background: linear-gradient(135deg, #ef4444, #dc2626); width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${fontSize}px; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3); ${counterRotateStyle}">${total}</div>`,
                  className: 'custom-cluster-icon',
                  iconSize: L.point(size, size)
                });
              }
              if (demandasCount === 0) {
                return L.divIcon({
                  html: `<div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${fontSize}px; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3); ${counterRotateStyle}">${total}</div>`,
                  className: 'custom-cluster-icon',
                  iconSize: L.point(size, size)
                });
              }
              const dPct = (dCount / total) * 100;
              return L.divIcon({
                html: `<div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: conic-gradient(#ef4444 0% ${dPct}%, #8b5cf6 ${dPct}% 100%); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3); position: relative; ${counterRotateStyle}"><div style="background: white; width: ${size - 16}px; height: ${size - 16}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${fontSize}px; color: #374151;">${total}</div></div>`,
                className: 'custom-cluster-icon-mixed',
                iconSize: L.point(size, size + 20),
                iconAnchor: L.point(size / 2, size / 2)
              });
            }}
          >
            {mostrarDemandas && demandas.map((demanda) => (
              demanda.latitude && demanda.longitude && (
                <Marker
                  key={`demanda-${demanda.id}`}
                  position={[demanda.latitude, demanda.longitude]}
                  // Passamos a rotação para o ícone
                  icon={createDemandaIcon(demanda.status, demanda.area_cor, rotacao)}
                  data={{ tipo: 'demanda', item: demanda }}
                  eventHandlers={{ click: () => onDemandaClick?.(demanda) }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><FileText className="h-4 w-4 text-red-600" /></div>
                        <div><span className="font-semibold text-sm block">{demanda.titulo}</span><span className="text-xs text-gray-500">{demanda.protocolo}</span></div>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-600">
                        {demanda.status && <div className="flex items-center gap-1"><strong>Status:</strong><Badge variant="outline" className="text-xs h-5" style={{ backgroundColor: STATUS_COLORS[demanda.status] + '20', borderColor: STATUS_COLORS[demanda.status], color: STATUS_COLORS[demanda.status] }}>{demanda.status.replace('_', ' ')}</Badge></div>}
                        {demanda.bairro && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{demanda.bairro}</p>}
                      </div>
                      <div className="mt-2 pt-2 border-t flex gap-2">
                        <button onClick={() => onDemandaClick?.(demanda)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><ExternalLink className="h-3 w-3" />Ver detalhes</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
            {mostrarMunicipes && municipes.map((municipe) => (
              municipe.latitude && municipe.longitude && (
                <Marker
                  key={`municipe-${municipe.id}`}
                  position={[municipe.latitude, municipe.longitude]}
                  // Passamos a rotação para o ícone
                  icon={createMunicipeIcon(rotacao)}
                  data={{ tipo: 'municipe', item: municipe }}
                  eventHandlers={{ click: () => onMunicipeClick?.(municipe) }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><User className="h-4 w-4 text-purple-600" /></div>
                        <div><span className="font-semibold text-sm block">{municipe.nome}</span></div>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-600">
                        {municipe.telefone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{municipe.telefone}</p>}
                        {municipe.bairro && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{municipe.bairro}</p>}
                      </div>
                      <div className="mt-2 pt-2 border-t flex gap-2">
                        <button onClick={() => onMunicipeClick?.(municipe)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><ExternalLink className="h-3 w-3" />Ver detalhes</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MarkerClusterGroup>
        )}

        {!heatmapVisible && !clusterEnabled && (
          <>
            {mostrarDemandas && demandas.map((demanda) => (
              demanda.latitude && demanda.longitude && <Marker key={`demanda-nc-${demanda.id}`} position={[demanda.latitude, demanda.longitude]} icon={createDemandaIcon(demanda.status, demanda.area_cor, rotacao)} eventHandlers={{ click: () => onDemandaClick?.(demanda) }}><Popup>...</Popup></Marker>
            ))}
            {mostrarMunicipes && municipes.map((municipe) => (
              municipe.latitude && municipe.longitude && <Marker key={`municipe-nc-${municipe.id}`} position={[municipe.latitude, municipe.longitude]} icon={createMunicipeIcon(rotacao)} eventHandlers={{ click: () => onMunicipeClick?.(municipe) }}><Popup>...</Popup></Marker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  );
}

export default ClusterMap;
