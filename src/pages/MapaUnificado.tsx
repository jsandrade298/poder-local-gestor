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
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto py-2 px-3">
          <div className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">
              {selectedValues.length === 0 && title}
              {selectedValues.length === 1 && options.find(o => o.value === selectedValues[0])?.label}
              {selectedValues.length > 1 && `${selectedValues.length} selecionados`}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
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
                      <Badge key={s} variant="secondary" className="text-[10px] h-5 px
