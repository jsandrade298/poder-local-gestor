import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, X, Users, FileText, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tag {
  id: string;
  nome: string;
  cor: string;
}

interface Area {
  id: string;
  nome: string;
  cor: string;
}

interface FiltrosCruzadosProps {
  tags: Tag[];
  areas: Area[];
  bairros: string[];
  onFiltrosChange: (filtros: {
    tagIds: string[];
    areaIds: string[];
    bairro?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => void;
}

export function FiltrosCruzados({ 
  tags, 
  areas, 
  bairros, 
  onFiltrosChange 
}: FiltrosCruzadosProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedBairro, setSelectedBairro] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();

  // Status disponíveis
  const statusOptions = [
    { value: 'solicitada', label: 'Solicitada' },
    { value: 'em_producao', label: 'Em Produção' },
    { value: 'encaminhado', label: 'Encaminhado' },
    { value: 'devolvido', label: 'Devolvido' },
    { value: 'visitado', label: 'Visitado' },
    { value: 'atendido', label: 'Atendido' },
  ];

  const aplicarFiltros = () => {
    onFiltrosChange({
      tagIds: selectedTags,
      areaIds: selectedAreas,
      bairro: selectedBairro || undefined,
      status: selectedStatus || undefined,
      dataInicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined,
      dataFim: dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined,
    });
  };

  const limparFiltros = () => {
    setSelectedTags([]);
    setSelectedAreas([]);
    setSelectedBairro('');
    setSelectedStatus('');
    setDataInicio(undefined);
    setDataFim(undefined);
    
    onFiltrosChange({
      tagIds: [],
      areaIds: [],
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  useEffect(() => {
    aplicarFiltros();
  }, [selectedTags, selectedAreas, selectedBairro, selectedStatus, dataInicio, dataFim]);

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Filtros Cruzados</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={limparFiltros}
          className="h-8"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filtro de Tags */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-3 w-3" />
            Grupos de Munícipes (Tags)
          </Label>
          <div className="max-h-40 overflow-y-auto border rounded-md p-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center space-x-2 py-1">
                <Checkbox 
                  id={`tag-${tag.id}`}
                  checked={selectedTags.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <Label 
                  htmlFor={`tag-${tag.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.cor }}
                  />
                  <span className="text-sm">{tag.nome}</span>
                </Label>
              </div>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedTags.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                return tag ? (
                  <Badge 
                    key={tagId} 
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${tag.cor}20`, color: tag.cor }}
                  >
                    {tag.nome}
                    <button 
                      onClick={() => toggleTag(tagId)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Filtro de Áreas */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="h-3 w-3" />
            Áreas de Demanda
          </Label>
          <div className="max-h-40 overflow-y-auto border rounded-md p-2">
            {areas.map(area => (
              <div key={area.id} className="flex items-center space-x-2 py-1">
                <Checkbox 
                  id={`area-${area.id}`}
                  checked={selectedAreas.includes(area.id)}
                  onCheckedChange={() => toggleArea(area.id)}
                />
                <Label 
                  htmlFor={`area-${area.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: area.cor }}
                  />
                  <span className="text-sm">{area.nome}</span>
                </Label>
              </div>
            ))}
          </div>
          {selectedAreas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedAreas.map(areaId => {
                const area = areas.find(a => a.id === areaId);
                return area ? (
                  <Badge 
                    key={areaId} 
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${area.cor}20`, color: area.cor }}
                  >
                    {area.nome}
                    <button 
                      onClick={() => toggleArea(areaId)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Filtros Adicionais */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3" />
            Filtros Avançados
          </Label>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Bairro</Label>
              <Select value={selectedBairro} onValueChange={setSelectedBairro}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos os bairros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os bairros</SelectItem>
                  {bairros.map(bairro => (
                    <SelectItem key={bairro} value={bairro}>
                      {bairro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Filtros por Data */}
        <div className="space-y-2">
          <Label className="text-xs">Período</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-8 justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dataInicio ? (
                      format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Data inicial</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-8 justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dataFim ? (
                      format(dataFim, 'dd/MM/yyyy', { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Data final</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="pt-4">
            <div className="text-xs text-muted-foreground mb-2">
              {selectedTags.length} tag(s) e {selectedAreas.length} área(s) selecionadas
            </div>
            <Button 
              onClick={aplicarFiltros} 
              className="w-full h-8 text-sm"
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
