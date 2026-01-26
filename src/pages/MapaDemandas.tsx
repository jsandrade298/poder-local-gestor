import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Filter, RefreshCw, AlertCircle, Search, X } from 'lucide-react';
import { DemandasMap, MapLegend, MapMarker, MapConfig } from '@/components/map/DemandasMap';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';

interface DemandaMapa {
  id: string;
  titulo: string;
  descricao: string;
  status: string | null;
  prioridade: string | null;
  protocolo: string;
  latitude: number | null;
  longitude: number | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  area_id: string | null;
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'resolvida', label: 'Resolvida' },
  { value: 'cancelada', label: 'Cancelada' }
];

export default function MapaDemandas() {
  const [statusFilter, setStatusFilter] = useState('todos');
  const [areaFilter, setAreaFilter] = useState('todas');
  const [bairroFilter, setBairroFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDemanda, setSelectedDemanda] = useState<DemandaMapa | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const { loading: loadingConfig, cidade, estado, center, zoom } = useMapConfig();

  const mapConfig: MapConfig = useMemo(() => ({
    centerLat: center.lat,
    centerLng: center.lng,
    zoom: zoom
  }), [center, zoom]);

  const { data: areas } = useQuery({
    queryKey: ['areas-mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar áreas:', error);
        return [];
      }
      return data || [];
    }
  });

  // Query simplificada - busca apenas campos básicos
  const { data: todasDemandas, isLoading: loadingDemandas, refetch, error: queryError } = useQuery({
    queryKey: ['demandas-mapa-simples'],
    queryFn: async () => {
      console.log('Buscando demandas...');
      
      // Query muito simples, sem relacionamentos
      const { data, error } = await supabase
        .from('demandas')
        .select('id, titulo, descricao, status, prioridade, protocolo, bairro, logradouro, numero, cidade, area_id')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro na query de demandas:', error);
        throw error;
      }
      
      console.log('Demandas encontradas:', data?.length || 0);
      
      if (!data || data.length === 0) {
        return [];
      }

      // Buscar coordenadas separadamente com query raw
      const ids = data.map(d => d.id);
      
      try {
        const { data: coordData, error: coordError } = await supabase
          .rpc('buscar_coordenadas_demandas', { demanda_ids: ids });
        
        if (coordError) {
          console.log('Função RPC não existe, tentando alternativa...');
          // Tentar buscar direto (pode falhar se tipos não estiverem atualizados)
          return data.map(d => ({ ...d, latitude: null, longitude: null }));
        }
        
        // Combinar dados
        return data.map(d => {
          const coord = coordData?.find((c: any) => c.id === d.id);
          return {
            ...d,
            latitude: coord?.latitude || null,
            longitude: coord?.longitude || null
          };
        });
      } catch (e) {
        console.log('Erro ao buscar coordenadas, retornando sem elas');
        return data.map(d => ({ ...d, latitude: null, longitude: null }));
      }
    }
  });

  // Filtrar apenas demandas COM coordenadas válidas
  const demandas = useMemo(() => {
    if (!todasDemandas) return [];
    return todasDemandas.filter(d => 
      d.latitude !== null && 
      d.longitude !== null &&
      !isNaN(Number(d.latitude)) &&
      !isNaN(Number(d.longitude))
    ) as DemandaMapa[];
  }, [todasDemandas]);

  const bairrosUnicos = useMemo(() => {
    if (!demandas) return [];
    const bairros = new Set(demandas.map(d => d.bairro).filter(Boolean));
    return Array.from(bairros).sort() as string[];
  }, [demandas]);

  const demandasFiltradas = useMemo(() => {
    if (!demandas) return [];

    return demandas.filter(demanda => {
      if (statusFilter !== 'todos' && demanda.status !== statusFilter) {
        return false;
      }
      if (areaFilter !== 'todas' && demanda.area_id !== areaFilter) {
        return false;
      }
      if (bairroFilter !== 'todos' && demanda.bairro !== bairroFilter) {
        return false;
      }
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const matchTitulo = demanda.titulo?.toLowerCase().includes(termo);
        const matchProtocolo = demanda.protocolo?.toLowerCase().includes(termo);
        const matchBairro = demanda.bairro?.toLowerCase().includes(termo);
        const matchLogradouro = demanda.logradouro?.toLowerCase().includes(termo);
        
        if (!matchTitulo && !matchProtocolo && !matchBairro && !matchLogradouro) {
          return false;
        }
      }
      return true;
    });
  }, [demandas, statusFilter, areaFilter, bairroFilter, searchTerm]);

  const markers: MapMarker[] = useMemo(() => {
    return demandasFiltradas.map(demanda => ({
      id: demanda.id,
      latitude: Number(demanda.latitude),
      longitude: Number(demanda.longitude),
      title: demanda.titulo,
      description: `${demanda.bairro || 'Sem bairro'} - ${demanda.protocolo}`,
      status: demanda.status || 'aberta'
    }));
  }, [demandasFiltradas]);

  const handleMarkerClick = (marker: MapMarker) => {
    const demanda = demandasFiltradas.find(d => d.id === marker.id);
    if (demanda) {
      setSelectedDemanda(demanda);
      setShowViewDialog(true);
    }
  };

  const clearFilters = () => {
    setStatusFilter('todos');
    setAreaFilter('todas');
    setBairroFilter('todos');
    setSearchTerm('');
  };

  const stats = useMemo(() => {
    const total = demandasFiltradas.length;
    const porStatus = demandasFiltradas.reduce((acc, d) => {
      const status = d.status || 'aberta';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total, porStatus };
  }, [demandasFiltradas]);

  const isLoading = loadingConfig || loadingDemandas;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                Mapa de Demandas
              </h1>
              <p className="text-muted-foreground">
                Visualização geográfica das demandas 
                {cidade && ` - ${cidade}`}
                {estado && `/${estado}`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Mostrar erro se houver */}
          {queryError && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4">
                <p className="text-red-700 text-sm">
                  Erro ao carregar demandas: {(queryError as Error).message}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, protocolo, endereço..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Áreas</SelectItem>
                    {areas?.map(area => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bairroFilter} onValueChange={setBairroFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Bairros</SelectItem>
                    {bairrosUnicos.map(bairro => (
                      <SelectItem key={bairro} value={bairro}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(statusFilter !== 'todos' || areaFilter !== 'todas' || bairroFilter !== 'todos' || searchTerm) && (
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total no mapa</div>
            </Card>
            <Card className="p-3 border-l-4 border-l-blue-500">
              <div className="text-2xl font-bold">{stats.porStatus.aberta || 0}</div>
              <div className="text-xs text-muted-foreground">Abertas</div>
            </Card>
            <Card className="p-3 border-l-4 border-l-amber-500">
              <div className="text-2xl font-bold">{stats.porStatus.em_andamento || 0}</div>
              <div className="text-xs text-muted-foreground">Em Andamento</div>
            </Card>
            <Card className="p-3 border-l-4 border-l-purple-500">
              <div className="text-2xl font-bold">{stats.porStatus.aguardando || 0}</div>
              <div className="text-xs text-muted-foreground">Aguardando</div>
            </Card>
            <Card className="p-3 border-l-4 border-l-green-500">
              <div className="text-2xl font-bold">{stats.porStatus.resolvida || 0}</div>
              <div className="text-xs text-muted-foreground">Resolvidas</div>
            </Card>
            <Card className="p-3 border-l-4 border-l-red-500">
              <div className="text-2xl font-bold">{stats.porStatus.cancelada || 0}</div>
              <div className="text-xs text-muted-foreground">Canceladas</div>
            </Card>
          </div>

          <Card className="flex-1">
            <CardContent className="p-4">
              {isLoading ? (
                <Skeleton className="w-full h-[500px] rounded-lg" />
              ) : markers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nenhuma demanda com localização</h3>
                  <p className="text-muted-foreground mt-1 max-w-md">
                    As demandas precisam ter latitude e longitude preenchidas para aparecer no mapa.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total de demandas no sistema: {todasDemandas?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Demandas com coordenadas: {demandas?.length || 0}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <DemandasMap
                    markers={markers}
                    config={mapConfig}
                    height="500px"
                    onMarkerClick={handleMarkerClick}
                    fitBounds={true}
                  />
                  <MapLegend />
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDemanda && (
            <ViewDemandaDialog
              demanda={selectedDemanda}
              open={showViewDialog}
              onOpenChange={(open) => {
                setShowViewDialog(open);
                if (!open) setSelectedDemanda(null);
              }}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
