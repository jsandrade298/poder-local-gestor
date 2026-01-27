import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
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
        const bounds = new LatLngBounds(
          validMarkers.map(m => [m.latitude, m.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    } else if (markers.length === 0) {
      map.setView([config.centerLat, config.centerLng], config.zoom);
    }
  }, [markers, fitBounds, map, config]);

  return null;
}

// Cria um ícone de marker personalizado - TAMANHO MAIOR
function createCustomIcon(color: string, size: number = 40): Icon {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path fill="${color}" stroke="#ffffff" stroke-width="1.5" filter="url(#shadow)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      <circle fill="white" cx="12" cy="9" r="2.5"/>
    </svg>
  `;

  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

// Componente principal do mapa
export function DemandasMap({
  markers,
  config,
  height = '500px',
  onMarkerClick,
  fitBounds = true
}: DemandasMapProps) {
  const mapRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div 
        style={{ height, width: '100%' }} 
        className="bg-gray-100 rounded-lg flex items-center justify-center"
      >
        <span className="text-gray-500">Carregando mapa...</span>
      </div>
    );
  }

  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(m.latitude) && !isNaN(m.longitude)
  );

  return (
    <div 
      style={{ height, width: '100%', position: 'relative', zIndex: 0 }} 
      className="rounded-lg overflow-hidden border border-gray-200"
    >
      <MapContainer
        ref={mapRef}
        center={[config.centerLat, config.centerLng]}
        zoom={config.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater markers={validMarkers} fitBounds={fitBounds} config={config} />

        {validMarkers.map((marker) => {
          const color = marker.color || STATUS_COLORS[marker.status || 'default'] || STATUS_COLORS.default;
          const icon = createCustomIcon(color, 44); // Tamanho aumentado para 44px

          return (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  if (onMarkerClick) {
                    onMarkerClick(marker);
                  }
                  if (marker.onClick) {
                    marker.onClick();
                  }
                }
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
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

// Componente de legenda do mapa
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

export default DemandasMap;
