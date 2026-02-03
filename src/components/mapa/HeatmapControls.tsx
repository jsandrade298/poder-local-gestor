import { Flame, MapPin, Users, FileText, Layers, Link2, ArrowRight, CircleDot } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface HeatmapControlsProps {
  heatmapVisible: boolean;
  setHeatmapVisible: (visible: boolean) => void;
  heatmapType: 'demandas' | 'municipes' | 'ambos';
  setHeatmapType: (type: 'demandas' | 'municipes' | 'ambos') => void;
  demandasCount: number;
  municipesCount: number;
  // Filtro Cruzado
  filtroCruzado?: boolean;
  setFiltroCruzado?: (value: boolean) => void;
  estatisticasCruzado?: {
    municipesPorTags: number;
    demandasPorTags: number;
    municipesPorDemandas: number;
    demandasComFiltro: number;
  } | null;
  // Controle de Cluster
  clusterEnabled?: boolean;
  setClusterEnabled?: (value: boolean) => void;
}

export function HeatmapControls({
  heatmapVisible,
  setHeatmapVisible,
  heatmapType,
  setHeatmapType,
  demandasCount,
  municipesCount,
  filtroCruzado = false,
  setFiltroCruzado,
  estatisticasCruzado,
  clusterEnabled = true,
  setClusterEnabled
}: HeatmapControlsProps) {
  return (
    <div className="space-y-4">
      {/* Card Agrupamento de Pontos */}
      {setClusterEnabled && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" />
              Agrupamento
            </CardTitle>
            <CardDescription className="text-xs">
              Agrupe ou visualize todos os pontos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="cluster-toggle" className="text-sm font-medium flex items-center gap-2">
                <CircleDot className="h-4 w-4" />
                Agrupar Pontos
              </Label>
              <Switch
                id="cluster-toggle"
                checked={clusterEnabled}
                onCheckedChange={setClusterEnabled}
              />
            </div>
            
            <div className="bg-white/60 rounded-md p-2 text-xs text-muted-foreground">
              {clusterEnabled ? (
                <span><strong>Ativado:</strong> Pontos próximos são agrupados em clusters para melhor visualização.</span>
              ) : (
                <span><strong>Desativado:</strong> Todos os {demandasCount + municipesCount} pontos são exibidos individualmente.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Filtro Cruzado */}
      {setFiltroCruzado && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              Filtro Cruzado
            </CardTitle>
            <CardDescription className="text-xs">
              Vincule filtros de tags e demandas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Toggle principal */}
            <div className="flex items-center justify-between">
              <Label htmlFor="filtro-cruzado-toggle" className="text-sm font-medium flex items-center gap-2">
                Ativar Filtro Cruzado
              </Label>
              <Switch
                id="filtro-cruzado-toggle"
                checked={filtroCruzado}
                onCheckedChange={setFiltroCruzado}
              />
            </div>

            {filtroCruzado && (
              <>
                <Separator />
                
                {/* Explicação visual */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white/60 rounded-md">
                    <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span className="text-muted-foreground">Tags</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-muted-foreground">Demandas vinculadas</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white/60 rounded-md">
                    <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-muted-foreground">Status/Áreas</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span className="text-muted-foreground">Munícipes com essas demandas</span>
                  </div>
                </div>

                {/* Estatísticas */}
                {estatisticasCruzado && (estatisticasCruzado.municipesPorTags > 0 || estatisticasCruzado.municipesPorDemandas > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-muted-foreground">Resultado do cruzamento:</p>
                      {estatisticasCruzado.municipesPorTags > 0 && (
                        <p className="text-blue-700">
                          Tags → {estatisticasCruzado.municipesPorTags} munícipes → {estatisticasCruzado.demandasPorTags} demandas
                        </p>
                      )}
                      {estatisticasCruzado.municipesPorDemandas > 0 && (
                        <p className="text-blue-700">
                          Filtros → {estatisticasCruzado.demandasComFiltro} demandas → {estatisticasCruzado.municipesPorDemandas} munícipes
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card Mapa de Calor */}
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Mapa de Calor
          </CardTitle>
          <CardDescription className="text-xs">
            Visualize a concentração geográfica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle principal */}
          <div className="flex items-center justify-between">
            <Label htmlFor="heatmap-toggle" className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Ativar Heatmap
            </Label>
            <Switch
              id="heatmap-toggle"
              checked={heatmapVisible}
              onCheckedChange={setHeatmapVisible}
            />
          </div>

          {heatmapVisible && (
            <>
              <Separator />
              
              {/* Seleção do tipo de dados */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Visualizar:</Label>
                <RadioGroup
                  value={heatmapType}
                  onValueChange={(value) => setHeatmapType(value as 'demandas' | 'municipes' | 'ambos')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/50 transition-colors">
                    <RadioGroupItem value="demandas" id="heatmap-demandas" />
                    <Label 
                      htmlFor="heatmap-demandas" 
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-red-600" />
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Demandas</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({demandasCount})
                      </span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/50 transition-colors">
                    <RadioGroupItem value="municipes" id="heatmap-municipes" />
                    <Label 
                      htmlFor="heatmap-municipes" 
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-300 to-purple-700" />
                      <Users className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Munícipes</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({municipesCount})
                      </span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/50 transition-colors">
                    <RadioGroupItem value="ambos" id="heatmap-ambos" />
                    <Label 
                      htmlFor="heatmap-ambos" 
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-purple-600" />
                      <MapPin className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Ambos</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({demandasCount + municipesCount})
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Legenda */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Legenda de Intensidade:</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Baixa</span>
                  <div 
                    className="flex-1 h-3 rounded-full"
                    style={{
                      background: heatmapType === 'municipes' 
                        ? 'linear-gradient(to right, #e0e0ff, #9370db, #4b0082)'
                        : 'linear-gradient(to right, #fee5d9, #fb6a4a, #67000d)'
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Alta</span>
                </div>
              </div>

              {/* Dica */}
              <div className="bg-white/60 rounded-md p-2 text-xs text-muted-foreground">
                <strong>Dica:</strong> O mapa de calor oculta os marcadores individuais para melhor visualização. 
                Desative-o para ver os pontos detalhados.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HeatmapControls;
