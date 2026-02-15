import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Loader2, Map as MapIcon, FileUp, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShapefileUploadProps {
  onUploadComplete: (geojson: any, nome: string, tipo: string, cor: string, opacidade: number) => void;
}

// ============================================
// UTM → WGS84
// ============================================

function utmToLatLon(easting: number, northing: number, zone: number = 23, hemisphere: 'N'|'S' = 'S'): [number, number] {
  const a=6378137.0, f=1/298.257223563, k0=0.9996;
  const e=Math.sqrt(2*f-f*f), e2=e*e, ePrime2=e2/(1-e2);
  const x=easting-500000; let y=northing; if(hemisphere==='S') y-=10000000;
  const lon0=((zone-1)*6-180+3)*Math.PI/180;
  const M=y/k0, mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256));
  const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  let phi1=mu+(3*e1/2-27*Math.pow(e1,3)/32)*Math.sin(2*mu);
  phi1+=(21*e1*e1/16-55*Math.pow(e1,4)/32)*Math.sin(4*mu);
  phi1+=(151*Math.pow(e1,3)/96)*Math.sin(6*mu);
  phi1+=(1097*Math.pow(e1,4)/512)*Math.sin(8*mu);
  const N1=a/Math.sqrt(1-e2*Math.sin(phi1)*Math.sin(phi1));
  const T1=Math.tan(phi1)*Math.tan(phi1), C1=ePrime2*Math.cos(phi1)*Math.cos(phi1);
  const R1=a*(1-e2)/Math.pow(1-e2*Math.sin(phi1)*Math.sin(phi1),1.5), D=x/(N1*k0);
  const lat=phi1-(N1*Math.tan(phi1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ePrime2)*Math.pow(D,4)/24+(61+90*T1+298*C1+45*T1*T1-252*ePrime2-3*C1*C1)*Math.pow(D,6)/720);
  const lon=lon0+(D-(1+2*T1+C1)*Math.pow(D,3)/6+(5-2*C1+28*T1-3*C1*C1+8*ePrime2+24*T1*T1)*Math.pow(D,5)/120)/Math.cos(phi1);
  return [lat*180/Math.PI, lon*180/Math.PI];
}

function detectarZonaUTMFromPrj(prj: string): {zone:number;hemisphere:'N'|'S'}|null {
  if(!prj) return null;
  const mz=prj.match(/UTM[\s_]*zone[\s_]*(\d+)([NS])?/i);
  if(mz) return {zone:parseInt(mz[1]),hemisphere:(mz[2]?.toUpperCase()==='N'?'N':'S')};
  const me=prj.match(/AUTHORITY\["EPSG","(31\d{3})"/);
  if(me){const e=parseInt(me[1]);if(e>=31960&&e<=31999) return {zone:e-31960,hemisphere:'S'};}
  const mc=prj.match(/central_meridian["]*,\s*([-\d.]+)/i);
  if(mc){const cm=parseFloat(mc[1]);const z=Math.round((cm+180-3)/6+1);
    if(z>=1&&z<=60) return {zone:z,hemisphere:prj.includes('10000000')||prj.toLowerCase().includes('south')?'S':'N'};}
  return null;
}

function isUTM(c: number[]): boolean { return !!c && c.length>=2 && (Math.abs(c[0])>1000||Math.abs(c[1])>100000); }

function convertCoordsToWGS84(coords: any, zone: number, hemi: 'N'|'S'): any {
  if(typeof coords[0]==='number'){const[lat,lon]=utmToLatLon(coords[0],coords[1],zone,hemi);return[lon,lat];}
  return coords.map((c:any)=>convertCoordsToWGS84(c,zone,hemi));
}

function convertGeoJSONToWGS84(geo: any, zone: number=23, hemi: 'N'|'S'='S'): any {
  const c=JSON.parse(JSON.stringify(geo));
  for(const f of c.features) if(f?.geometry?.coordinates) f.geometry.coordinates=convertCoordsToWGS84(f.geometry.coordinates,zone,hemi);
  return c;
}

function getFirstCoordinate(geo: any): number[]|null {
  try{let c=geo?.features?.[0]?.geometry?.coordinates;while(Array.isArray(c)&&Array.isArray(c[0]))c=c[0];return c;}catch{return null;}
}

// ============================================
// ENCODING FIX
// ============================================

function fixEncoding(text: string): string {
  if(!text) return text;
  const r:[RegExp,string][]=[
    [/Ã¡/g,'á'],[/Ã /g,'à'],[/Ã¢/g,'â'],[/Ã£/g,'ã'],[/Ã¤/g,'ä'],
    [/Ã©/g,'é'],[/Ã¨/g,'è'],[/Ãª/g,'ê'],[/Ã«/g,'ë'],
    [/Ã­/g,'í'],[/Ã¬/g,'ì'],[/Ã®/g,'î'],[/Ã¯/g,'ï'],
    [/Ã³/g,'ó'],[/Ã²/g,'ò'],[/Ã´/g,'ô'],[/Ãµ/g,'õ'],[/Ã¶/g,'ö'],
    [/Ãº/g,'ú'],[/Ã¹/g,'ù'],[/Ã»/g,'û'],[/Ã¼/g,'ü'],
    [/Ã§/g,'ç'],[/Ã±/g,'ñ'],
    [/Ã/g,'Á'],[/Ã€/g,'À'],[/Ã‚/g,'Â'],[/Ãƒ/g,'Ã'],[/Ã„/g,'Ä'],
    [/Ã‰/g,'É'],[/Ãˆ/g,'È'],[/ÃŠ/g,'Ê'],[/Ã‹/g,'Ë'],
    [/Ã/g,'Í'],[/ÃŒ/g,'Ì'],[/ÃŽ/g,'Î'],[/Ã/g,'Ï'],
    [/Ã"/g,'Ó'],[/Ã'/g,'Ò'],[/Ã"/g,'Ô'],[/Ã•/g,'Õ'],[/Ã–/g,'Ö'],
    [/Ãš/g,'Ú'],[/Ã™/g,'Ù'],[/Ã›/g,'Û'],[/Ãœ/g,'Ü'],
    [/Ã‡/g,'Ç'],[/Ã'/g,'Ñ'],[/Ã£o/g,'ão'],[/Ã§Ã£o/g,'ção'],
  ];
  let res=text;for(const[p,rep] of r) res=res.replace(p,rep);return res;
}

function fixGeoJSONEncoding(geo: any): any {
  if(!geo?.features) return geo;
  for(const f of geo.features) if(f?.properties)
    for(const k of Object.keys(f.properties))
      if(typeof f.properties[k]==='string') f.properties[k]=fixEncoding(f.properties[k]);
  return geo;
}

// ============================================
// MINIMAL ZIP CREATOR (para fallback de .shp individuais)
// ============================================

function crc32(data: Uint8Array): number {
  let crc=~0;for(let i=0;i<data.length;i++){crc^=data[i];for(let j=0;j<8;j++) crc=(crc>>>1)^(crc&1?0xEDB88320:0);}return(~crc)>>>0;
}

async function createMinimalZip(files: File[]): Promise<ArrayBuffer> {
  const entries:{name:Uint8Array;data:Uint8Array;offset:number}[]=[];
  const enc=new TextEncoder(), bufs: Uint8Array[]=[]; let offset=0;
  for(const file of files){
    const ext=file.name.split('.').pop()?.toLowerCase()||'';
    if(!['shp','dbf','shx','prj','cpg'].includes(ext)) continue;
    const data=new Uint8Array(await file.arrayBuffer()), name=enc.encode(file.name);
    const h=new Uint8Array(30+name.length), hv=new DataView(h.buffer);
    hv.setUint32(0,0x04034b50,true);hv.setUint16(4,20,true);hv.setUint16(8,0,true);
    hv.setUint32(14,crc32(data),true);hv.setUint32(18,data.length,true);hv.setUint32(22,data.length,true);
    hv.setUint16(26,name.length,true);h.set(name,30);
    entries.push({name,data,offset});bufs.push(h,data);offset+=h.length+data.length;
  }
  const csOff=offset;
  for(const e of entries){
    const cd=new Uint8Array(46+e.name.length),cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint32(16,crc32(e.data),true);cv.setUint32(20,e.data.length,true);cv.setUint32(24,e.data.length,true);
    cv.setUint16(28,e.name.length,true);cv.setUint32(42,e.offset,true);cd.set(e.name,46);
    bufs.push(cd);offset+=cd.length;
  }
  const eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
  ev.setUint32(12,offset-csOff,true);ev.setUint32(16,csOff,true);bufs.push(eocd);
  const total=bufs.reduce((s,b)=>s+b.length,0),res=new Uint8Array(total);let pos=0;
  for(const b of bufs){res.set(b,pos);pos+=b.length;}return res.buffer;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface LayerInfo { name: string; featureCount: number; geoData: any; }

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
  const [utmInfo, setUtmInfo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shpFilesRef = useRef<HTMLInputElement>(null);
  
  const [layerOptions, setLayerOptions] = useState<LayerInfo[]>([]);
  const [selectedLayerIdx, setSelectedLayerIdx] = useState('0');
  const [pendingPrjContent, setPendingPrjContent] = useState<string|null>(null);
  const [uploadMode, setUploadMode] = useState<'zip'|'individual'>('zip');
  const [shpFileNames, setShpFileNames] = useState('');

  const resetForm = () => {
    setNome('');setTipo('bairros');setCor('#3B82F6');setOpacidade(0.3);
    setGeojsonPreview(null);setFileName('');setWasConverted(false);setUtmInfo('');
    setLayerOptions([]);setSelectedLayerIdx('0');setPendingPrjContent(null);
    setUploadMode('zip');setShpFileNames('');
    if(fileInputRef.current) fileInputRef.current.value='';
    if(shpFilesRef.current) shpFilesRef.current.value='';
  };

  const finalizeGeoJSON = (geoData: any, sourceName: string, prjContent: string|null) => {
    if(!geoData.features){
      if(geoData.type==='Feature') geoData={type:'FeatureCollection',features:[geoData]};
      else if(geoData.type==='GeometryCollection') geoData={type:'FeatureCollection',features:geoData.geometries.map((g:any,i:number)=>({type:'Feature',properties:{id:i},geometry:g}))};
      else throw new Error('Estrutura GeoJSON não reconhecida');
    }
    if(geoData.features.length===0) throw new Error('Nenhuma feição encontrada');

    const firstCoord=getFirstCoordinate(geoData);
    if(firstCoord && isUTM(firstCoord)){
      let zone=23,hemisphere:'N'|'S'='S';
      const prjInfo=prjContent?detectarZonaUTMFromPrj(prjContent):null;
      if(prjInfo){zone=prjInfo.zone;hemisphere=prjInfo.hemisphere;}
      geoData=convertGeoJSONToWGS84(geoData,zone,hemisphere);
      setWasConverted(true);setUtmInfo(`UTM Zona ${zone}${hemisphere}`);
      toast.info(`Coordenadas UTM (Zona ${zone}${hemisphere}) convertidas para WGS84`);
    }

    geoData=fixGeoJSONEncoding(geoData);
    setGeojsonPreview(geoData);
    if(!nome) setNome(sourceName.replace(/\.(zip|geojson|json|shp)$/i,'').replace(/[_-]/g,' '));
    toast.success(`${geoData.features.length} feições carregadas!`);
  };

  // ===== ZIP / GEOJSON =====
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    const ext=file.name.split('.').pop()?.toLowerCase();
    if(!['zip','geojson','json'].includes(ext||'')){toast.error('Envie .zip, .geojson ou .json');return;}
    setIsLoading(true);setFileName(file.name);setWasConverted(false);setUtmInfo('');
    setLayerOptions([]);setGeojsonPreview(null);
    try{
      if(ext==='geojson'||ext==='json'){
        const text=await file.text(); let parsed=JSON.parse(text);
        if(typeof parsed==='string') parsed=JSON.parse(parsed);
        if(!parsed?.type) throw new Error('Arquivo não é um GeoJSON válido');
        finalizeGeoJSON(parsed,file.name,null);
      } else {
        const buffer=await file.arrayBuffer();
        await processZip(buffer,file.name);
      }
    }catch(err:any){
      console.error('Erro:',err);toast.error(err.message||'Erro ao processar');
      setGeojsonPreview(null);setFileName('');
    }finally{setIsLoading(false);}
  };

  const processZip = async (buffer: ArrayBuffer, originalName: string) => {
    // Extrair .prj do zip via busca por texto (sem jszip)
    let prjContent: string|null=null;
    try{
      const text=new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(buffer));
      const m=text.match(/PROJCS\[[\s\S]*?\]\]/) || text.match(/GEOGCS\[[\s\S]*?\]\]/);
      if(m) prjContent=m[0];
    }catch{}
    setPendingPrjContent(prjContent);

    const shp=(await import('shpjs')).default;
    const result=await shp(buffer);

    if(Array.isArray(result)&&result.length>1){
      const layers:LayerInfo[]=result.map((layer,idx)=>{
        const fc=layer?.type==='FeatureCollection'?layer:{type:'FeatureCollection',features:[]};
        const count=fc.features?.length||0;
        const firstProp=fc.features?.[0]?.properties;
        let name=`Camada ${idx+1} (${count} feições)`;
        if(firstProp){
          const nk=Object.keys(firstProp).find(k=>/^(NOME|NAME|NM_|BAIRRO|LABEL)/i.test(k));
          if(nk&&firstProp[nk]) name=`Camada ${idx+1}: ${firstProp[nk]} ... (${count} feições)`;
        }
        return {name,featureCount:count,geoData:fc};
      });
      setLayerOptions(layers);setSelectedLayerIdx('0');
      toast.info(`${layers.length} camadas encontradas. Selecione qual importar.`);
      return;
    }

    const geoData=Array.isArray(result)?result[0]:result;
    if(!geoData?.type) throw new Error('Shapefile retornou dados inválidos');
    finalizeGeoJSON(geoData,originalName,prjContent);
  };

  const handleLayerConfirm = () => {
    const layer=layerOptions[parseInt(selectedLayerIdx)];
    if(!layer) return;
    try{finalizeGeoJSON(layer.geoData,layer.name,pendingPrjContent);setLayerOptions([]);}
    catch(err:any){toast.error(err.message||'Erro');}
  };

  // ===== INDIVIDUAL .SHP FILES =====
  const handleShpFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files=Array.from(e.target.files||[]); if(!files.length) return;
    const byExt:Record<string,File>={};
    files.forEach(f=>{const ext=f.name.split('.').pop()?.toLowerCase()||'';byExt[ext]=f;});
    if(!byExt['shp']){toast.error('Selecione o arquivo .shp');return;}
    if(!byExt['dbf']){toast.error('O arquivo .dbf é obrigatório');return;}

    const shpFile=byExt['shp'];
    setIsLoading(true);setFileName(shpFile.name);setWasConverted(false);setUtmInfo('');
    setLayerOptions([]);setGeojsonPreview(null);
    setShpFileNames(files.map(f=>'.'+f.name.split('.').pop()?.toLowerCase()).join(', '));

    try{
      const prjContent=byExt['prj']?await byExt['prj'].text():null;
      const shp=(await import('shpjs')).default;
      let geoData:any;

      // Tentar formato objeto (shpjs v4+)
      try{
        const input:any={shp:await byExt['shp'].arrayBuffer(),dbf:await byExt['dbf'].arrayBuffer()};
        if(prjContent) input.prj=prjContent;
        geoData=await shp(input);
      }catch(objErr){
        // Fallback: criar zip em memória
        console.warn('shpjs obj input falhou, criando zip...',objErr);
        const zipBuffer=await createMinimalZip(files);
        geoData=await shp(zipBuffer);
      }

      if(Array.isArray(geoData)) geoData=geoData[0];
      if(!geoData?.type) throw new Error('Shapefile retornou dados inválidos');
      finalizeGeoJSON(geoData,shpFile.name,prjContent);
    }catch(err:any){
      console.error('Erro:',err);
      toast.error(err.message||'Erro ao processar. Tente compactar em .zip.');
      setGeojsonPreview(null);setFileName('');
    }finally{setIsLoading(false);}
  };

  const handleConfirm = () => {
    if(!geojsonPreview){toast.error('Nenhum arquivo carregado');return;}
    if(!nome.trim()){toast.error('Informe um nome para a camada');return;}
    onUploadComplete(geojsonPreview,nome.trim(),tipo,cor,opacidade);
    setIsOpen(false);resetForm();
  };

  const handleOpenChange=(open:boolean)=>{setIsOpen(open);if(!open)resetForm();};

  const getFeatureProperties=()=>{
    if(!geojsonPreview?.features?.[0]?.properties) return [];
    return Object.keys(geojsonPreview.features[0].properties);
  };
  const getExampleName=()=>{
    const props=geojsonPreview?.features?.[0]?.properties; if(!props) return null;
    for(const f of ['NOME','nome','NAME','name','NM_BAIRRO','BAIRRO','NM_MUNICIP','NOME_BAIRR','NM_DISTRIT','LABEL'])
      if(props[f]) return props[f];
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <Upload className="h-4 w-4" />
          Importar Camada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" /> Importar Camada Geográfica
          </DialogTitle>
          <DialogDescription>
            Shapefile (.zip ou .shp+.dbf) ou GeoJSON para adicionar ao mapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Modo de upload */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Formato</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${uploadMode==='zip'?'border-primary bg-primary/5':'border-muted hover:border-muted-foreground/30'}`}
                onClick={()=>{setUploadMode('zip');setGeojsonPreview(null);setLayerOptions([]);}}>
                <FileUp className="h-5 w-5" />
                <span className="text-xs font-medium">.zip ou .geojson</span>
                <span className="text-[10px] text-muted-foreground">Shapefile compactado ou GeoJSON</span>
              </button>
              <button type="button" className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${uploadMode==='individual'?'border-primary bg-primary/5':'border-muted hover:border-muted-foreground/30'}`}
                onClick={()=>{setUploadMode('individual');setGeojsonPreview(null);setLayerOptions([]);}}>
                <Layers className="h-5 w-5" />
                <span className="text-xs font-medium">.shp + .dbf + .shx</span>
                <span className="text-[10px] text-muted-foreground">Arquivos separados</span>
              </button>
            </div>
          </div>

          {/* Upload ZIP/GeoJSON */}
          {uploadMode==='zip' && (
            <div className="space-y-2">
              <Label>Arquivo (.zip, .geojson ou .json)</Label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${geojsonPreview?'border-green-500 bg-green-50/50 dark:bg-green-950/20':'border-muted-foreground/25 hover:border-primary/50'}`}>
                <input ref={fileInputRef} type="file" accept=".zip,.geojson,.json" onChange={handleFileChange} className="hidden" id="shapefile-input" disabled={isLoading}/>
                <label htmlFor="shapefile-input" className="cursor-pointer flex flex-col items-center gap-2">
                  {isLoading?(<><Loader2 className="h-8 w-8 animate-spin text-primary"/><span className="text-sm text-muted-foreground">Processando...</span></>)
                  :geojsonPreview?(<>
                    <CheckCircle2 className="h-8 w-8 text-green-600"/>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{fileName}</span>
                    <span className="text-xs text-green-600 dark:text-green-500">{geojsonPreview.features.length} feições carregadas</span>
                    {wasConverted&&<span className="text-xs text-blue-600 dark:text-blue-400">✓ Convertido de {utmInfo} para WGS84</span>}
                    <span className="text-xs text-muted-foreground mt-1">Clique para trocar</span>
                  </>):(<>
                    <FileUp className="h-8 w-8 text-muted-foreground"/>
                    <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo</span>
                    <span className="text-xs text-muted-foreground">Shapefile (.zip) ou GeoJSON (.geojson / .json)</span>
                  </>)}
                </label>
              </div>
            </div>
          )}

          {/* Upload individual .shp */}
          {uploadMode==='individual' && (
            <div className="space-y-2">
              <Label>Selecione os arquivos do Shapefile</Label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${geojsonPreview?'border-green-500 bg-green-50/50 dark:bg-green-950/20':'border-muted-foreground/25 hover:border-primary/50'}`}>
                <input ref={shpFilesRef} type="file" accept=".shp,.dbf,.shx,.prj,.cpg,.sbn,.sbx,.qix" multiple onChange={handleShpFilesChange} className="hidden" id="shp-files-input" disabled={isLoading}/>
                <label htmlFor="shp-files-input" className="cursor-pointer flex flex-col items-center gap-2">
                  {isLoading?(<><Loader2 className="h-8 w-8 animate-spin text-primary"/><span className="text-sm text-muted-foreground">Processando...</span></>)
                  :geojsonPreview?(<>
                    <CheckCircle2 className="h-8 w-8 text-green-600"/>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{fileName}</span>
                    <span className="text-xs text-green-600 dark:text-green-500">{geojsonPreview.features.length} feições</span>
                    {shpFileNames&&<span className="text-xs text-muted-foreground">Arquivos: {shpFileNames}</span>}
                    {wasConverted&&<span className="text-xs text-blue-600 dark:text-blue-400">✓ Convertido de {utmInfo} para WGS84</span>}
                    <span className="text-xs text-muted-foreground mt-1">Clique para trocar</span>
                  </>):(<>
                    <Layers className="h-8 w-8 text-muted-foreground"/>
                    <span className="text-sm text-muted-foreground">Selecione todos os arquivos de uma vez</span>
                    <span className="text-xs text-muted-foreground">Obrigatórios: <strong>.shp</strong> + <strong>.dbf</strong> · Recomendados: .shx, .prj</span>
                  </>)}
                </label>
              </div>
            </div>
          )}

          {/* Multi-layer selection */}
          {layerOptions.length>1 && !geojsonPreview && (
            <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
              <Layers className="h-4 w-4 text-blue-600"/>
              <AlertDescription className="space-y-3">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{layerOptions.length} camadas encontradas</p>
                <RadioGroup value={selectedLayerIdx} onValueChange={setSelectedLayerIdx}>
                  {layerOptions.map((layer,idx)=>(
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem value={String(idx)} id={`layer-${idx}`}/>
                      <Label htmlFor={`layer-${idx}`} className="text-sm cursor-pointer">{layer.name}</Label>
                    </div>
                  ))}
                </RadioGroup>
                <Button size="sm" onClick={handleLayerConfirm} className="w-full gap-1">
                  <CheckCircle2 className="h-3 w-3"/> Carregar camada selecionada
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {geojsonPreview && getFeatureProperties().length>0 && (
            <Alert>
              <AlertCircle className="h-4 w-4"/>
              <AlertDescription className="text-xs">
                <strong>Propriedades:</strong>{' '}
                {getFeatureProperties().slice(0,6).join(', ')}
                {getFeatureProperties().length>6&&` (+${getFeatureProperties().length-6})`}
                {getExampleName()&&<span className="block mt-1"><strong>Exemplo:</strong> {getExampleName()}</span>}
              </AlertDescription>
            </Alert>
          )}

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome-camada">Nome da Camada *</Label>
            <Input id="nome-camada" placeholder="Ex: Bairros de Santo André" value={nome} onChange={e=>setNome(e.target.value)}/>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Camada</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue/></SelectTrigger>
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
                <Input type="color" value={cor} onChange={e=>setCor(e.target.value)} className="w-12 h-9 p-1 cursor-pointer"/>
                <Input value={cor} onChange={e=>setCor(e.target.value)} placeholder="#3B82F6" className="flex-1 font-mono text-sm"/>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opacidade: {Math.round(opacidade*100)}%</Label>
              <Slider value={[opacidade]} onValueChange={([v])=>setOpacidade(v)} min={0.1} max={0.8} step={0.1} className="mt-3"/>
            </div>
          </div>

          {/* Dica */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">📌 Dica:</p>
            <p>
              Coordenadas em UTM (SIRGAS 2000, SAD69) são convertidas automaticamente.
              A zona UTM é detectada do .prj quando presente.
              {uploadMode==='individual'&&' Selecione .shp, .dbf, .shx e .prj ao mesmo tempo.'}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={()=>handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!geojsonPreview||!nome.trim()||isLoading}>Importar Camada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
