import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- FIX CRÍTICO PARA VITE/LEAFLET ---
// Resolve o erro de ícones quebrados ou construtores indefinidos
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});
// -------------------------------------

// Tipos
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  status?: string;
  type: 'demanda' | 'municipe'; // Diferenciação visual
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
}

// Cores dos ícones
const COLORS = {
  demanda: '#ef4444', // Vermelho (Tailwind red-500)
  municipe: '#3b82f6', // Azul (Tailwind blue-500)
};

// Componente auxiliar para ajustar o zoom automaticamente
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    try {
      // Cria um grupo com todos os marcadores para calcular os limites
      const group = L.featureGroup(
        markers.map((m) => L.marker([m.latitude, m.longitude]))
      );
      // Ajusta o mapa para caber todos os pontos com uma margem (padding)
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } catch (e) {
      console.warn("Erro ao ajustar zoom:", e);
    }
  }, [markers, map]);

  return null;
}

// Gerador de ícones SVG leves e coloridos
const getIcon = (type: 'demanda' | 'municipe') => {
  const color = COLORS[type];
  // SVG simples de um pino
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
      <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`;
    
  return L.divIcon({
    className: 'custom-pin', // Classe CSS vazia, o estilo está no SVG
    html: svg,
    iconSize: [30, 30],
    iconAnchor: [15, 30], // Ponta do pino
    popupAnchor: [0, -30], // Popup acima do pino
  });
};

export function DemandasMap({ 
  markers, 
  config, 
  height = '600px',
  onMarkerClick 
}: DemandasMapProps) {
  
  // Filtro de segurança: remove coordenadas inválidas (NaN ou 0,0)
  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude))
  );

  return (
    <div className="w-full relative rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0" style={{ height }}>
      <MapContainer
        center={[config.centerLat, config.centerLng]}
        zoom={config.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Controle de Camadas (Satélite vs Rua) */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Mapa de Rua">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Ajuste automático de zoom */}
        <FitBounds markers={validMarkers} />

        {/* Renderização dos Marcadores */}
        {validMarkers.map((marker) => (
          <Marker
            key={`${marker.type}-${marker.id}`}
            position={[marker.latitude, marker.longitude]}
            icon={getIcon(marker.type)}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(marker),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white ${marker.type === 'demanda' ? 'bg-red-500' : 'bg-blue-500'}`}>
                    {marker.type}
                  </span>
                </div>
                <h3 className="font-bold text-sm leading-tight mb-1">{marker.title}</h3>
                {marker.description && (
                  <p className="text-xs text-gray-600 line-clamp-3">{marker.description}</p>
                )}
                <div className="mt-2 text-[10px] text-gray-400 text-right">
                  Clique para ações
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
