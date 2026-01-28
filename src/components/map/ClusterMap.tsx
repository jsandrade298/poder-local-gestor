import { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// --- CORREÇÃO DE ÍCONES DO LEAFLET ---
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// --- TIPOS ---
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  status?: string;
  type: 'demanda' | 'municipe';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalData?: any; 
}

export interface ClusterMapProps {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  zoom: number;
  onClusterClick: (markers: MapMarker[]) => void;
}

const COLORS = {
  demanda: '#ef4444', // Vermelho
  municipe: '#3b82f6', // Azul
};

// --- COMPONENTE AUXILIAR PARA ZOOM ---
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  // Ajusta o zoom apenas na primeira renderização se houver marcadores
  if (markers.length > 0) {
    const group = L.featureGroup(markers.map((m) => L.marker([m.latitude, m.longitude])));
    map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
  }
  return null;
}

// --- COMPONENTE PRINCIPAL ---
export function ClusterMap({ markers, center, zoom, onClusterClick }: ClusterMapProps) {

  // Função que desenha o Ícone "Pizza" (Pie Chart)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createClusterCustomIcon = useCallback((cluster: any) => {
    const childMarkers = cluster.getAllChildMarkers();
    
    let demandasCount = 0;
    
    // Conta quantos são demandas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    childMarkers.forEach((marker: any) => {
      if (marker.options.type === 'demanda') demandasCount++;
    });

    const total = childMarkers.length;
    const percentDemanda = (demandasCount / total) * 100;
    
    // Define a cor de fundo (sólida ou gradiente)
    let backgroundStyle;
    if (percentDemanda === 100) backgroundStyle = COLORS.demanda;
    else if (percentDemanda === 0) backgroundStyle = COLORS.municipe;
    else {
      // Cria o gráfico de pizza via CSS
      backgroundStyle = `conic-gradient(
        ${COLORS.demanda} 0% ${percentDemanda}%, 
        ${COLORS.municipe} ${percentDemanda}% 100%
      )`;
    }

    const html = `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${backgroundStyle};
        border: 2px solid white;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-family: sans-serif;
        font-size: 12px;
      ">
        ${total}
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-marker-cluster', // Classe para CSS customizado se precisar
      iconSize: [36, 36],
    });
  }, []);

  // Ícone individual (pino simples)
  const createIndividualIcon = (type: 'demanda' | 'municipe') => {
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

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
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

        <FitBounds markers={markers} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={40} 
          spiderfyOnMaxZoom={false} // Desativa o efeito "aranha", preferimos abrir o painel
          showCoverageOnHover={false}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(e: any) => {
            const cluster = e.layer;
            const map = cluster._map;
            
            // Se estivermos com zoom muito longe, aproxima.
            // Se estiver perto (Zoom >= 16), abre o painel lateral com os dados.
            if (map.getZoom() < 16) {
               cluster.zoomToBounds();
            } else {
               const childMarkers = cluster.getAllChildMarkers();
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
               const markersData = childMarkers.map((m: any) => ({
                 id: m.options.id,
                 type: m.options.type,
                 title: m.options.title,
                 ...m.options.originalData
               }));
               onClusterClick(markersData);
            }
          }}
        >
          {markers.map((marker) => (
            <Marker
              key={`${marker.type}-${marker.id}`}
              position={[marker.latitude, marker.longitude]}
              icon={createIndividualIcon(marker.type)}
              // Props extras passadas via options para serem recuperadas no cluster
              // @ts-expect-error Leaflet options customizadas
              type={marker.type} 
              id={marker.id}
              title={marker.title}
              originalData={marker}
              eventHandlers={{
                click: () => onClusterClick([marker]),
              }}
            >
               {/* Removemos o Popup padrão para usar apenas o Painel Lateral */}
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
