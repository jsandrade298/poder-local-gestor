import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, AlertCircle, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemandasMap, MapMarker } from '@/components/map/DemandasMap';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { Badge } from '@/components/ui/badge';

export default function MapaUnificado() {
  const { cidade, estado, center, zoom } = useMapConfig();

  // 1. Buscar Demandas
  const { data: demandas, isLoading: loadingDemandas } = useQuery({
    queryKey: ['mapa-demandas-v1'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('id, titulo, latitude, longitude, protocolo, status')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Buscar Munícipes
  const { data: municipes, isLoading: loadingMunicipes, refetch } = useQuery({
    queryKey: ['mapa-municipes-v1'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome, latitude, longitude, bairro')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = loadingDemandas || loadingMunicipes;

  // Unificar dados em Marcadores
  const markers: MapMarker[] = [
    // Mapeia Demandas
    ...(demandas || []).map(d => ({
      id: d.id,
      latitude: Number(d.latitude),
      longitude: Number(d.longitude),
      title: d.titulo,
      description: `Protocolo: ${d.protocolo} | Status: ${d.status}`,
      status: d.status || 'pendente',
      type: 'demanda' as const
    })),
    // Mapeia Munícipes
    ...(municipes || []).map(m => ({
      id: m.id,
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      title: m.nome,
      description: `Bairro: ${m.bairro || 'Não informado'}`,
      type: 'municipe' as const
    }))
  ];

  return (
    <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa Unificado
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualização geoespacial de Demandas e Munícipes
            {cidade && ` em ${cidade}/${estado}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo Rápido (Contadores) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-3 bg-red-50 border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">Demandas</span>
            </div>
            <Badge variant="secondary" className="bg-white text-red-700">
                {demandas?.length || 0}
            </Badge>
        </Card>
        <Card className="p-3 bg-blue-50 border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Munícipes</span>
            </div>
            <Badge variant="secondary" className="bg-white text-blue-700">
                {municipes?.length || 0}
            </Badge>
        </Card>
      </div>

      {/* Área do Mapa */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-md relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <p className="text-muted-foreground animate-pulse">Carregando dados geográficos...</p>
            </div>
          </div>
        ) : markers.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-center p-8">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum dado com localização</h3>
            <p className="text-sm text-gray-500 max-w-md mt-1">
              Não encontramos demandas ou munícipes com latitude e longitude cadastradas. 
              Verifique se os endereços foram geocodificados corretamente.
            </p>
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
            onMarkerClick={(m) => console.log("Selecionado:", m)}
          />
        )}
      </Card>
    </div>
  );
}
