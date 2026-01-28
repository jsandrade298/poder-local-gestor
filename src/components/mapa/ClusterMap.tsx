import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, FileText, User, ExternalLink } from 'lucide-react';

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

// Cores por status de demanda
const STATUS_COLORS: Record<string, string> = {
  'aberta': '#ef4444',      // Vermelho
  'em_andamento': '#f59e0b', // Amarelo
  'concluida': '#22c55e',   // Verde
  'cancelada': '#6b7280',   // Cinza
  'pendente': '#3b82f6',    // Azul
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
  mostrarDemandas?: boolean;
  mostrarMunicipes?: boolean;
  heatmapVisible?: boolean;
  heatmapType?: 'demandas' | 'municipes' | 'ambos';
}

export function ClusterMap({
  demandas,
  municipes,
  centro,
  zoom = 13,
  onDemandaClick,
  onMunicipeClick,
  mostrarDemandas = true,
  mostrarMunicipes = true,
  heatmapVisible = false,
  heatmapType = 'demandas'
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
      </LayersControl>

      {/* Camada de Heatmap */}
      <HeatmapControl 
        demandas={demandas}
        municipes={municipes}
        heatmapType={heatmapType}
        heatmapVisible={heatmapVisible}
      />

      {/* Cluster de Demandas */}
      {mostrarDemandas && !heatmapVisible && (
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 10) size = 'medium';
            if (count > 50) size = 'large';
            
            const sizes = {
              small: { width: 30, height: 30, fontSize: 12 },
              medium: { width: 40, height: 40, fontSize: 14 },
              large: { width: 50, height: 50, fontSize: 16 }
            };
            
            const s = sizes[size as keyof typeof sizes];
            
            return L.divIcon({
              html: `<div style="
                background: linear-gradient(135deg, #ef4444, #dc2626);
                width: ${s.width}px;
                height: ${s.height}px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${s.fontSize}px;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              ">${count}</div>`,
              className: 'custom-cluster-icon',
              iconSize: L.point(s.width, s.height)
            });
          }}
        >
          {demandas.map((demanda) => (
            demanda.latitude && demanda.longitude && (
              <Marker
                key={`demanda-${demanda.id}`}
                position={[demanda.latitude, demanda.longitude]}
                icon={createDemandaIcon(demanda.status, demanda.area_cor)}
                eventHandlers={{
                  click: () => onDemandaClick?.(demanda)
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">{demanda.titulo}</span>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>Protocolo:</strong> {demanda.protocolo}</p>
                      
                      {demanda.status && (
                        <div className="flex items-center gap-1">
                          <strong>Status:</strong>
                          <Badge 
                            variant="outline" 
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
        </MarkerClusterGroup>
      )}

      {/* Cluster de Munícipes */}
      {mostrarMunicipes && !heatmapVisible && (
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 10) size = 'medium';
            if (count > 50) size = 'large';
            
            const sizes = {
              small: { width: 30, height: 30, fontSize: 12 },
              medium: { width: 40, height: 40, fontSize: 14 },
              large: { width: 50, height: 50, fontSize: 16 }
            };
            
            const s = sizes[size as keyof typeof sizes];
            
            return L.divIcon({
              html: `<div style="
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                width: ${s.width}px;
                height: ${s.height}px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${s.fontSize}px;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              ">${count}</div>`,
              className: 'custom-cluster-icon',
              iconSize: L.point(s.width, s.height)
            });
          }}
        >
          {municipes.map((municipe) => (
            municipe.latitude && municipe.longitude && (
              <Marker
                key={`municipe-${municipe.id}`}
                position={[municipe.latitude, municipe.longitude]}
                icon={createMunicipeIcon()}
                eventHandlers={{
                  click: () => onMunicipeClick?.(municipe)
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-sm">{municipe.nome}</span>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
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
                      
                      {municipe.demandas_count > 0 && (
                        <p><strong>Demandas:</strong> {municipe.demandas_count}</p>
                      )}
                      
                      {municipe.tags && municipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {municipe.tags.slice(0, 3).map(tag => (
                            <Badge 
                              key={tag.id} 
                              variant="outline"
                              style={{
                                backgroundColor: (tag.cor || '#6b7280') + '20',
                                borderColor: tag.cor || '#6b7280',
                                fontSize: '10px'
                              }}
                            >
                              {tag.nome}
                            </Badge>
                          ))}
                          {municipe.tags.length > 3 && (
                            <Badge variant="outline" style={{ fontSize: '10px' }}>
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
    </MapContainer>
  );
}

export default ClusterMap;
