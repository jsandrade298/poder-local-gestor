import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- CORREÇÃO CRÍTICA DE ÍCONES PARA VITE/LEAFLET ---
// Isso resolve definitivamente o erro "DA is not a constructor" ou ícones quebrados
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});
// ----------------------------------------------------

// Interfaces
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  status?: string;
  type: 'demanda' | 'municipe'; // Adicionado para diferenciar
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

// Cores para ícones SVG dinâmicos
const COLORS = {
  demanda: '#ef4444', // Vermelho
  municipe: '#3b82f6', // Azul
};

// Componente para ajustar o zoom aos marcadores
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    try {
      const group = L.featureGroup(
        markers.map((m) => L.marker([m.latitude, m.longitude]))
      );
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } catch (e) {
      console.error("Erro ao ajustar zoom:", e);
    }
  }, [markers, map]);

  return null;
}

// Ícone customizado leve
const getIcon = (type: 'demanda' | 'municipe') => {
  const color = COLORS[type];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
      <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`;
    
  return L.divIcon({
    className: 'custom-pin',
    html: svg,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

export function DemandasMap({ 
  markers, 
  config, 
  height = '600px',
  onMarkerClick 
}: DemandasMapProps) {
  
  // Filtragem de segurança: remove coordenadas inválidas (0,0 ou NaN)
  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude))
  );

  return (
    <div className="w-full relative rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height }}>
      <MapContainer
        center={[config.centerLat, config.centerLng]}
        zoom={config.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Adiciona controles de camadas (Satélite vs Rua) */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Mapa de Rua (OpenStreetMap)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satélite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FitBounds markers={validMarkers} />

        {validMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={getIcon(marker.type)}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(marker),
            }}
          >
            <Popup>
              <div className="p-1">
                <span className={`text-xs font-bold uppercase ${marker.type === 'demanda' ? 'text-red-600' : 'text-blue-600'}`}>
                  {marker.type}
                </span>
                <h3 className="font-semibold text-sm mt-1">{marker.title}</h3>
                {marker.description && (
                  <p className="text-xs text-gray-600 mt-1">{marker.description}</p>
                )}
                <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                  Clique para ver detalhes
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
