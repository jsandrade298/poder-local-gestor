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
import { Upload, Loader2, Map as MapIcon, FileUp, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShapefileUploadProps {
  onUploadComplete: (geojson: any, nome: string, tipo: string, cor: string, opacidade: number) => void;
}

// ============================================
// FUNÇÕES DE CONVERSÃO UTM -> WGS84
// ============================================

/**
 * Converte coordenadas UTM para Lat/Lon (WGS84)
 * Fórmula Karney para maior precisão
 */
function utmToLatLon(
  easting: number, 
  northing: number, 
  zone: number = 23, 
  hemisphere: 'N' | 'S' = 'S'
): [number, number] {
  // Constantes WGS84
  const a = 6378137.0; // semi-eixo maior
  const f = 1 / 298.257223563; // achatamento
  const k0 = 0.9996; // fator de escala
  
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ePrime2 = e2 / (1 - e2);
  
  // Ajustar coordenadas
  const x = easting - 500000;
  let y = northing;
  if (hemisphere === 'S') {
    y = y - 10000000;
  }
  
  // Meridiano central
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const lon0Rad = lon0 * Math.PI / 180;
  
  // Footprint latitude
  const M = y / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  
  let phi1 = mu + (3*e1/2 - 27*Math.pow(e1, 3)/32) * Math.sin(2*mu);
  phi1 += (21*e1*e1/16 - 55*Math.pow(e1, 4)/32) * Math.sin(4*mu);
  phi1 += (151*Math.pow(e1, 3)/96) * Math.sin(6*mu);
  phi1 += (1097*Math.pow(e1, 4)/512) * Math.sin(8*mu);
  
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = ePrime2 * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);
  
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*ePrime2) * Math.pow(D, 4)/24
    + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*ePrime2 - 3*C1*C1) * Math.pow(D, 6)/720
  );
  
  const lon = lon0Rad + (D - (1 + 2*T1 + C1) * Math.pow(D, 3)/6
    + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*ePrime2 + 24*T1*T1) * Math.pow(D, 5)/120) / Math.cos(phi1);
  
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

/**
 * Detecta a zona UTM baseada nas coordenadas (para Brasil, zonas 18-25)
 */
function detectarZonaUTM(coords: number[]): number {
  // Para Santo André e região metropolitana de SP: Zona 23S
  // Para maior parte do Brasil: zonas 18-25
  const x = coords[0];
  
  // Se X está entre 166000 e 834000, provavelmente é UTM
  // Vamos usar zona 23 como padrão para SP
  if (x > 100000 && x < 900000) {
    return 23; // Zona padrão para SP
  }
  
  return 23;
}

/**
 * Verifica se coordenadas estão em UTM (valores altos)
 */
function isUTM(coords: number[]): boolean {
  if (!coords || coords.length < 2) return false;
  // UTM tem valores tipicamente > 100000
  return Math.abs(coords[0]) > 1000 || Math.abs(coords[1]) > 100000;
}

/**
 * Converte recursivamente todas as coordenadas de um GeoJSON de UTM para WGS84
 */
function convertCoordsToWGS84(coords: any, zone: number = 23): any {
  if (typeof coords[0] === 'number') {
    // É um par de coordenadas [x, y]
    const [lat, lon] = utmToLatLon(coords[0], coords[1], zone, 'S');
    return [lon, lat]; // GeoJSON usa [lon, lat]
  }
  // É uma lista de coordenadas
  return coords.map((c: any) => convertCoordsToWGS84(c, zone));
}

/**
 * Converte todo o GeoJSON de UTM para WGS84
 */
function convertGeoJSONToWGS84(geoData: any): any {
  const firstCoord = getFirstCoordinate(geoData);
  
  if (!firstCoord || !isUTM(firstCoord)) {
    return geoData; // Já está em WGS84
  }
  
  const zone = detectarZonaUTM(firstCoord);
  console.log(`Convertendo de UTM Zona ${zone}S para WGS84...`);
  
  // Clonar o objeto para não modificar o original
  const converted = JSON.parse(JSON.stringify(geoData));
  
  for (const feature of converted.features) {
    if (feature?.geometry?.coordinates) {
      feature.geometry.coordinates = convertCoordsToWGS84(feature.geometry.coordinates, zone);
    }
  }
  
  return converted;
}

/**
 * Obtém a primeira coordenada do GeoJSON
 */
function getFirstCoordinate(geoData: any): number[] | null {
  try {
    const feature = geoData?.features?.[0];
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
}

// ============================================
// FUNÇÕES DE FIX DE ENCODING
// ============================================

/**
 * Corrige problemas de encoding Latin-1/UTF-8
 * Converte caracteres como "AmÃ©rica" -> "América"
 */
function fixEncoding(text: string): string {
  if (!text) return text;
  
  // Mapa de substituições comuns de UTF-8 mal interpretado como Latin-1
  const replacements: [RegExp, string][] = [
    [/Ã¡/g, 'á'],
    [/Ã /g, 'à'],
    [/Ã¢/g, 'â'],
    [/Ã£/g, 'ã'],
    [/Ã¤/g, 'ä'],
    [/Ã©/g, 'é'],
    [/Ã¨/g, 'è'],
    [/Ãª/g, 'ê'],
    [/Ã«/g, 'ë'],
    [/Ã­/g, 'í'],
    [/Ã¬/g, 'ì'],
    [/Ã®/g, 'î'],
    [/Ã¯/g, 'ï'],
    [/Ã³/g, 'ó'],
    [/Ã²/g, 'ò'],
    [/Ã´/g, 'ô'],
    [/Ãµ/g, 'õ'],
    [/Ã¶/g, 'ö'],
    [/Ãº/g, 'ú'],
    [/Ã¹/g, 'ù'],
    [/Ã»/g, 'û'],
    [/Ã¼/g, 'ü'],
    [/Ã§/g, 'ç'],
    [/Ã±/g, 'ñ'],
    [/Ã/g, 'Á'],
    [/Ã€/g, 'À'],
    [/Ã‚/g, 'Â'],
    [/Ãƒ/g, 'Ã'],
    [/Ã„/g, 'Ä'],
    [/Ã‰/g, 'É'],
    [/Ãˆ/g, 'È'],
    [/ÃŠ/g, 'Ê'],
    [/Ã‹/g, 'Ë'],
    [/Ã/g, 'Í'],
    [/ÃŒ/g, 'Ì'],
    [/ÃŽ/g, 'Î'],
    [/Ã/g, 'Ï'],
    [/Ã"/g, 'Ó'],
    [/Ã'/g, 'Ò'],
    [/Ã"/g, 'Ô'],
    [/Ã•/g, 'Õ'],
    [/Ã–/g, 'Ö'],
    [/Ãš/g, 'Ú'],
    [/Ã™/g, 'Ù'],
    [/Ã›/g, 'Û'],
    [/Ãœ/g, 'Ü'],
    [/Ã‡/g, 'Ç'],
    [/Ã'/g, 'Ñ'],
    // Casos específicos encontrados
    [/Ã£o/g, 'ão'],
    [/Ã§Ã£o/g, 'ção'],
  ];
  
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Corrige encoding de todas as propriedades das features
 */
function fixGeoJSONEncoding(geoData: any): any {
  if (!geoData?.features) return geoData;
  
  for (const feature of geoData.features) {
    if (feature?.properties) {
      for (const key of Object.keys(feature.properties)) {
        if (typeof feature.properties[key] === 'string') {
          feature.properties[key] = fixEncoding(feature.properties[key]);
        }
      }
    }
  }
  
  return geoData;
}

// ============================================
// FIX ENCODING DE SHAPEFILES BRASILEIROS
// ============================================

/**
 * CRC32 para ZIP
 */
function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (~crc) >>> 0;
}

/**
 * Injeta um arquivo .cpg com "ISO-8859-1" dentro do zip se não existir.
 * Shapefiles brasileiros (IBGE, prefeituras) usam Latin-1 no .dbf,
 * mas shpjs lê como UTF-8 por padrão, gerando caracteres como "V rzea".
 * A presença do .cpg instrui o shpjs a usar o encoding correto.
 */
function ensureEncodingInZip(zipBuffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(zipBuffer);
  const view = new DataView(zipBuffer);
  
  // Encontrar End of Central Directory (busca do final)
  let eocdPos = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) return zipBuffer;
  
  const cdEntries = view.getUint16(eocdPos + 10, true);
  const cdSize = view.getUint32(eocdPos + 12, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);
  
  // Varrer central directory para achar .cpg e nome base do .shp
  let hasCpg = false;
  let shpBaseName = '';
  let pos = cdOffset;
  const dec = new TextDecoder('ascii');
  
  for (let i = 0; i < cdEntries && pos < bytes.length; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const name = dec.decode(bytes.slice(pos + 46, pos + 46 + nameLen));
    
    if (name.toLowerCase().endsWith('.cpg')) hasCpg = true;
    if (name.toLowerCase().endsWith('.shp')) {
      shpBaseName = name.replace(/\.shp$/i, '');
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  
  // Se já tem .cpg ou não encontrou .shp, retornar sem modificar
  if (hasCpg || !shpBaseName) return zipBuffer;
  
  console.log('Injetando .cpg (ISO-8859-1) no zip para encoding correto...');
  
  // Montar novo arquivo .cpg
  const enc = new TextEncoder();
  const cpgFileName = enc.encode(shpBaseName + '.cpg');
  const cpgData = enc.encode('ISO-8859-1');
  const cpgCrc = crc32(cpgData);
  
  // Local file header para .cpg (30 + nome)
  const localHeader = new Uint8Array(30 + cpgFileName.length);
  const lhv = new DataView(localHeader.buffer);
  lhv.setUint32(0, 0x04034b50, true);
  lhv.setUint16(4, 20, true);
  lhv.setUint32(14, cpgCrc, true);
  lhv.setUint32(18, cpgData.length, true);
  lhv.setUint32(22, cpgData.length, true);
  lhv.setUint16(26, cpgFileName.length, true);
  localHeader.set(cpgFileName, 30);
  
  const newLocalOffset = cdOffset; // inserir antes do CD original
  
  // Central directory entry para .cpg (46 + nome)
  const cdEntry = new Uint8Array(46 + cpgFileName.length);
  const cev = new DataView(cdEntry.buffer);
  cev.setUint32(0, 0x02014b50, true);
  cev.setUint16(4, 20, true);
  cev.setUint16(6, 20, true);
  cev.setUint32(16, cpgCrc, true);
  cev.setUint32(20, cpgData.length, true);
  cev.setUint32(24, cpgData.length, true);
  cev.setUint16(28, cpgFileName.length, true);
  cev.setUint32(42, newLocalOffset, true);
  cdEntry.set(cpgFileName, 46);
  
  // Montar resultado: [local files originais][.cpg local+data][CD original][CD entry .cpg][novo EOCD]
  const insertSize = localHeader.length + cpgData.length;
  const newCdOffset = cdOffset + insertSize;
  const newCdSize = cdSize + cdEntry.length;
  
  const newEocd = new Uint8Array(22);
  const nev = new DataView(newEocd.buffer);
  nev.setUint32(0, 0x06054b50, true);
  nev.setUint16(8, cdEntries + 1, true);
  nev.setUint16(10, cdEntries + 1, true);
  nev.setUint32(12, newCdSize, true);
  nev.setUint32(16, newCdOffset, true);
  
  const totalSize = cdOffset + insertSize + cdSize + cdEntry.length + 22;
  const result = new Uint8Array(totalSize);
  result.set(bytes.slice(0, cdOffset), 0);                           // local files originais
  result.set(localHeader, cdOffset);                                  // .cpg local header
  result.set(cpgData, cdOffset + localHeader.length);                 // .cpg conteúdo
  result.set(bytes.slice(cdOffset, cdOffset + cdSize), newCdOffset);  // CD original
  result.set(cdEntry, newCdOffset + cdSize);                          // CD entry do .cpg
  result.set(newEocd, totalSize - 22);                                // novo EOCD
  
  return result.buffer;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function ShapefileUpload({ onUploadComplete }: ShapefileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('bairros');
  const [cor, setCor] = useState('#3B82F6');
  const [opacidade, setOpacidade] = useState(0.3);
  const [geojsonPreview, setGeojsonPreview] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [wasConverted, setWasConverted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setNome('');
    setTipo('bairros');
    setCor('#3B82F6');
    setOpacidade(0.3);
    setGeojsonPreview(null);
    setFileName('');
    setWasConverted(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.geojson') && !file.name.endsWith('.json')) {
      toast.error('Por favor, envie um arquivo .zip (shapefile) ou .geojson/.json');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);
    setWasConverted(false);

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
          // shpjs depende de Buffer (Node.js) — polyfill para o navegador
          if (typeof globalThis.Buffer === 'undefined') {
            try {
              const bufferModule = await import('buffer');
              globalThis.Buffer = bufferModule.Buffer;
            } catch (bufErr) {
              console.error('Falha ao carregar polyfill de Buffer:', bufErr);
              throw new Error(
                'Dependência "buffer" não encontrada. ' +
                'Execute no terminal do projeto: npm install buffer'
              );
            }
          }

          const shp = (await import('shpjs')).default;
          const arrayBuffer = await file.arrayBuffer();
          
          // Injetar .cpg no zip se não existir (fix encoding Latin-1)
          const processedBuffer = ensureEncodingInZip(arrayBuffer);
          const geojson = await shp(processedBuffer);
          
          // Se retornou múltiplas camadas, pegar a primeira
          geoData = Array.isArray(geojson) ? geojson[0] : geojson;
        } catch (shpError: any) {
          console.error('Erro shpjs:', shpError);

          // Buffer.from não encontrado (polyfill ausente)
          if (
            shpError.message?.includes("reading 'from'") ||
            shpError.message?.includes('Buffer is not defined') ||
            shpError.message?.includes('buffer')
          ) {
            throw new Error(
              'Dependência "buffer" não encontrada para processar shapefiles. ' +
              'Execute no terminal: npm install buffer'
            );
          }
          if (shpError.message?.includes('proj4')) {
            throw new Error(
              'Shapefile sem arquivo de projeção (.prj). Tente converter para GeoJSON primeiro.'
            );
          }
          throw new Error(
            'Erro ao processar shapefile. Verifique se o .zip contém os arquivos .shp, .dbf e .shx juntos. ' +
            'Um .zip apenas com o .shp não é suficiente.'
          );
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

      // Normalizar para FeatureCollection
      if (!geoData.features) {
        if (geoData.type === 'Feature') {
          geoData = { type: 'FeatureCollection', features: [geoData] };
        } else if (geoData.type === 'GeometryCollection') {
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

      // Verificar e converter de UTM para WGS84 se necessário
      const firstCoord = getFirstCoordinate(geoData);
      if (firstCoord && isUTM(firstCoord)) {
        console.log('Coordenadas em UTM detectadas, convertendo para WGS84...');
        geoData = convertGeoJSONToWGS84(geoData);
        setWasConverted(true);
        toast.info('Coordenadas UTM detectadas e convertidas automaticamente para WGS84');
      }

      // Corrigir encoding dos textos (Latin-1 -> UTF-8)
      geoData = fixGeoJSONEncoding(geoData);

      // Salvar preview
      setGeojsonPreview(geoData);
      
      // Sugerir nome baseado no arquivo
      if (!nome) {
        setNome(file.name.replace(/\.(zip|geojson|json)$/i, '').replace(/_/g, ' '));
      }

      toast.success(`${geoData.features.length} feições carregadas com sucesso!`);
      
    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar o arquivo: ' + (error.message || 'Verifique se o arquivo está correto'));
      setGeojsonPreview(null);
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!geojsonPreview) {
      toast.error('Nenhum arquivo carregado');
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

  // Obter nome de exemplo da primeira feature
  const getExampleName = () => {
    const props = geojsonPreview?.features?.[0]?.properties;
    if (!props) return null;
    
    const nameFields = ['NOME', 'nome', 'NAME', 'name', 'NM_BAIRRO', 'BAIRRO', 'NM_MUNICIP'];
    for (const field of nameFields) {
      if (props[field]) return props[field];
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <Upload className="h-4 w-4" />
          Importar Shapefile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Importar Camada Geográfica
          </DialogTitle>
          <DialogDescription>
            Importe um arquivo shapefile (.zip) ou GeoJSON para adicionar uma camada ao mapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
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
                    {wasConverted && (
                      <span className="text-xs text-blue-600">
                        ✓ Convertido de UTM para WGS84
                      </span>
                    )}
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
                <strong>Propriedades:</strong>{' '}
                {getFeatureProperties().slice(0, 5).join(', ')}
                {getFeatureProperties().length > 5 && ` (+${getFeatureProperties().length - 5})`}
                {getExampleName() && (
                  <span className="block mt-1">
                    <strong>Exemplo:</strong> {getExampleName()}
                  </span>
                )}
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
              Arquivos em UTM são convertidos automaticamente. 
              Baixe shapefiles no site do IBGE, TSE ou da prefeitura.
            </p>
            <p className="mt-1 text-xs">
              O .zip do shapefile deve conter pelo menos os arquivos{' '}
              <strong>.shp</strong>, <strong>.dbf</strong> e <strong>.shx</strong> juntos.
              Um .zip apenas com o .shp não funciona.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
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
