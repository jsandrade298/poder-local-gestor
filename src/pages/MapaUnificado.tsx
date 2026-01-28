import { useState, useMemo, useCallback } from 'react';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { useMapaRota, PontoRota, formatarDistancia, formatarDuracao } from '@/hooks/useMapaRota';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, RefreshCw, Search, Filter, 
  Route as RouteIcon, Navigation, Layers, Tag,
  Check, ChevronsUpDown, X, Eye, PlusCircle,
  ChevronUp, ChevronDown, Trash2, MapIcon,
  ExternalLink, Copy, Locate, AlertTriangle,
  BarChart3, Users, FileText, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner"; 

// --- COMPONENTES DE MAPA E MODAIS ---
import { ClusterMap, MapMarker } from '@/components/map/ClusterMap';
import { ViewDemandaDialog } from '@/components/forms/ViewDemandaDialog';
import { MunicipeDetailsDialog } from '@/components/forms/MunicipeDetailsDialog';

// --- CONFIGURAÇÃO DE CORES DE STATUS ---
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'solicitada': { color: '#64748b', label: 'Solicitada' },      
  'em_producao': { color: '#eab308', label: 'Em Produção' },    
  'encaminhado': { color: '#3b82f6', label: 'Encaminhado' },    
  'atendido': { color: '#22c55e', label: 'Atendido' },          
  'devolvido': { color: '#ef4444', label: 'Devolvido' },        
  'visitado': { color: '#a855f7', label: 'Visitado' }           
};

const normalizeStatusKey = (status: string) => {
  if (!status) return 'solicitada';
  return status.toLowerCase().replace(/ /g, '_').replace(/ç/g, 'c').replace(/ã/g, 'a').replace(/õ/g, 'o');
};

// --- COMPONENTE DE MULTI-SELEÇÃO ---
interface MultiSelectFilterProps {
  title: string;
  options: { label: string; value: string; color?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  icon?: React.ReactNode;
}

function MultiSelectFilter({ title, options, selectedValues, onChange, icon }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleSelection = (value: string) => {
    const next = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto py-2 px-3 text-left font-normal">
          <div className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate block">
              {selectedValues.length === 0 && title}
              {selectedValues.length === 1 && options.find(o => o.value === selectedValues[0])?.label}
              {selectedValues.length > 1 && `${selectedValues.length} selecionados`}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${title}...`} />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggleSelection(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    {option.color && (
                      <div className="w-2 h-2 rounded-full mr-2" style={{ background: option.color }} />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="justify-center text-center font-medium"
                  >
                    Limpar Filtros
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// --- HELPERS ---
const formatAddress = (data: any) => {
  const parts = [
    data.logradouro || data.rua || data.endereco,
    data.numero,
    data.bairro
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(', ');
  return data.endereco_completo || 'Endereço não cadastrado';
};

const getAreaName = (demanda: any): string | null => {
  const areaObj = demanda.area || demanda.areas;
  if (!areaObj) return demanda.area_nome || null;
  if (typeof areaObj === 'object') return areaObj.nome || null;
  if (typeof areaObj === 'string') return areaObj;
  return null;
};

export default function MapaUnificado() {
  const { center, zoom } = useMapConfig();
  const { 
    demandas, 
    municipes, 
    areas,
    tags,
    isLoading, 
    refetch,
    semCoordenadas,
    geocodificando,
    progressoGeocodificacao,
    geocodificarTodos
  } = useMapaUnificado();

  // Hook de rotas
  const {
    pontosRota,
    pontoOrigem,
    rotaCalculada,
    calculandoRota,
    buscandoLocalizacao,
    adicionarPonto,
    removerPonto,
    moverPonto,
    limparRota,
    usarLocalizacaoAtual,
    calcularRotaOtimizada,
    abrirNoGoogleMaps,
    abrirNoWaze,
    copiarEnderecos,
    distanciaEstimada
  } = useMapaRota();

  // --- ESTADOS UI ---
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MapMarker[]>([]);
  const [activeTabLeft, setActiveTabLeft] = useState("filtros");
  const [showGeocodingAlert, setShowGeocodingAlert] = useState(false);
  
  // --- ESTADOS PARA MODAIS DE DETALHES ---
  const [demandaIdToView, setDemandaIdToView] = useState<string | null>(null);
  const [municipeIdToView, setMunicipeIdToView] = useState<string | null>(null);
  
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);

  // --- OPÇÕES DOS FILTROS ---
  const filterOptions = useMemo(() => {
    const areasSet = new Set<string>();
    const tagsSet = new Set<string>();

    demandas.forEach(d => {
      const areaNome = getAreaName(d);
      if (areaNome) areasSet.add(areaNome);
    });

    municipes.forEach(m => {
      if (Array.isArray(m.tags)) {
        m.tags.forEach((t: any) => {
          const tagName = typeof t === 'object' ? t.nome : t;
          if (tagName) tagsSet.add(tagName);
        });
      }
    });

    return {
      areas: Array.from(areasSet).sort().map(a => ({ label: a, value: a })),
      tags: Array.from(tagsSet).sort().map(t => ({ label: t, value: t })),
      status: Object.entries(STATUS_CONFIG).map(([key, config]) => ({
        label: config.label,
        value: key,
        color: config.color
      })),
      tipos: [
        { label: 'Demandas', value: 'demanda', color: '#ef4444' },
        { label: 'Munícipes', value: 'municipe', color: '#3b82f6' }
      ]
    };
  }, [demandas, municipes]);

  // --- FILTRAGEM DOS DADOS ---
  const filteredMarkers = useMemo(() => {
    // 1. Demandas
    const demandaMarkers: MapMarker[] = demandas.map(d => {
      const statusKey = normalizeStatusKey(d.status || '');
      const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['solicitada'];
      return {
        id: d.id,
        latitude: d.latitude!,
        longitude: d.longitude!,
        title: d.titulo,
        description: d.protocolo,
        status: d.status || 'solicitada',
        color: config.color, 
        type: 'demanda' as const,
        originalData: d
      };
    });

    // 2. Munícipes
    const municipeMarkers: MapMarker[] = municipes.map(m => ({
      id: m.id,
      latitude: m.latitude!,
      longitude: m.longitude!,
      title: m.nome,
      description: m.bairro || '',
      color: '#3b82f6',
      type: 'municipe' as const,
      originalData: m
    }));

    let all = [...demandaMarkers, ...municipeMarkers];

    // --- APLICAR FILTROS ---
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      all = all.filter(m => 
        m.title.toLowerCase().includes(lowerTerm) || 
        formatAddress(m.originalData).toLowerCase().includes(lowerTerm)
      );
    }

    if (tipoFilter.length > 0) {
      all = all.filter(m => tipoFilter.includes(m.type));
    }

    if (statusFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'municipe') return true;
        return statusFilter.includes(normalizeStatusKey(m.status || ''));
      });
    }

    if (areaFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'municipe') return true;
        const areaNome = getAreaName(m.originalData);
        return areaNome && areaFilter.includes(areaNome);
      });
    }

    if (tagFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'demanda') return true;
        const tags = m.originalData.tags || [];
        return tags.some((t: any) => {
          const tName = typeof t === 'object' ? t.nome : t;
          return tagFilter.includes(tName);
        });
      });
    }

    return all;
  }, [demandas, municipes, searchTerm, statusFilter, tipoFilter, areaFilter, tagFilter]);

  const handleClusterClick = (items: MapMarker[]) => {
    setSelectedItems(items);
    setIsRightPanelOpen(true);
  };

  const handleAddToRoute = useCallback((item: MapMarker) => {
    const ponto: PontoRota = {
      id: item.id,
      tipo: item.type as 'demanda' | 'municipe',
      nome: item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      endereco: formatAddress(item.originalData)
    };
    adicionarPonto(ponto);
  }, [adicionarPonto]);

  const selectedDemandas = selectedItems.filter(i => i.type === 'demanda');
  const selectedMunicipes = selectedItems.filter(i => i.type === 'municipe');

  // Estatísticas
  const totalSemCoordenadas = semCoordenadas.demandas + semCoordenadas.municipes;

  return (
    <div className="flex w-full h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 relative">
      
      {/* SIDEBAR ESQUERDA */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <MapPin className="h-5 w-5 text-primary" />
            Gestão Territorial
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredMarkers.length} itens no mapa
          </p>
          
          {/* Alerta de itens sem geocodificação */}
          {totalSemCoordenadas > 0 && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-2 text-amber-700 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{totalSemCoordenadas} itens sem localização</span>
              </div>
              <Button 
                variant="link" 
                size="sm" 
                className="text-xs h-6 p-0 text-amber-700"
                onClick={() => setShowGeocodingAlert(true)}
              >
                Geocodificar agora
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTabLeft} onValueChange={setActiveTabLeft} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="filtros" className="gap-1 text-xs"><Filter className="h-3.5 w-3.5" /> Filtros</TabsTrigger>
              <TabsTrigger value="rota" className="gap-1 text-xs"><RouteIcon className="h-3.5 w-3.5" /> Rotas</TabsTrigger>
              <TabsTrigger value="analise" className="gap-1 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Análise</TabsTrigger>
            </TabsList>
          </div>

          {/* ABA FILTROS */}
          <TabsContent value="filtros" className="flex-1 p-4 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-500">Busca Rápida</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Nome, protocolo, endereço..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Tipo de Dado</Label>
                <MultiSelectFilter title="Todos os tipos" options={filterOptions.tipos} selectedValues={tipoFilter} onChange={setTipoFilter} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Status (Demandas)</Label>
                <MultiSelectFilter title="Todos os status" options={filterOptions.status} selectedValues={statusFilter} onChange={setStatusFilter} />
                {statusFilter.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {statusFilter.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] h-5 px-1.5 cursor-pointer" onClick={() => setStatusFilter(prev => prev.filter(p => p !== s))}>
                        {STATUS_CONFIG[s]?.label} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2"><Layers className="h-3 w-3" /> Áreas (Demandas)</Label>
                <MultiSelectFilter title="Todas as áreas" options={filterOptions.areas} selectedValues={areaFilter} onChange={setAreaFilter} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2"><Tag className="h-3 w-3" /> Tags (Munícipes)</Label>
                <MultiSelectFilter title="Todas as tags" options={filterOptions.tags} selectedValues={tagFilter} onChange={setTagFilter} />
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Mapa
            </Button>
          </TabsContent>

          {/* ABA ROTAS */}
          <TabsContent value="rota" className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Origem */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Ponto de Origem</Label>
                {pontoOrigem ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Locate className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">{pontoOrigem.nome}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => usarLocalizacaoAtual()}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => usarLocalizacaoAtual()}
                    disabled={buscandoLocalizacao}
                  >
                    {buscandoLocalizacao ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Obtendo localização...</>
                    ) : (
                      <><Locate className="h-4 w-4 mr-2" /> Usar minha localização</>
                    )}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Lista de pontos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-gray-500">
                    Pontos de Visita ({pontosRota.length})
                  </Label>
                  {pontosRota.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500" onClick={limparRota}>
                      Limpar
                    </Button>
                  )}
                </div>

                {pontosRota.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Navigation className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum ponto adicionado</p>
                    <p className="text-xs mt-1">Clique nos marcadores do mapa e use "Add a Rota"</p>
                  </div>
                ) : (
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-2">
                      {pontosRota.map((ponto, index) => (
                        <div key={ponto.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ponto.nome}</p>
                            <p className="text-[10px] text-gray-500 truncate">{ponto.endereco}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={() => moverPonto(index, 'up')}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={() => moverPonto(index, 'down')}
                              disabled={index === pontosRota.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => removerPonto(ponto.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Resumo da rota */}
              {pontosRota.length > 0 && pontoOrigem && (
                <>
                  <Separator />
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    {rotaCalculada ? (
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800">
                          {formatarDistancia(rotaCalculada.distancia)}
                        </p>
                        <p className="text-sm text-blue-600">
                          ~{formatarDuracao(rotaCalculada.duracao)} de viagem
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-blue-600 text-sm">
                        <p>Distância estimada: ~{formatarDistancia(distanciaEstimada())}</p>
                      </div>
                    )}
                  </div>

                  {/* Botões de ação */}
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={() => calcularRotaOtimizada(true)}
                      disabled={calculandoRota}
                    >
                      {calculandoRota ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</>
                      ) : (
                        <><RouteIcon className="h-4 w-4 mr-2" /> Otimizar Rota</>
                      )}
                    </Button>

                    {rotaCalculada && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={abrirNoGoogleMaps}>
                          <MapIcon className="h-4 w-4 mr-2" /> Google Maps
                        </Button>
                        <Button variant="outline" onClick={abrirNoWaze}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Waze
                        </Button>
                      </div>
                    )}

                    <Button variant="ghost" className="w-full" onClick={copiarEnderecos}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar Roteiro
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ABA ANÁLISE */}
          <TabsContent value="analise" className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Cards de estatísticas */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-700">{demandas.length}</p>
                      <p className="text-xs text-red-600">Demandas</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold text-blue-700">{municipes.length}</p>
                      <p className="text-xs text-blue-600">Munícipes</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Status das demandas */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Status das Demandas</Label>
                <div className="space-y-1.5">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const count = demandas.filter(d => normalizeStatusKey(d.status || '') === key).length;
                    const percent = demandas.length > 0 ? (count / demandas.length) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                        <span className="text-xs flex-1">{config.label}</span>
                        <span className="text-xs font-medium">{count}</span>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ width: `${percent}%`, backgroundColor: config.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Top Áreas */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Top Áreas</Label>
                <div className="space-y-1.5">
                  {filterOptions.areas.slice(0, 5).map(area => {
                    const count = demandas.filter(d => getAreaName(d) === area.value).length;
                    return (
                      <div key={area.value} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{area.label}</span>
                        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Top Tags */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Top Tags (Munícipes)</Label>
                <div className="space-y-1.5">
                  {filterOptions.tags.slice(0, 5).map(tag => {
                    const count = municipes.filter(m => 
                      m.tags?.some((t: any) => (typeof t === 'object' ? t.nome : t) === tag.value)
                    ).length;
                    return (
                      <div key={tag.value} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{tag.label}</span>
                        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      {/* ÁREA DO MAPA */}
      <main className="flex-1 relative h-full bg-gray-200">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        )}

        {/* Barra de progresso de geocodificação */}
        {geocodificando && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white p-4 rounded-lg shadow-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Geocodificando endereços...</p>
                <p className="text-xs text-gray-500">
                  {progressoGeocodificacao.atual} de {progressoGeocodificacao.total}
                </p>
              </div>
            </div>
            <Progress 
              value={(progressoGeocodificacao.atual / progressoGeocodificacao.total) * 100} 
              className="mt-2 h-2"
            />
          </div>
        )}

        <div className="absolute inset-0 z-0">
          <ClusterMap
            markers={filteredMarkers}
            center={center}
            zoom={zoom}
            onClusterClick={handleClusterClick}
          />
        </div>
      </main>

      {/* SIDEBAR DIREITA (DETALHES) */}
      <Sheet open={isRightPanelOpen} onOpenChange={setIsRightPanelOpen} modal={false}>
        <SheetContent 
          side="right" 
          className="w-[400px] sm:w-[450px] p-0 shadow-2xl border-l border-gray-200 flex flex-col pointer-events-auto"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="p-5 border-b bg-white flex justify-between items-start">
            <div>
              <SheetTitle>Raio-X do Local</SheetTitle>
              <SheetDescription>
                Exibindo {selectedItems.length} itens agrupados.
              </SheetDescription>
            </div>
          </div>

          <Tabs defaultValue={selectedDemandas.length > 0 ? "demandas" : "municipes"} className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="px-5 pt-3 bg-white border-b">
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="demandas" disabled={selectedDemandas.length === 0}>
                  Demandas ({selectedDemandas.length})
                </TabsTrigger>
                <TabsTrigger value="municipes" disabled={selectedMunicipes.length === 0}>
                  Munícipes ({selectedMunicipes.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ABA DEMANDAS */}
            <TabsContent value="demandas" className="flex-1 overflow-auto p-4 space-y-3 m-0">
              <ScrollArea className="h-full pr-3">
                {selectedDemandas.map((item) => (
                  <Card key={item.id} className="p-4 bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow mb-3" style={{ borderLeftColor: item.color }}>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold" style={{ borderColor: item.color, color: item.color }}>
                        {item.originalData.status}
                      </Badge>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.originalData.protocolo}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1 text-gray-900 leading-tight">{item.title}</h4>
                    <div className="flex items-start gap-1.5 mb-3 mt-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {formatAddress(item.originalData)}
                      </p>
                    </div>
                    
                    {/* BOTÕES DE AÇÃO - DEMANDA */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full text-xs h-8"
                        onClick={() => setDemandaIdToView(item.id)}
                      >
                        <Eye className="w-3 h-3 mr-2" /> Ver Demanda
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full text-xs h-8 border-dashed"
                        onClick={() => handleAddToRoute(item)}
                      >
                        <PlusCircle className="w-3 h-3 mr-2" /> Add a Rota
                      </Button>
                    </div>
                  </Card>
                ))}
              </ScrollArea>
            </TabsContent>

            {/* ABA MUNÍCIPES */}
            <TabsContent value="municipes" className="flex-1 overflow-auto p-4 space-y-3 m-0">
              <ScrollArea className="h-full pr-3">
                {selectedMunicipes.map((item) => (
                  <Card key={item.id} className="p-3 bg-white border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow mb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0 border border-blue-100">
                        {item.title.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate text-gray-900">{item.title}</h4>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                            {formatAddress(item.originalData)}
                          </span>
                        </div>
                        {item.originalData.tags && item.originalData.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap mb-2">
                            {item.originalData.tags.slice(0, 3).map((t: any, idx: number) => (
                              <span key={idx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border">
                                {typeof t === 'object' ? t.nome : t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BOTÕES DE AÇÃO - MUNÍCIPE */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full text-xs h-8"
                        onClick={() => setMunicipeIdToView(item.id)}
                      >
                        <Eye className="w-3 h-3 mr-2" /> Ver Munícipe
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full text-xs h-8 border-dashed"
                        onClick={() => handleAddToRoute(item)}
                      >
                        <PlusCircle className="w-3 h-3 mr-2" /> Add a Rota
                      </Button>
                    </div>
                  </Card>
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* MODAIS DE VISUALIZAÇÃO */}
      <ViewDemandaDialog
        key={`demanda-${demandaIdToView}`}
        open={!!demandaIdToView}
        onOpenChange={(open) => !open && setDemandaIdToView(null)}
        demandaId={demandaIdToView || ""}
      />

      <MunicipeDetailsDialog
        key={`municipe-${municipeIdToView}`}
        open={!!municipeIdToView}
        onOpenChange={(open) => !open && setMunicipeIdToView(null)}
        municipeId={municipeIdToView || ""}
      />

      {/* DIALOG DE GEOCODIFICAÇÃO */}
      <AlertDialog open={showGeocodingAlert} onOpenChange={setShowGeocodingAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Geocodificar endereços</AlertDialogTitle>
            <AlertDialogDescription>
              Existem {semCoordenadas.demandas} demandas e {semCoordenadas.municipes} munícipes sem coordenadas no mapa.
              <br /><br />
              Deseja geocodificar automaticamente todos os endereços? Este processo pode levar alguns minutos.
              <br /><br />
              <strong>Nota:</strong> O processo respeita o limite de 1 requisição por segundo do serviço de geocodificação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowGeocodingAlert(false);
              geocodificarTodos();
            }}>
              Iniciar Geocodificação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
