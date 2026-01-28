import { useState, useMemo } from 'react';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, RefreshCw, Search, Filter, 
  Route as RouteIcon, Navigation, Layers, Tag,
  Check, ChevronsUpDown, X
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
import { cn } from "@/lib/utils";

import { ClusterMap, MapMarker } from '@/components/map/ClusterMap';

// --- CONFIGURAÇÃO DE CORES DE STATUS ---
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'solicitada': { color: '#64748b', label: 'Solicitada' },      // Slate
  'em_producao': { color: '#eab308', label: 'Em Produção' },    // Amarelo
  'encaminhado': { color: '#3b82f6', label: 'Encaminhado' },    // Azul
  'atendido': { color: '#22c55e', label: 'Atendido' },          // Verde
  'devolvido': { color: '#ef4444', label: 'Devolvido' },        // Vermelho
  'visitado': { color: '#a855f7', label: 'Visitado' }           // Roxo/Lilás
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatAddress = (data: any) => {
  const parts = [
    data.logradouro || data.rua || data.endereco,
    data.numero,
    data.bairro
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(', ');
  return data.endereco_completo || 'Endereço não cadastrado';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAreaName = (demanda: any): string | null => {
  const areaObj = demanda.area || demanda.areas;
  if (!areaObj) return null;
  if (typeof areaObj === 'object') return areaObj.nome || null;
  if (typeof areaObj === 'string') return areaObj;
  return null;
};

export default function MapaUnificado() {
  const { center, zoom } = useMapConfig();
  const { demandas, municipes, isLoading, refetch } = useMapaUnificado();

  // --- ESTADOS ---
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MapMarker[]>([]);
  const [activeTabLeft, setActiveTabLeft] = useState("filtros");
  
  // Estados de Filtro (AGORA SÃO ARRAYS PARA MULTI-SELEÇÃO)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]); // 'demanda', 'municipe'

  // --- OPÇÕES DOS FILTROS (Extraídas dos dados) ---
  const filterOptions = useMemo(() => {
    const areas = new Set<string>();
    const tags = new Set<string>();

    demandas.forEach(d => {
      const areaNome = getAreaName(d);
      if (areaNome) areas.add(areaNome);
    });

    municipes.forEach(m => {
      if (Array.isArray(m.tags)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.tags.forEach((t: any) => {
            const tagName = typeof t === 'object' ? t.nome : t;
            if (tagName) tags.add(tagName);
        });
      }
    });

    return {
      areas: Array.from(areas).sort().map(a => ({ label: a, value: a })),
      tags: Array.from(tags).sort().map(t => ({ label: t, value: t })),
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
    // 1. Converter Demandas
    const demandaMarkers: MapMarker[] = demandas.map(d => {
      const statusKey = normalizeStatusKey(d.status);
      const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['solicitada'];
      return {
        id: d.id,
        latitude: d.latitude,
        longitude: d.longitude,
        title: d.titulo,
        description: d.protocolo,
        status: d.status,
        color: config.color, 
        type: 'demanda',
        originalData: d
      };
    });

    // 2. Converter Munícipes
    const municipeMarkers: MapMarker[] = municipes.map(m => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.nome,
      description: m.bairro || '',
      color: '#3b82f6', // Azul
      type: 'municipe',
      originalData: m
    }));

    let all = [...demandaMarkers, ...municipeMarkers];

    // --- APLICAR FILTROS (MULTI-SELEÇÃO) ---

    // 1. Texto (Busca Global)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      all = all.filter(m => 
        m.title.toLowerCase().includes(lowerTerm) || 
        formatAddress(m.originalData).toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Tipo (Multi-select)
    if (tipoFilter.length > 0) {
      all = all.filter(m => tipoFilter.includes(m.type));
    }

    // 3. Status (Apenas Demandas - Inclusivo)
    if (statusFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'municipe') return true;
        return statusFilter.includes(normalizeStatusKey(m.status || ''));
      });
    }

    // 4. Áreas (Apenas Demandas - Inclusivo)
    if (areaFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'municipe') return true;
        const areaNome = getAreaName(m.originalData);
        return areaNome && areaFilter.includes(areaNome);
      });
    }

    // 5. Tags (Apenas Munícipes - Inclusivo)
    if (tagFilter.length > 0) {
      all = all.filter(m => {
        if (m.type === 'demanda') return true;
        const tags = m.originalData.tags || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const selectedDemandas = selectedItems.filter(i => i.type === 'demanda');
  const selectedMunicipes = selectedItems.filter(i => i.type === 'municipe');

  // --- UI ---
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
            {filteredMarkers.length} itens visíveis
          </p>
        </div>

        <Tabs value={activeTabLeft} onValueChange={setActiveTabLeft} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="filtros" className="gap-2"><Filter className="h-4 w-4" /> Filtros</TabsTrigger>
              <TabsTrigger value="rota" className="gap-2"><RouteIcon className="h-4 w-4" /> Rotas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="filtros" className="flex-1 p-4 space-y-5 overflow-y-auto">
            
            {/* Busca */}
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
              
              {/* Filtro: Tipo */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Tipo de Dado</Label>
                <MultiSelectFilter 
                  title="Todos os tipos" 
                  options={filterOptions.tipos} 
                  selectedValues={tipoFilter} 
                  onChange={setTipoFilter}
                />
              </div>

              {/* Filtro: Status */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500">Status (Demandas)</Label>
                <MultiSelectFilter 
                  title="Todos os status" 
                  options={filterOptions.status} 
                  selectedValues={statusFilter} 
                  onChange={setStatusFilter}
                />
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

              {/* Filtro: Áreas */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Layers className="h-3 w-3" /> Áreas (Demandas)
                </Label>
                <MultiSelectFilter 
                  title="Todas as áreas" 
                  options={filterOptions.areas} 
                  selectedValues={areaFilter} 
                  onChange={setAreaFilter}
                />
              </div>

              {/* Filtro: Tags */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Tag className="h-3 w-3" /> Tags (Munícipes)
                </Label>
                <MultiSelectFilter 
                  title="Todas as tags" 
                  options={filterOptions.tags} 
                  selectedValues={tagFilter} 
                  onChange={setTagFilter}
                />
              </div>

            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Mapa
            </Button>
          </TabsContent>

          <TabsContent value="rota" className="flex-1 p-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                    <Navigation className="h-4 w-4" /> Roteirização
                </div>
                <p className="text-sm text-blue-600">
                    Selecione pontos no mapa para criar uma lista de visita otimizada.
                </p>
            </div>
            <div className="mt-8 text-center text-gray-400 text-sm">
                (Funcionalidade em desenvolvimento)
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
                    <Card key={item.id} className="p-4 bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftColor: item.color }}>
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
                      
                      <Button size="sm" variant="outline" className="w-full text-xs h-8 bg-gray-50 border-dashed">
                        Ver Detalhes
                      </Button>
                    </Card>
                  ))}
                </ScrollArea>
            </TabsContent>

            {/* ABA MUNÍCIPES */}
            <TabsContent value="municipes" className="flex-1 overflow-auto p-4 space-y-3 m-0">
                <ScrollArea className="h-full pr-3">
                  {selectedMunicipes.map((item) => (
                    <Card key={item.id} className="p-3 bg-white border-l-4 border-blue-500 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
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
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {item.originalData.tags.slice(0, 3).map((t: any, idx: number) => (
                                    <span key={idx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border">
                                        {typeof t === 'object' ? t.nome : t}
                                    </span>
                                ))}
                            </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
