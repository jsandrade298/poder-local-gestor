import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemandasMap, MapMarker } from '@/components/map/DemandasMap';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';

export default function MapaDemandas() {
  const { cidade, estado, center, zoom } = useMapConfig();

  // 1. Buscar Demandas (Fase 1)
  const { data: demandas, isLoading, error, refetch } = useQuery({
    queryKey: ['demandas-mapa-simple'],
    queryFn: async () => {
      console.log('Buscando demandas...');
      const { data, error } = await supabase
        .from('demandas')
        .select('id, titulo, latitude, longitude, protocolo, status')
        .not('latitude', 'is', null) // Filtrar direto no banco
        .not('longitude', 'is', null); // Filtrar direto no banco
      
      if (error) throw error;
      return data || [];
    }
  });

  // Transformar dados para o formato do mapa
  const markers: MapMarker[] = (demandas || []).map(d => ({
    id: d.id,
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    title: d.titulo,
    description: `Protocolo: ${d.protocolo} | Status: ${d.status}`,
    status: d.status || 'pendente',
    type: 'demanda'
  }));

  return (
    <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa Geral
          </h1>
          <p className="text-muted-foreground text-sm">
            {cidade ? `${cidade} - ${estado}` : 'Visualização Geográfica'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      {/* Área de Erro */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar dados: {(error as Error).message}</span>
          </CardContent>
        </Card>
      )}

      {/* Área do Mapa */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-md">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <p className="text-muted-foreground animate-pulse">Carregando mapa...</p>
            </div>
          </div>
        ) : (
          <DemandasMap
            markers={markers}
            config={{
              centerLat: center.lat,
              centerLng: center.lng,
              zoom: zoom
            }}
            height="100%"
            onMarkerClick={(m) => console.log("Marker clicado:", m)}
          />
        )}
      </Card>
      
      <div className="text-xs text-center text-muted-foreground">
        Total de registros no mapa: {markers.length}
      </div>
    </div>
  );
}
