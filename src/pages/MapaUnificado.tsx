import { useState } from 'react';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, AlertCircle, Users, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClusterMap, MapMarker } from '@/components/map/ClusterMap';

export default function MapaUnificado() {
  const { center, zoom } = useMapConfig();
  const { demandas, municipes, isLoading, refetch } = useMapaUnificado();

  // Estados para o Painel Lateral
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MapMarker[]>([]);

  // Prepara os dados
  const markers: MapMarker[] = [
    ...demandas.map(d => ({
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      title: d.titulo,
      description: d.protocolo,
      status: d.status || 'pendente',
      type: 'demanda' as const,
      originalData: d
    })),
    ...municipes.map(m => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.nome,
      description: m.bairro || '',
      type: 'municipe' as const,
      originalData: m
    }))
  ];

  // Ação ao clicar no Cluster ou Pino
  const handleClusterClick = (items: MapMarker[]) => {
    setSelectedItems(items);
    setIsSheetOpen(true);
  };

  const selectedDemandas = selectedItems.filter(i => i.type === 'demanda');
  const selectedMunicipes = selectedItems.filter(i => i.type === 'municipe');

  return (
    <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Gestão
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize munícipes e demandas agrupados por localidade.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Contadores Rápidos */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3 bg-red-50 border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">Demandas</span>
            </div>
            <Badge variant="secondary" className="bg-white text-red-700 font-bold">
                {demandas.length}
            </Badge>
        </Card>
        <Card className="p-3 bg-blue-50 border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Munícipes</span>
            </div>
            <Badge variant="secondary" className="bg-white text-blue-700 font-bold">
                {municipes.length}
            </Badge>
        </Card>
      </div>

      {/* Área do Mapa */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-md relative z-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <p className="text-muted-foreground animate-pulse">Carregando mapa inteligente...</p>
            </div>
          </div>
        ) : markers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Mapa Vazio</h3>
            <p className="text-sm text-gray-500">Nenhum dado com coordenadas (Latitude/Longitude) encontrado.</p>
          </div>
        ) : (
          <ClusterMap
            markers={markers}
            center={center}
            zoom={zoom}
            onClusterClick={handleClusterClick}
          />
        )}
      </Card>

      {/* PAINEL LATERAL (SHEET) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[100%] sm:w-[540px] overflow-hidden flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle>Raio-X da Localidade</SheetTitle>
            <SheetDescription>
              Encontrados {selectedItems.length} registros neste ponto.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue={selectedDemandas.length > 0 ? "demandas" : "municipes"} className="w-full flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="demandas" disabled={selectedDemandas.length === 0}>
                Demandas ({selectedDemandas.length})
              </TabsTrigger>
              <TabsTrigger value="municipes" disabled={selectedMunicipes.length === 0}>
                Munícipes ({selectedMunicipes.length})
              </TabsTrigger>
            </TabsList>

            {/* LISTA DE DEMANDAS */}
            <TabsContent value="demandas" className="flex-1 overflow-auto pr-2">
              <ScrollArea className="h-full">
                <div className="space-y-3 pb-8">
                  {selectedDemandas.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={item.originalData.status === 'concluido' ? 'default' : 'outline'}>
                          {item.originalData.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                          {item.originalData.protocolo}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {item.originalData.descricao || 'Sem descrição detalhada.'}
                      </p>
                      {item.originalData.responsavel_id && (
                        <p className="text-xs text-gray-500 mb-2">Resp: {item.originalData.responsavel_id}</p>
                      )}
                      <Button size="sm" variant="secondary" className="w-full text-xs h-8">
                        Ver Detalhes Completos <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* LISTA DE MUNÍCIPES */}
            <TabsContent value="municipes" className="flex-1 overflow-auto pr-2">
              <ScrollArea className="h-full">
                <div className="space-y-3 pb-8">
                  {selectedMunicipes.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {item.title.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.title}</h4>
                        <div className="flex flex-col gap-0.5">
                          {item.originalData.telefone && (
                            <span className="text-xs text-muted-foreground flex items-center">
                               📞 {item.originalData.telefone}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 truncate">
                            {item.originalData.email || 'Sem email'}
                          </span>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
