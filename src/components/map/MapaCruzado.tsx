import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { 
  MapPin, 
  Filter, 
  BarChart3, 
  Users, 
  FileText, 
  PieChart,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useMapaCruzado } from '@/hooks/useMapaCruzado';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { FiltrosCruzados } from '@/components/map/FiltrosCruzados';
import { AnaliseCruzadaChart } from '@/components/map/AnaliseCruzadaChart';
import { ClusterMapAvancado } from '@/components/map/ClusterMapAvancado';
import { InsightsPanel } from '@/components/map/InsightsPanel';

export default function MapaCruzado() {
  const [filtrosAtivos, setFiltrosAtivos] = useState<any>({});
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);

  const { areas, tags, bairrosUnicos, isLoading: isLoadingBase } = useMapaUnificado();
  const { dadosCruzados, dadosMapa, isLoading } = useMapaCruzado(filtrosAtivos);

  // Preparar dados para o mapa avançado
  const markers = [
    ...(dadosMapa?.municipes || []).map((municipe: any) => ({
      id: `municipe-${municipe.id}`,
      latitude: municipe.latitude,
      longitude: municipe.longitude,
      title: municipe.nome,
      description: municipe.bairro,
      type: 'municipe' as const,
      tags: municipe.tags || [],
      tagCores: municipe.tag_cores || [],
      area: undefined,
      originalData: municipe
    })),
    ...(dadosMapa?.demandas || []).map((demanda: any) => ({
      id: `demanda-${demanda.id}`,
      latitude: demanda.latitude,
      longitude: demanda.longitude,
      title: demanda.titulo,
      description: demanda.protocolo,
      type: 'demanda' as const,
      tags: [],
      tagCores: [],
      area: demanda.area_nome ? {
        id: demanda.area_id,
        nome: demanda.area_nome,
        cor: demanda.area_cor || '#6b7280'
      } : undefined,
      status: demanda.status,
      originalData: demanda
    }))
  ];

  const handleClusterClick = (markers: any[]) => {
    setSelectedCluster({
      markers,
      // Calcular estatísticas do cluster
      estatisticas: calcularEstatisticasCluster(markers)
    });
    setIsInsightsOpen(true);
  };

  const calcularEstatisticasCluster = (markers: any[]) => {
    const demandas = markers.filter(m => m.type === 'demanda');
    const municipes = markers.filter(m => m.type === 'municipe');
    
    // Agrupar demandas por área
    const areasCount = demandas.reduce((acc: any, demanda) => {
      const areaId = demanda.area?.id;
      if (areaId) {
        acc[areaId] = {
          nome: demanda.area?.nome,
          cor: demanda.area?.cor,
          count: (acc[areaId]?.count || 0) + 1
        };
      }
      return acc;
    }, {});

    // Agrupar munícipes por tag
    const tagsCount = municipes.reduce((acc: any, municipe) => {
      municipe.tags?.forEach((tag: string, index: number) => {
        const tagId = municipe.originalData?.tag_ids?.[index] || tag;
        const tagCor = municipe.tagCores?.[index] || '#6b7280';
        if (tag) {
          acc[tagId] = {
            nome: tag,
            cor: tagCor,
            count: (acc[tagId]?.count || 0) + 1
          };
        }
      });
      return acc;
    }, {});

    return {
      totalDemandas: demandas.length,
      totalMunicipes: municipes.length,
      areas: Object.values(areasCount),
      tags: Object.values(tagsCount),
      combinacaoPrincipal: encontrarCombinacaoPrincipal(areasCount, tagsCount)
    };
  };

  const encontrarCombinacaoPrincipal = (areasCount: any, tagsCount: any) => {
    // Encontrar a área mais frequente
    const topArea = Object.values(areasCount).sort((a: any, b: any) => b.count - a.count)[0] as any;
    // Encontrar a tag mais frequente
    const topTag = Object.values(tagsCount).sort((a: any, b: any) => b.count - a.count)[0] as any;

    if (topArea && topTag) {
      return {
        area: topArea.nome,
        tag: topTag.nome,
        corArea: topArea.cor,
        corTag: topTag.cor,
        percentual: (topArea.count / (Object.values(areasCount).reduce((sum: number, a: any) => sum + a.count, 0) || 1)) * 100
      };
    }

    return null;
  };

  if (isLoadingBase) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-pulse text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
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
            Visualize correlações entre grupos de munícipes (tags) e áreas de demanda
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsInsightsOpen(true)}
            className="flex items-center gap-2"
            disabled={!selectedCluster}
          >
            <TrendingUp className="h-4 w-4" />
            Insights
          </Button>
          <Button 
            variant="outline"
            onClick={() => setFiltrosAtivos({})}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosCruzados 
        tags={tags}
        areas={areas}
        bairros={bairrosUnicos}
        onFiltrosChange={setFiltrosAtivos}
      />

      {/* Área Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Mapa (2/3 da tela) */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-md relative z-0">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="animate-pulse text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Analisando cruzamentos...</p>
              </div>
            </div>
          ) : markers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
              <Filter className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum dado encontrado</h3>
              <p className="text-sm text-gray-500">
                Aplique filtros diferentes para visualizar os cruzamentos
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

        {/* Painel de Análise (1/3 da tela) */}
        <Card className="overflow-hidden flex flex-col border-none shadow-md">
          <Tabs defaultValue="analise" className="w-full flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="analise">
                <PieChart className="h-3 w-3 mr-2" />
                Análise
              </TabsTrigger>
              <TabsTrigger value="estatisticas">
                <BarChart3 className="h-3 w-3 mr-2" />
                Estatísticas
              </TabsTrigger>
              <TabsTrigger value="combinacoes">
                <Users className="h-3 w-3 mr-2" />
                Combinações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analise" className="flex-1 overflow-auto p-4">
              <AnaliseCruzadaChart 
                dadosCruzados={dadosCruzados}
                areas={areas}
                tags={tags}
              />
            </TabsContent>

            <TabsContent value="estatisticas" className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {dadosCruzados.length}
                    </div>
                    <div className="text-sm text-blue-600">Combinações</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {dadosCruzados.reduce((sum: number, item: any) => sum + item.quantidade, 0)}
                    </div>
                    <div className="text-sm text-green-600">Demandas</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Grupos Mais Ativos
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      const tagsMap = new Map();
                      dadosCruzados.forEach((item: any) => {
                        const current = tagsMap.get(item.tag_id) || { nome: item.tag_nome, quantidade: 0, cor: item.tag_cor };
                        current.quantidade += item.quantidade;
                        tagsMap.set(item.tag_id, current);
                      });
                      return Array.from(tagsMap.values())
                        .sort((a: any, b: any) => b.quantidade - a.quantidade)
                        .slice(0, 5)
                        .map((tag: any, index: number) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.cor }}
                              />
                              <span className="text-sm">{tag.nome}</span>
                            </div>
                            <Badge variant="secondary">{tag.quantidade}</Badge>
                          </div>
                        ));
                    })()}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Áreas Mais Demandadas
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      const areasMap = new Map();
                      dadosCruzados.forEach((item: any) => {
                        const current = areasMap.get(item.area_id) || { nome: item.area_nome, quantidade: 0, cor: item.area_cor };
                        current.quantidade += item.quantidade;
                        areasMap.set(item.area_id, current);
                      });
                      return Array.from(areasMap.values())
                        .sort((a: any, b: any) => b.quantidade - a.quantidade)
                        .slice(0, 5)
                        .map((area: any, index: number) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: area.cor }}
                              />
                              <span className="text-sm">{area.nome}</span>
                            </div>
                            <Badge variant="secondary">{area.quantidade}</Badge>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="combinacoes" className="flex-1 overflow-auto p-4">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {dadosCruzados.slice(0, 10).map((item: any, index: number) => (
                    <div key={index} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.tag_cor || '#6b7280' }}
                          />
                          <span className="font-medium text-sm">{item.tag_nome}</span>
                          <div className="text-muted-foreground">→</div>
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.area_cor || '#6b7280' }}
                          />
                          <span className="font-medium text-sm">{item.area_nome}</span>
                        </div>
                        <Badge variant="outline">{item.quantidade}</Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.municipes_ids?.length || 0} munícipes</span>
                        <span>{item.percentual?.toFixed(1) || 0}% do total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Sheet de Insights do Cluster */}
      <Sheet open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
        <SheetContent className="w-[100%] sm:w-[540px] overflow-hidden flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle>Insights da Localidade</SheetTitle>
            <SheetDescription>
              Análise detalhada dos dados neste ponto
            </SheetDescription>
          </SheetHeader>
          
          {selectedCluster ? (
            <InsightsPanel dados={selectedCluster} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Nenhum cluster selecionado
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
