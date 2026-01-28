import { useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix para ícones
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  type: 'demanda' | 'municipe';
  tags?: string[];
  tagCores?: string[];
  area?: { id: string; nome: string; cor: string };
  status?: string;
  originalData?: any;
}

interface ClusterMapAvancadoProps {
  markers: MapMarker[];
  dadosCruzados: any[];
  onClusterClick: (markers: MapMarker[]) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

// Componente para ajustar bounds
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    try {
      const group = L.featureGroup(
        markers.map(m => L.marker([m.latitude, m.longitude]))
      );
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } catch (e) {
      console.warn("Erro ao ajustar zoom:", e);
    }
  }, [markers, map]);

  return null;
}

// Criar ícone individual
const createIcon = (marker: MapMarker) => {
  let color = '#6b7280'; // Cor padrão
  
  if (marker.type === 'demanda' && marker.area) {
    color = marker.area.cor || '#ef4444';
  } else if (marker.type === 'municipe' && marker.tagCores?.[0]) {
    color = marker.tagCores[0] || '#3b82f6';
  } else if (marker.type === 'demanda') {
    color = '#ef4444'; // Vermelho para demandas sem área
  } else if (marker.type === 'municipe') {
    color = '#3b82f6'; // Azul para munícipes sem tag
  }

  // SVG do marcador
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
      ${
        marker.type === 'demanda' 
          ? '<text x="12" y="18" text-anchor="middle" fill="white" font-size="8" font-weight="bold">D</text>'
          : '<text x="12" y="18" text-anchor="middle" fill="white" font-size="8" font-weight="bold">M</text>'
      }
    </svg>`;
    
  return L.divIcon({
    className: 'custom-pin',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Criar ícone de cluster avançado
const createAdvancedClusterIcon = (cluster: any) => {
  const childMarkers = cluster.getAllChildMarkers();
  
  // Contar tipos
  const demandas = childMarkers.filter((m: any) => m.options.type === 'demanda');
  const municipes = childMarkers.filter((m: any) => m.options.type === 'municipe');
  
  // Calcular cores predominantes
  let corDemandas = '#ef4444';
  let corMunicipes = '#3b82f6';
  
  if (demandas.length > 0) {
    const areaMaisComum = demandas
      .map((m: any) => m.options.area)
      .filter(Boolean)
      .reduce((acc: any, area: any) => {
        acc[area.cor] = (acc[area.cor] || 0) + 1;
        return acc;
      }, {});
    
    const corMaisComum = Object.entries(areaMaisComum).sort((a: any, b: any) => b[1] - a[1])[0];
    if (corMaisComum) corDemandas = corMaisComum[0];
  }
  
  if (municipes.length > 0) {
    const tagMaisComum = municipes
      .flatMap((m: any) => m.options.tagCores || [])
      .filter(Boolean)
      .reduce((acc: any, cor: string) => {
        acc[cor] = (acc[cor] || 0) + 1;
        return acc;
      }, {});
    
    const corMaisComum = Object.entries(tagMaisComum).sort((a: any, b: any) => b[1] - a[1])[0];
    if (corMaisComum) corMunicipes = corMaisComum[0];
  }
  
  // Criar gráfico de pizza
  const total = childMarkers.length;
  const percentDemandas = (demandas.length / total) * 100;
  const percentMunicipes = (municipes.length / total) * 100;
  
  let backgroundStyle;
  if (percentDemandas === 100) {
    backgroundStyle = corDemandas;
  } else if (percentMunicipes === 100) {
    backgroundStyle = corMunicipes;
  } else {
    backgroundStyle = `conic-gradient(
      ${corDemandas} 0% ${percentDemandas}%,
      ${corMunicipes} ${percentDemandas}% 100%
    )`;
  }

  const html = `
    <div style="
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: ${backgroundStyle};
      border: 3px solid white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-family: sans-serif;
      font-size: 11px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 14px; line-height: 1">${total}</div>
      ${
        demandas.length > 0 && municipes.length > 0
          ? `<div style="font-size: 8px; opacity: 0.9; line-height: 1">
              ${demandas.length}D ${municipes.length}M
            </div>`
          : ''
      }
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'advanced-cluster',
    iconSize: [44, 44],
  });
};

export function ClusterMapAvancado({ 
  markers, 
  dadosCruzados, 
  onClusterClick,
  center = { lat: -23.5505, lng: -46.6333 },
  zoom = 12
}: ClusterMapAvancadoProps) {
  const mapRef = useRef<any>(null);

  const handleClusterClick = useCallback((e: any) => {
    const cluster = e.layer;
    const childMarkers = cluster.getAllChildMarkers();
    
    const markersData = childMarkers.map((m: any) => ({
      id: m.options.id,
      type: m.options.type,
      title: m.options.title,
      tags: m.options.tags,
      tagCores: m.options.tagCores,
      area: m.options.area,
      ...m.options.originalData
    }));
    
    onClusterClick(markersData);
  }, [onClusterClick]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    onClusterClick([marker]);
  }, [onClusterClick]);

  const validMarkers = markers.filter(m => {
    const lat = Number(m.latitude);
    const lng = Number(m.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        ref={mapRef}
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

        <FitBounds markers={validMarkers} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createAdvancedClusterIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={true}
          onClick={handleClusterClick}
        >
          {validMarkers.map((marker) => (
            <Marker
              key={`${marker.type}-${marker.id}`}
              position={[marker.latitude, marker.longitude]}
              icon={createIcon(marker)}
              // @ts-expect-error Leaflet options customizadas
              type={marker.type}
              id={marker.id}
              title={marker.title}
              tags={marker.tags}
              tagCores={marker.tagCores}
              area={marker.area}
              originalData={marker.originalData}
              eventHandlers={{
                click: () => handleMarkerClick(marker),
              }}
            >
              <Popup>
                <div className="p-3 min-w-[250px] max-w-[300px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`px-2 py-1 rounded text-xs font-bold text-white ${
                      marker.type === 'demanda' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {marker.type === 'demanda' ? 'DEMANDA' : 'MUNÍCIPE'}
                    </div>
                    {marker.type === 'demanda' && marker.status && (
                      <div className="text-xs px-2 py-1 rounded bg-gray-100">
                        {marker.status}
                      </div>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-sm mb-2">{marker.title}</h4>
                  
                  {marker.type === 'demanda' && marker.area && (
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: marker.area.cor || '#6b7280' }}
                      />
                      <span className="text-xs font-medium">{marker.area.nome}</span>
                    </div>
                  )}
                  
                  {marker.type === 'municipe' && marker.tags && marker.tags.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Grupos:</p>
                      <div className="flex flex-wrap gap-1">
                        {marker.tags.slice(0, 3).map((tag, idx) => (
                          <div 
                            key={idx}
                            className="text-[10px] px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: `${marker.tagCores?.[idx] || '#6b7280'}20`,
                              color: marker.tagCores?.[idx] || '#6b7280'
                            }}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {marker.description && (
                    <p className="text-xs text-gray-600 mb-2">
                      {marker.description}
                    </p>
                  )}
                  
                  <div className="text-xs text-gray-400 mt-3 pt-2 border-t">
                    Clique para ver análise detalhada
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
