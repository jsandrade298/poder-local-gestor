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
  tags?: any[];
  area?: any;
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

// Criar ícone com cor baseada no tipo e dados cruzados
const createIcon = (marker: MapMarker, dadosCruzados: any[]) => {
  let color = '#6b7280'; // Cor padrão
  
  if (marker.type === 'demanda' && marker.area) {
    color = marker.area.cor || '#ef4444';
  } else if (marker.type === 'municipe' && marker.tags?.[0]) {
    color = marker.tags[0].cor || '#3b82f6';
  }

  // Calcular tamanho baseado na relevância cruzada
  let size = 30;
  if (marker.type === 'demanda') {
    const cruzamento = dadosCruzados.find(d => 
      d.demandas_ids.includes(marker.originalData?.id)
    );
    if (cruzamento) {
      size = 25 + (cruzamento.quantidade * 2);
      size = Math.min(size, 45);
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
      <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
      ${marker.type === 'demanda' ? '<text x="12" y="18" text-anchor="middle" fill="white" font-size="8" font-weight="bold">D</text>' : ''}
    </svg>`;
    
  return L.divIcon({
    className: 'custom-pin',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

// Criar ícone de cluster avançado
const createAdvancedClusterIcon = (cluster: any, dadosCruzados: any[]) => {
  const childMarkers = cluster.getAllChildMarkers();
  
  // Contar tipos
  const demandas = childMarkers.filter((m: any) => m.options.type === 'demanda');
  const municipes = childMarkers.filter((m: any) => m.options.type === 'municipe');
  
  // Análise cruzada dentro do cluster
  const cruzamentosCluster: any = {};
  
  demandas.forEach((demanda: any) => {
    const areaId = demanda.options.areaId;
    municipes.forEach((municipe: any) => {
      municipe.options.tags?.forEach((tag: any) => {
        const key = `${tag?.id || 'unknown'}-${areaId || 'unknown'}`;
        cruzamentosCluster[key] = {
          tag: tag,
          area: demanda.options.area,
          count: (cruzamentosCluster[key]?.count || 0) + 1
        };
      });
    });
  });

  // Encontrar cruzamento mais frequente
  const cruzamentosArray = Object.values(cruzamentosCluster) as any[];
  const cruzamentoPrincipal = cruzamentosArray.sort((a, b) => b.count - a.count)[0];

  // Criar gráfico de pizza baseado no cruzamento principal
  let backgroundStyle = '#ccc';
  if (cruzamentoPrincipal) {
    const proporcao = (cruzamentoPrincipal.count / (demandas.length + municipes.length)) * 100;
    backgroundStyle = `conic-gradient(
      ${cruzamentoPrincipal.tag?.cor || '#3b82f6'} 0% ${proporcao}%,
      ${cruzamentoPrincipal.area?.cor || '#ef4444'} ${proporcao}% 100%
    )`;
  } else if (demandas.length > 0 && municipes.length > 0) {
    // Mostrar proporção demanda/munícipe
    const proporcaoDemandas = (demandas.length / childMarkers.length) * 100;
    backgroundStyle = `conic-gradient(
      #ef4444 0% ${proporcaoDemandas}%,
      #3b82f6 ${proporcaoDemandas}% 100%
    )`;
  } else if (demandas.length > 0) {
    backgroundStyle = '#ef4444';
  } else if (municipes.length > 0) {
    backgroundStyle = '#3b82f6';
  }

  const html = `
    <div style="
      width: 40px;
      height: 40px;
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
      font-size: 10px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 12px; line-height: 1">${childMarkers.length}</div>
      ${cruzamentoPrincipal ? `
        <div style="font-size: 8px; opacity: 0.9; text-align: center; line-height: 1">
          ${cruzamentoPrincipal.tag?.nome?.substring(0, 3) || 'TAG'}→
          ${cruzamentoPrincipal.area?.nome?.substring(0, 3) || 'AREA'}
        </div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'advanced-cluster',
    iconSize: [40, 40],
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
      area: m.options.area,
      ...m.options.originalData
    }));
    
    onClusterClick(markersData);
  }, [onClusterClick]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    onClusterClick([marker]);
  }, [onClusterClick]);

  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude))
  );

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
          <LayersControl.BaseLayer name="Topográfico">
            <TileLayer
              attribution='&copy; OpenTopoMap'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FitBounds markers={validMarkers} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={(cluster) => createAdvancedClusterIcon(cluster, dadosCruzados)}
          maxClusterRadius={50}
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
          onClick={handleClusterClick}
        >
          {validMarkers.map((marker) => (
            <Marker
              key={`${marker.type}-${marker.id}`}
              position={[marker.latitude, marker.longitude]}
              icon={createIcon(marker, dadosCruzados)}
              // @ts-expect-error Leaflet options customizadas
              type={marker.type}
              id={marker.id}
              title={marker.title}
              tags={marker.tags}
              area={marker.area}
              areaId={marker.area?.id}
              originalData={marker.originalData}
              eventHandlers={{
                click: () => handleMarkerClick(marker),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center justify-between mb-1">
                    <Badge 
                      variant={marker.type === 'demanda' ? 'destructive' : 'default'}
                      className="text-xs"
                    >
                      {marker.type === 'demanda' ? 'Demanda' : 'Munícipe'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {marker.originalData?.protocolo || 'N/A'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm mb-1">{marker.title}</h4>
                  
                  {marker.type === 'demanda' && marker.area && (
                    <div className="flex items-center gap-1 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: marker.area.cor || '#6b7280' }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {marker.area.nome}
                      </span>
                    </div>
                  )}
                  
                  {marker.type === 'municipe' && marker.tags && marker.tags.length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1">
                        {marker.tags.slice(0, 3).map((tag: any, idx: number) => (
                          <div 
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: `${tag.cor}20`,
                              color: tag.cor
                            }}
                          >
                            {tag.nome}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {marker.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {marker.description}
                    </p>
                  )}
                  
                  <div className="mt-2 pt-2 border-t text-[10px] text-gray-400">
                    Clique para análise detalhada
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
