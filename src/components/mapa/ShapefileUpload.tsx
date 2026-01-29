import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Upload, Loader2, Map as MapIcon, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShapefileUploadProps {
  onUploadComplete: (geojson: any, nome: string, tipo: string, cor: string, opacidade: number) => void;
}

export function ShapefileUpload({ onUploadComplete }: ShapefileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('bairros');
  const [cor, setCor] = useState('#3B82F6');
  const [opacidade, setOpacidade] = useState(0.3);
  const [geojsonPreview, setGeojsonPreview] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setNome('');
    setTipo('bairros');
    setCor('#3B82F6');
    setOpacidade(0.3);
    setGeojsonPreview(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.geojson') && !file.name.endsWith('.json')) {
      toast.error('Por favor, envie um arquivo .zip (shapefile) ou .geojson');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      let geoData: any;
      
      // Se for GeoJSON ou JSON, ler diretamente
      if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
        const text = await file.text();
        let parsed = JSON.parse(text);
        
        // Tratar caso de JSON duplamente escapado (string dentro de string)
        // Alguns sistemas exportam assim: "{\"type\":\"FeatureCollection\"...}"
        if (typeof parsed === 'string') {
          console.log('JSON estava escapado, decodificando...');
          parsed = JSON.parse(parsed);
        }
        
        geoData = parsed;
      } else {
        // Se for shapefile (.zip), usar shpjs dinamicamente
        try {
          const shp = (await import('shpjs')).default;
          const arrayBuffer = await file.arrayBuffer();
          const geojson = await shp(arrayBuffer);
          
          // Se retornou múltiplas camadas, pegar a primeira
          geoData = Array.isArray(geojson) ? geojson[0] : geojson;
        } catch (shpError: any) {
          console.error('Erro shpjs:', shpError);
          // Mensagem mais amigável para erros comuns de shapefile
          if (shpError.message?.includes('proj4')) {
            throw new Error('Shapefile sem arquivo de projeção (.prj). Tente converter para GeoJSON primeiro.');
          }
          throw new Error('Erro ao processar shapefile. Verifique se o .zip contém .shp, .dbf e .shx válidos.');
        }
      }
      
      // Validar se é um GeoJSON válido
      if (!geoData) {
        throw new Error('Arquivo inválido');
      }

      // Verificar estrutura do GeoJSON
      if (!geoData.type) {
        throw new Error('Arquivo não é um GeoJSON válido (falta propriedade "type")');
      }

      if (!geoData.features) {
        // Se for uma Feature única, converter para FeatureCollection
        if (geoData.type === 'Feature') {
          geoData = {
            type: 'FeatureCollection',
            features: [geoData]
          };
        } else if (geoData.type === 'GeometryCollection') {
          // Converter GeometryCollection para FeatureCollection
          geoData = {
            type: 'FeatureCollection',
            features: geoData.geometries.map((geom: any, idx: number) => ({
              type: 'Feature',
              properties: { id: idx },
              geometry: geom
            }))
          };
        } else {
          throw new Error('Estrutura GeoJSON não reconhecida');
        }
      }

      if (geoData.features.length === 0) {
        throw new Error('Nenhuma feição encontrada no arquivo');
      }

      // Verificar se as coordenadas parecem estar em lat/lng (WGS84)
      // Coordenadas UTM geralmente têm valores muito altos (> 100000)
      const firstCoord = getFirstCoordinate(geoData);
      if (firstCoord && (Math.abs(firstCoord[0]) > 1000 || Math.abs(firstCoord[1]) > 1000)) {
        console.warn('Coordenadas parecem estar em sistema projetado (UTM), não em lat/lng');
        toast.warning('Atenção: As coordenadas podem estar em sistema UTM. O mapa pode não exibir corretamente.');
      }

      // Salvar preview
      setGeojsonPreview(geoData);
      
      // Sugerir nome baseado no arquivo
      if (!nome) {
        setNome(file.name.replace(/\.(zip|geojson|json)$/i, '').replace(/_/g, ' '));
      }

      toast.success(`${geoData.features.length} feições carregadas`);
      
    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar o arquivo: ' + (error.message || 'Verifique se o arquivo está correto'));
      setGeojsonPreview(null);
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  };

  // Função auxiliar para obter primeira coordenada do GeoJSON
  const getFirstCoordinate = (geoData: any): number[] | null => {
    try {
      const feature = geoData.features?.[0];
      if (!feature?.geometry?.coordinates) return null;
      
      let coords = feature.geometry.coordinates;
      // Navegar até encontrar um par de números
      while (Array.isArray(coords) && Array.isArray(coords[0])) {
        coords = coords[0];
      }
      return coords;
    } catch {
      return null;
    }
  };

  const handleConfirm = () => {
    if (!geojsonPreview) {
      toast.error('Nenhum shapefile carregado');
      return;
    }

    if (!nome.trim()) {
      toast.error('Informe um nome para a camada');
      return;
    }

    onUploadComplete(geojsonPreview, nome.trim(), tipo, cor, opacidade);
    setIsOpen(false);
    resetForm();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  // Extrair informações das propriedades para preview
  const getFeatureProperties = () => {
    if (!geojsonPreview?.features?.[0]?.properties) return [];
    return Object.keys(geojsonPreview.features[0].properties);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <Upload className="h-4 w-4" />
          Importar Shapefile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Importar Shapefile
          </DialogTitle>
          <DialogDescription>
            Importe um arquivo shapefile (.zip) para adicionar uma camada geográfica ao mapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Upload de Arquivo */}
          <div className="space-y-2">
            <Label>Arquivo (.zip ou .geojson)</Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                geojsonPreview ? 'border-green-500 bg-green-50/50' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.geojson,.json"
                onChange={handleFileChange}
                className="hidden"
                id="shapefile-input"
                disabled={isLoading}
              />
              <label
                htmlFor="shapefile-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Processando arquivo...</span>
                  </>
                ) : geojsonPreview ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{fileName}</span>
                    <span className="text-xs text-green-600">
                      {geojsonPreview.features.length} feições carregadas
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Clique para trocar o arquivo
                    </span>
                  </>
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para selecionar ou arraste o arquivo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Shapefile (.zip) ou GeoJSON (.geojson)
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Preview das propriedades */}
          {geojsonPreview && getFeatureProperties().length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Propriedades encontradas:</strong>{' '}
                {getFeatureProperties().slice(0, 5).join(', ')}
                {getFeatureProperties().length > 5 && ` e mais ${getFeatureProperties().length - 5}...`}
              </AlertDescription>
            </Alert>
          )}

          {/* Nome da Camada */}
          <div className="space-y-2">
            <Label htmlFor="nome-camada">Nome da Camada *</Label>
            <Input
              id="nome-camada"
              placeholder="Ex: Bairros de Santo André"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          {/* Tipo de Camada */}
          <div className="space-y-2">
            <Label>Tipo de Camada</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bairros">Bairros</SelectItem>
                <SelectItem value="zonas_eleitorais">Zonas Eleitorais</SelectItem>
                <SelectItem value="secoes_eleitorais">Seções Eleitorais</SelectItem>
                <SelectItem value="setores_censitarios">Setores Censitários</SelectItem>
                <SelectItem value="regioes">Regiões Administrativas</SelectItem>
                <SelectItem value="distritos">Distritos</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cor e Opacidade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Opacidade: {Math.round(opacidade * 100)}%</Label>
              <Slider
                value={[opacidade]}
                onValueChange={([value]) => setOpacidade(value)}
                min={0.1}
                max={0.8}
                step={0.1}
                className="mt-3"
              />
            </div>
          </div>

          {/* Dica */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">📌 Dica:</p>
            <p>
              Você pode importar um arquivo .zip (shapefile com .shp, .dbf e .shx) ou 
              diretamente um arquivo .geojson. Baixe shapefiles no site do IBGE, TSE ou da prefeitura.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!geojsonPreview || !nome.trim() || isLoading}
          >
            Importar Camada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
