import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, FileText, User, ExternalLink } from 'lucide-react';
import { GeoJSONLayer } from './GeoJSONLayer';
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

// Criar ícone customizado para demanda
function createDemandaIcon(status: string | null, cor?: string | null): L.DivIcon {
  const color = cor || STATUS_COLORS[status || 'aberta'] || '#3b82f6';
  
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

// Criar ícone customizado para munícipe
function createMunicipeIcon(): L.DivIcon {
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
        console.log('✅ leaflet.heat carregado via CDN');
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

interface ClusterMapProps {
  demandas: DemandaMapa[];
  municipes: MunicipeMapa[];
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
  modoVisualizacao?: 'padrao' | 'atendimento' | 'votos' | 'comparativo';
  // Filtro de tipo para coloração
  tipoFiltro?: 'todos' | 'demandas' | 'municipes';
  // Controle de clustering
  clusterEnabled?: boolean;
}

export function ClusterMap({
  demandas,
  municipes,
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
  // Calcular centro do mapa baseado nos pontos
  const centroCalculado = useMemo(() => {
    if (centro) return centro;
    
    const allPoints = [
      ...demandas.filter(d => d.latitude && d.longitude).map(d => ({ lat: d.latitude!, lng: d.longitude! })),
      ...municipes.filter(m => m.latitude && m.longitude).map(m => ({ lat: m.latitude!, lng: m.longitude! }))
    ];
    
    if (allPoints.length === 0) {
      // Centro padrão: Santo André, SP
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
    <MapContainer
      center={centroCalculado}
      zoom={zoom}
      style={{ height: '100%', width: '100%', minHeight: '400px' }}
      className="rounded-lg z-0"
    >
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

      {/* Marcadores de Demandas e Munícipes */}
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
            
            // Definir tamanho baseado na quantidade
            let size = 36;
            let fontSize = 12;
            if (total > 10) { size = 44; fontSize = 13; }
            if (total > 30) { size = 52; fontSize = 14; }
            if (total > 50) { size = 60; fontSize = 15; }
            
            // Se só tem um tipo, usar cor sólida
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
            
            // Cluster misto - criar ícone de pizza/dividido
            const demandaPercent = (demandasCount / total) * 100;
            const municipePercent = (municipesCount / total) * 100;
            
            // Usar conic-gradient para efeito de pizza
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
                icon={createDemandaIcon(demanda.status, demanda.area_cor)}
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

          {/* Marcadores de Munícipes */}
          {mostrarMunicipes && municipes.map((municipe) => (
            municipe.latitude && municipe.longitude && (
              <Marker
                key={`municipe-${municipe.id}`}
                position={[municipe.latitude, municipe.longitude]}
                icon={createMunicipeIcon()}
                data={{ tipo: 'municipe', item: municipe }}
                eventHandlers={{
                  click: () => onMunicipeClick?.(municipe)
                }}
              >
                <Popup>
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm block">{municipe.nome}</span>
                        {municipe.demandas_count > 0 && (
                          <span className="text-xs text-gray-500">{municipe.demandas_count} demanda(s)</span>
                        )}
                      </div>
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
                          {municipe.tags.slice(0, 3).map(tag => (
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
                icon={createDemandaIcon(demanda.status, demanda.area_cor)}
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
                icon={createMunicipeIcon()}
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
  );
}

export default ClusterMap;
