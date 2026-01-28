import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

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

interface DadosFiltrados {
  municipes: any[];
  demandas: any[];
  cruzados: any[];
}

interface ClusterMapAvancadoProps {
  dados: DadosFiltrados;
  isLoading: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
}

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

// Criar ícone com cor baseada no tipo usando base64 (evita problema com DivIcon)
const createIcon = (type: 'demanda' | 'municipe', cor?: string | null) => {
  const color = type === 'demanda' 
    ? (cor || '#ef4444') 
    : (cor || '#3b82f6');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
      <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`;
    
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

// Criar ícone de cluster usando base64 (evita problema com DivIcon)
const createClusterIcon = (cluster: any) => {
  const childMarkers = cluster.getAllChildMarkers();
  const total = childMarkers.length;
  
  // Contar tipos
  let demandas = 0;
  let municipes = 0;
  
  childMarkers.forEach((m: any) => {
    if (m.options.type === 'demanda') demandas++;
    else municipes++;
  });

  // Calcular proporções para pizza
  const percentDemanda = (demandas / total) * 100;
  const size = Math.min(36 + Math.floor(total / 5) * 2, 50);
  
  // Cores
  const corDemanda = '#ef4444';
  const corMunicipe = '#3b82f6';
  
  let backgroundStyle;
  if (percentDemanda === 100) {
    backgroundStyle = corDemanda;
  } else if (percentDemanda === 0) {
    backgroundStyle = corMunicipe;
  } else {
    // Criar gradiente conic para efeito de pizza
    backgroundStyle = `url("data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
        <circle cx='${size/2}' cy='${size/2}' r='${size/2}' fill='${corMunicipe}'/>
        <path d='M${size/2},${size/2} L${size/2},0 A${size/2},${size/2} 0 ${percentDemanda > 50 ? 1 : 0},1 ${
          size/2 + size/2 * Math.sin(percentDemanda/100 * Math.PI * 2)
        },${
          size/2 - size/2 * Math.cos(percentDemanda/100 * Math.PI * 2)
        } Z' fill='${corDemanda}'/>
      </svg>
    `)}")`;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${percentDemanda === 100 ? corDemanda : corMunicipe}" stroke="white" stroke-width="3"/>
      ${percentDemanda > 0 && percentDemanda < 100 ? `
        <path d="M${size/2},${size/2} L${size/2},2 A${size/2-2},${size/2-2} 0 ${percentDemanda > 50 ? 1 : 0},1 ${
          size/2 + (size/2-2) * Math.sin(percentDemanda/100 * Math.PI * 2)
        },${
          size/2 - (size/2-2) * Math.cos(percentDemanda/100 * Math.PI * 2)
        } Z" fill="${corDemanda}"/>
      ` : ''}
      <text x="${size/2}" y="${size/2 + 5}" text-anchor="middle" fill="white" font-weight="bold" font-size="12" font-family="sans-serif">${total}</text>
    </svg>
  `;

  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

export function ClusterMapAvancado({ 
  dados, 
  isLoading,
  center = { lat: -23.6821, lng: -46.5651 }, // Santo André
  zoom = 13
}: ClusterMapAvancadoProps) {
  const mapRef = useRef<any>(null);

  // Converter dados para markers
  const markers: MapMarker[] = useMemo(() => {
    const result: MapMarker[] = [];
    
    // Adicionar demandas
    (dados?.demandas || []).forEach(d => {
      if (d.latitude && d.longitude) {
        result.push({
          id: d.id,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          title: d.titulo,
          description: d.protocolo,
          type: 'demanda',
          area: d.areas,
          originalData: d
        });
      }
    });
    
    // Adicionar munícipes
    (dados?.municipes || []).forEach(m => {
      if (m.latitude && m.longitude) {
        result.push({
          id: m.id,
          latitude: Number(m.latitude),
          longitude: Number(m.longitude),
          title: m.nome,
          description: m.bairro || m.telefone,
          type: 'municipe',
          tags: m.tags,
          originalData: m
        });
      }
    });
    
    return result;
  }, [dados]);

  const validMarkers = markers.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(m.latitude) && !isNaN(m.longitude)
  );

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <p className="text-muted-foreground text-sm animate-pulse">
            Carregando mapa cruzado...
          </p>
        </div>
      </div>
    );
  }

  if (validMarkers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3 text-center p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Nenhum dado para exibir</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Não foram encontrados munícipes ou demandas com coordenadas geográficas.
            Ajuste os filtros ou cadastre dados com localização.
          </p>
        </div>
      </div>
    );
  }

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
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {validMarkers.map((marker) => (
            <Marker
              key={`${marker.type}-${marker.id}`}
              position={[marker.latitude, marker.longitude]}
              icon={createIcon(marker.type, marker.area?.cor || marker.tags?.[0]?.cor)}
              // @ts-expect-error Leaflet options customizadas
              type={marker.type}
              id={marker.id}
              title={marker.title}
              tags={marker.tags}
              area={marker.area}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant={marker.type === 'demanda' ? 'destructive' : 'default'}
                      className="text-xs"
                    >
                      {marker.type === 'demanda' ? 'Demanda' : 'Munícipe'}
                    </Badge>
                    {marker.originalData?.protocolo && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {marker.originalData.protocolo}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-semibold text-sm mb-1">{marker.title}</h4>
                  
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
                    <div className="flex flex-wrap gap-1 mb-2">
                      {marker.tags.slice(0, 3).map((tag: any, idx: number) => (
                        <span 
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ 
                            backgroundColor: `${tag.cor || '#6b7280'}20`,
                            color: tag.cor || '#6b7280'
                          }}
                        >
                          {tag.nome}
                        </span>
                      ))}
                      {marker.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{marker.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {marker.description && (
                    <p className="text-xs text-muted-foreground">
                      {marker.description}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Legenda */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[400]">
        <div className="text-xs font-medium mb-2">Legenda</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs">Demandas ({dados?.demandas?.length || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs">Munícipes ({dados?.municipes?.length || 0})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
