import { Flame, MapPin, Users, FileText, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

interface HeatmapControlsProps {
  heatmapVisible: boolean;
  setHeatmapVisible: (visible: boolean) => void;
  heatmapType: 'demandas' | 'municipes' | 'ambos';
  setHeatmapType: (type: 'demandas' | 'municipes' | 'ambos') => void;
  demandasCount: number;
  municipesCount: number;
}

export function HeatmapControls({
  heatmapVisible,
  setHeatmapVisible,
  heatmapType,
  setHeatmapType,
  demandasCount,
  municipesCount
}: HeatmapControlsProps) {
  return (
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
  );
}

export default HeatmapControls;
