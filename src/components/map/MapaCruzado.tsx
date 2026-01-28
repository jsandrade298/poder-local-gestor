import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin, 
  Filter, 
  BarChart3, 
  Users, 
  FileText, 
  PieChart,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useMapaCruzado } from '@/hooks/useMapaCruzado';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { FiltrosCruzados } from '@/components/map/FiltrosCruzados';
import { ClusterMapAvancado } from '@/components/map/ClusterMapAvancado';

export default function MapaCruzado() {
  const [filtrosAtivos, setFiltrosAtivos] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { areas, tags, bairrosUnicos } = useMapaUnificado();
  const { dadosCruzados, dadosMapa, isLoading: isLoadingDados, refetch } = useMapaCruzado(filtrosAtivos);

  // Preparar marcadores para o mapa
  const markers = [
    ...(dadosMapa?.demandas || []).map((demanda: any) => ({
      ...demanda,
      id: demanda.id,
      latitude: demanda.latitude,
      longitude: demanda.longitude,
      title: demanda.title,
      description: demanda.description,
      type: demanda.type,
      area: demanda.area,
      originalData: demanda.originalData
    })),
    ...(dadosMapa?.municipes || []).map((municipe: any) => ({
      ...municipe,
      id: municipe.id,
      latitude: municipe.latitude,
      longitude: municipe.longitude,
      title: municipe.title,
      description: municipe.description,
      type: municipe.type,
      tags: municipe.tags,
      tagCores: municipe.tagCores,
      originalData: municipe.originalData
    }))
  ];

  const handleClusterClick = (markers: any[]) => {
    console.log('Cluster clicado:', markers);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await refetch();
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Log para debug
  useEffect(() => {
    console.log('📊 Estado atual:', {
      filtrosAtivos,
      temDemandas: dadosMapa?.demandas?.length || 0,
      temMunicipes: dadosMapa?.municipes?.length || 0,
      totalMarkers: markers.length,
      areasCount: areas?.length || 0,
      tagsCount: tags?.length || 0
    });
  }, [dadosMapa, filtrosAtivos]);

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
        <Button 
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Atualizando...' : 'Atualizar Dados'}
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <FiltrosCruzados 
          tags={tags}
          areas={areas}
          bairros={bairrosUnicos}
          onFiltrosChange={setFiltrosAtivos}
        />
      </div>

      {/* Área Principal - 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Mapa (Ocupa 2/3 da tela) */}
        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden border-none shadow-md">
            {isLoadingDados ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="animate-pulse text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Carregando mapa...</p>
                </div>
              </div>
            ) : markers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum dado encontrado</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {dadosMapa ? 'Aplique filtros diferentes para visualizar os dados' : 'Carregando dados...'}
                </p>
                <div className="text-xs text-gray-400">
                  {dadosMapa?.demandas?.length || 0} demandas • {dadosMapa?.municipes?.length || 0} munícipes
                </div>
              </div>
            ) : (
              <div className="h-full">
                <ClusterMapAvancado
                  markers={markers}
                  dadosCruzados={dadosCruzados}
                  onClusterClick={handleClusterClick}
                />
              </div>
            )}
          </Card>
        </div>

        {/* Painel de Análise (1/3 da tela) */}
        <div className="flex flex-col">
          <Card className="flex-1 overflow-hidden border-none shadow-md">
            <Tabs defaultValue="estatisticas" className="w-full h-full flex flex-col">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="estatisticas">
                  <BarChart3 className="h-3 w-3 mr-2" />
                  Estatísticas
                </TabsTrigger>
                <TabsTrigger value="combinacoes">
                  <PieChart className="h-3 w-3 mr-2" />
                  Combinações
                </TabsTrigger>
              </TabsList>

              <TabsContent value="estatisticas" className="flex-1 overflow-auto p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {dadosMapa?.demandas?.length || 0}
                      </div>
                      <div className="text-sm text-blue-600">Demandas</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">
                        {dadosMapa?.municipes?.length || 0}
                      </div>
                      <div className="text-sm text-green-600">Munícipes</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Filtros Ativos
                    </h4>
                    <div className="space-y-2 text-sm">
                      {filtrosAtivos.demandas?.status && (
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <Badge variant="outline">{filtrosAtivos.demandas.status}</Badge>
                        </div>
                      )}
                      {filtrosAtivos.demandas?.areaIds?.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span>Áreas:</span>
                          <Badge variant="outline">{filtrosAtivos.demandas.areaIds.length}</Badge>
                        </div>
                      )}
                      {filtrosAtivos.municipes?.tagIds?.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span>Tags:</span>
                          <Badge variant="outline">{filtrosAtivos.municipes.tagIds.length}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="combinacoes" className="flex-1 overflow-auto p-4">
                <ScrollArea className="h-full">
                  {dadosCruzados.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <PieChart className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhuma combinação encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dadosCruzados.slice(0, 5).map((item, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.tag_cor || '#6b7280' }}
                            />
                            <span className="font-medium text-sm">{item.tag_nome}</span>
                            <span className="text-muted-foreground">→</span>
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.area_cor || '#6b7280' }}
                            />
                            <span className="font-medium text-sm">{item.area_nome}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.quantidade} demandas</span>
                            <span>{item.percentual.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
