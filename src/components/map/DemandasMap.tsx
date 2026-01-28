import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet'; // CORREÇÃO: Importação compatível com todas as configs de TS
import 'leaflet/dist/leaflet.css';

// Tipos
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  status?: string;
  color?: string;
  onClick?: () => void;
}

export interface MapConfig {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

interface DemandasMapProps {
  markers: MapMarker[];
  config: MapConfig;
  height?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  showClusters?: boolean;
  fitBounds?: boolean;
}

// Cores por status
const STATUS_COLORS: Record<string, string> = {
  solicitada: '#3b82f6',    // Azul
  em_producao: '#f59e0b',   // Laranja
  encaminhado: '#8b5cf6',   // Roxo
  devolvido: '#ef4444',     // Vermelho
  visitado: '#06b6d4',      // Ciano
  atendido: '#10b981',      // Verde
  default: '#6b7280'
};

// Componente para atualizar a visualização do mapa
function MapUpdater({ markers, fitBounds, config }: { 
  markers: MapMarker[]; 
  fitBounds: boolean;
  config: MapConfig;
}) {
  const map = useMap();

  useEffect(() => {
    if (fitBounds && markers.length > 0) {
      const validMarkers = markers.filter(m => 
        m.latitude && m.longitude && 
        !isNaN(m.latitude) && !isNaN(m.longitude)
      );
      
      if (validMarkers.length > 0) {
        const bounds = new L.LatLngBounds(
          validMarkers.map(m => [m.latitude, m.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } else {
      map.setView([config.centerLat, config.centerLng], config.zoom);
    }
  }, [markers, fitBounds, config, map]);

  return null;
}

// Função para criar ícone SVG colorido
function createColoredIcon(color: string): L.Icon {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44">
      <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
      <circle fill="#ffffff" cx="12" cy="8.5" r="3.5"/>
    </svg>
  `;
  
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
}

// Formata o status para exibição
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    solicitada: 'Solicitada',
    em_producao: 'Em Produção',
    encaminhado: 'Encaminhado',
    devolvido: 'Devolvido',
    visitado: 'Visitado',
    atendido: 'Atendido'
  };
  return statusMap[status] || status;
}

// Componente principal do mapa - NAMED EXPORT
export function DemandasMap({ 
  markers, 
  config, 
  height = '500px',
  onMarkerClick,
  fitBounds = true
}: DemandasMapProps) {
  const [mapKey, setMapKey] = useState(0);
  const mapRef = useRef<any>(null);

  // Forçar recriação do mapa quando config mudar significativamente
  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, [config.centerLat, config.centerLng]);

  // Filtrar markers válidos
  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(m.latitude) && !isNaN(m.longitude) &&
    m.latitude >= -90 && m.latitude <= 90 &&
    m.longitude >= -180 && m.longitude <= 180
  );

  return (
    <div style={{ height, width: '100%', position: 'relative', zIndex: 1 }}>
      <MapContainer
        key={mapKey}
        ref={mapRef}
        center={[config.centerLat, config.centerLng]}
        zoom={config.zoom}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater 
          markers={validMarkers} 
          fitBounds={fitBounds} 
          config={config}
        />
        
        {validMarkers.map((marker) => {
          const color = marker.color || STATUS_COLORS[marker.status || 'default'] || STATUS_COLORS.default;
          const icon = createColoredIcon(color);
          
          return (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onMarkerClick?.(marker)
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <h3 className="font-semibold text-sm mb-1">{marker.title}</h3>
                  {marker.description && (
                    <p className="text-xs text-gray-600 mb-2">{marker.description}</p>
                  )}
                  {marker.status && (
                    <span 
                      className="inline-block px-2 py-1 text-xs rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {formatStatus(marker.status)}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// Componente de legenda do mapa - NAMED EXPORT
export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <span className="text-sm font-medium text-gray-700">Legenda:</span>
      {Object.entries(STATUS_COLORS).filter(([key]) => key !== 'default').map(([status, color]) => (
        <div key={status} className="flex items-center gap-1">
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-gray-600">{formatStatus(status)}</span>
        </div>
      ))}
    </div>
  );
}
