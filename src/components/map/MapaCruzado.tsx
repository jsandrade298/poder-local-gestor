import { useState } from 'react';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { useMapaCruzado } from '@/hooks/useMapaCruzado';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, AlertCircle, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FiltrosCruzados } from '@/components/map/FiltrosCruzados';
import { ClusterMapAvancado } from '@/components/map/ClusterMapAvancado';
import { AnaliseCruzadaChart } from '@/components/map/AnaliseCruzadaChart';
import { InsightsPanel } from '@/components/map/InsightsPanel';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MapaCruzado() {
  const { areas, tags, bairrosUnicos, isLoading: isLoadingBase } = useMapaUnificado();
  const [filtrosAtivos, setFiltrosAtivos] = useState<any>({});
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);

  const { dadosMapa, dadosCruzados, isLoading: isLoadingCruzado } = useMapaCruzado(filtrosAtivos);

  // Preparar marcadores para o mapa
  const markers = [
    ...(dadosMapa?.municipes || []).map((municipe: any) => ({
      id: `municipe-${municipe.id}`,
      latitude: municipe.latitude,
      longitude: municipe.longitude,
      title: municipe.nome,
      description: municipe.bairro || '',
      type: 'municipe' as const,
      tags: municipe.tags || [],
      tagCores: municipe.tag_cores || [],
      originalData: municipe
    })),
    ...(dadosMapa?.demandas || []).map((demanda: any) => ({
      id: `demanda-${demanda.id}`,
      latitude: demanda.latitude,
      longitude: demanda.longitude,
      title: demanda.titulo,
      description: demanda.protocolo || '',
      type: 'demanda' as const,
      area: { 
        id: demanda.area_id, 
        nome: demanda.area_nome, 
        cor: demanda.area_cor 
      },
      status: demanda.status,
      originalData: demanda
    }))
  ];

  const handleClusterClick = (markers: any[]) => {
    setSelectedCluster({
      markers,
      estatisticas: {
        totalDemandas: markers.filter((m: any) => m.type === 'demanda').length,
        totalMunicipes: markers.filter((m: any) => m.type === 'municipe').length,
        areas: markers
          .filter((m: any) => m.type === 'demanda' && m.area)
          .reduce((acc: any[], m: any) => {
            const existing = acc.find(a => a.id === m.area.id);
            if (existing) {
              existing.count += 1;
            } else {
              acc.push({
                id: m.area.id,
                nome: m.area.nome,
                cor: m.area.cor,
                count: 1
              });
            }
            return acc;
          }, []),
        tags: markers
          .filter((m: any) => m.type === 'municipe' && m.tags)
          .flatMap((m: any) => m.tags)
          .reduce((acc: any[], tag: string) => {
            const existing = acc.find(t => t.nome === tag);
            if (existing) {
              existing.count += 1;
            } else {
              acc.push({ nome: tag, count: 1 });
            }
            return acc;
          }, [])
      }
    });
    setIsInsightsOpen(true);
  };

  const isLoading = isLoadingBase || isLoadingCruzado;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Mapa Cruzado</h1>
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa Cruzado - Análise de Demanda por Grupo
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize correlações entre grupos de munícipes e áreas de demanda
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsInsightsOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Insights
          </Button>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            size="icon"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosCruzados 
        areas={areas}
        tags={tags}
        bairros={bairrosUnicos}
        onFiltrosChange={setFiltrosAtivos}
      />

      {/* Área Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Mapa */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-md relative z-0">
          {markers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum dado encontrado</h3>
              <p className="text-sm text-gray-500">
                Ajuste os filtros para visualizar munícipes e demandas no mapa
              </p>
            </div>
          ) : (
            <ClusterMapAvancado
              markers={markers}
              dadosCruzados={dadosCruzados}
              onClusterClick={handleClusterClick}
            />
          )}
        </Card>

        {/* Painel de Análise */}
        <Card className="overflow-hidden flex flex-col border-none shadow-md">
          <Tabs defaultValue="analise" className="w-full flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="analise">
                <BarChart3 className="h-4 w-4 mr-2" />
                Análise
              </TabsTrigger>
              <TabsTrigger value="correlacao">
                <TrendingUp className="h-4 w-4 mr-2" />
                Correlação
              </TabsTrigger>
              <TabsTrigger value="dados">
                <MapPin className="h-4 w-4 mr-2" />
                Dados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analise" className="flex-1 overflow-auto p-4">
              <AnaliseCruzadaChart 
                dadosCruzados={dadosCruzados}
                areas={areas}
                tags={tags}
              />
            </TabsContent>

            <TabsContent value="correlacao" className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <h4 className="font-medium">Força das Correlações</h4>
                <div className="text-sm text-muted-foreground">
                  {dadosCruzados.length === 0 ? (
                    <p>Nenhuma correlação encontrada com os filtros atuais</p>
                  ) : (
                    <ul className="space-y-2">
                      {dadosCruzados.slice(0, 5).map((item: any, idx: number) => (
                        <li key={idx} className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.tag_nome}</span>
                            <span>→</span>
                            <span className="font-medium">{item.area_nome}</span>
                            <Badge>{item.quantidade}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.percentual.toFixed(1)}% das demandas
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dados" className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <h4 className="font-medium">Dados no Mapa</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {dadosMapa?.municipes?.length || 0}
                    </div>
                    <div className="text-sm text-blue-600">Munícipes</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {dadosMapa?.demandas?.length || 0}
                    </div>
                    <div className="text-sm text-green-600">Demandas</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Filtros ativos:</p>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    {filtrosAtivos.demandas?.status && (
                      <li>Status: {filtrosAtivos.demandas.status}</li>
                    )}
                    {filtrosAtivos.demandas?.areaIds?.length > 0 && (
                      <li>{filtrosAtivos.demandas.areaIds.length} área(s)</li>
                    )}
                    {filtrosAtivos.municipes?.tagIds?.length > 0 && (
                      <li>{filtrosAtivos.municipes.tagIds.length} tag(s)</li>
                    )}
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Sheet de Insights */}
      <Sheet open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Insights do Cluster</SheetTitle>
          </SheetHeader>
          {selectedCluster && (
            <InsightsPanel dados={selectedCluster} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
