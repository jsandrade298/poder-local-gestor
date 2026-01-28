import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CalendarIcon, X, Users, FileText, Settings2, Calendar as CalendarIconOutline } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tag {
  id: string;
  nome: string;
  cor: string | null;
}

interface Area {
  id: string;
  nome: string;
  cor: string | null;
}

interface FiltrosState {
  tagIds: string[];
  areaIds: string[];
  bairro?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  tags: Tag[];
  areas: Area[];
  bairros: string[];
}

interface FiltrosCruzadosProps {
  filtros: FiltrosState;
  onChange: (filtros: Partial<FiltrosState>) => void;
}

// Status disponíveis
const STATUS_OPTIONS = [
  { value: 'solicitada', label: 'Solicitada', cor: '#3b82f6' },
  { value: 'em_producao', label: 'Em Produção', cor: '#f59e0b' },
  { value: 'encaminhado', label: 'Encaminhado', cor: '#8b5cf6' },
  { value: 'devolvido', label: 'Devolvido', cor: '#ef4444' },
  { value: 'visitado', label: 'Visitado', cor: '#06b6d4' },
  { value: 'atendido', label: 'Atendido', cor: '#10b981' },
];

export function FiltrosCruzados({ filtros, onChange }: FiltrosCruzadosProps) {
  const { tags = [], areas = [], bairros = [] } = filtros;
  
  const [selectedTags, setSelectedTags] = useState<string[]>(filtros.tagIds || []);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(filtros.areaIds || []);
  const [selectedBairro, setSelectedBairro] = useState<string>(filtros.bairro || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(filtros.status || '');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(
    filtros.dataInicio ? new Date(filtros.dataInicio) : undefined
  );
  const [dataFim, setDataFim] = useState<Date | undefined>(
    filtros.dataFim ? new Date(filtros.dataFim) : undefined
  );

  // Aplicar filtros automaticamente quando mudam
  useEffect(() => {
    onChange({
      tagIds: selectedTags,
      areaIds: selectedAreas,
      bairro: selectedBairro || undefined,
      status: selectedStatus || undefined,
      dataInicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined,
      dataFim: dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined,
    });
  }, [selectedTags, selectedAreas, selectedBairro, selectedStatus, dataInicio, dataFim]);

  const limparFiltros = () => {
    setSelectedTags([]);
    setSelectedAreas([]);
    setSelectedBairro('');
    setSelectedStatus('');
    setDataInicio(undefined);
    setDataFim(undefined);
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

  const totalFiltrosAtivos = 
    selectedTags.length + 
    selectedAreas.length + 
    (selectedBairro ? 1 : 0) + 
    (selectedStatus ? 1 : 0) + 
    (dataInicio ? 1 : 0) + 
    (dataFim ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filtros Ativos:</span>
          {totalFiltrosAtivos > 0 ? (
            <Badge variant="secondary">{totalFiltrosAtivos}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhum</span>
          )}
        </div>
        {totalFiltrosAtivos > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={limparFiltros}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar todos
          </Button>
        )}
      </div>

      <Separator />

      {/* Accordion com seções de filtros */}
      <Accordion type="multiple" defaultValue={["tags", "areas"]} className="w-full">
        
        {/* Seção: Tags (Grupos de Munícipes) */}
        <AccordionItem value="tags">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span>Grupos de Munícipes</span>
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {selectedTags.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[180px] pr-3">
              <div className="space-y-2">
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Nenhuma tag cadastrada
                  </p>
                ) : (
                  tags.map(tag => (
                    <label 
                      key={tag.id} 
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox 
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id)}
                      />
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.cor || '#6b7280' }}
                      />
                      <span className="text-sm flex-1 truncate">{tag.nome}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
            
            {/* Tags selecionadas */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                {selectedTags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <Badge 
                      key={tagId} 
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-destructive/10"
                      style={{ 
                        borderColor: tag.cor || '#6b7280',
                        color: tag.cor || '#6b7280'
                      }}
                      onClick={() => toggleTag(tagId)}
                    >
                      {tag.nome}
                      <X className="h-2.5 w-2.5 ml-1" />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Seção: Áreas de Demanda */}
        <AccordionItem value="areas">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-rose-600" />
              <span>Áreas de Demanda</span>
              {selectedAreas.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {selectedAreas.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[180px] pr-3">
              <div className="space-y-2">
                {areas.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Nenhuma área cadastrada
                  </p>
                ) : (
                  areas.map(area => (
                    <label 
                      key={area.id} 
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox 
                        checked={selectedAreas.includes(area.id)}
                        onCheckedChange={() => toggleArea(area.id)}
                      />
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: area.cor || '#6b7280' }}
                      />
                      <span className="text-sm flex-1 truncate">{area.nome}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
            
            {/* Áreas selecionadas */}
            {selectedAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                {selectedAreas.map(areaId => {
                  const area = areas.find(a => a.id === areaId);
                  return area ? (
                    <Badge 
                      key={areaId} 
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-destructive/10"
                      style={{ 
                        borderColor: area.cor || '#6b7280',
                        color: area.cor || '#6b7280'
                      }}
                      onClick={() => toggleArea(areaId)}
                    >
                      {area.nome}
                      <X className="h-2.5 w-2.5 ml-1" />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Seção: Filtros Avançados */}
        <AccordionItem value="avancados">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-gray-600" />
              <span>Filtros Avançados</span>
              {(selectedBairro || selectedStatus) && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {(selectedBairro ? 1 : 0) + (selectedStatus ? 1 : 0)}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {/* Bairro */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Bairro</Label>
                <Select 
                  value={selectedBairro || '__all__'} 
                  onValueChange={(v) => setSelectedBairro(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os bairros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os bairros</SelectItem>
                    {bairros.map(bairro => (
                      <SelectItem key={bairro} value={bairro}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Status da Demanda</Label>
                <Select 
                  value={selectedStatus || '__all__'} 
                  onValueChange={(v) => setSelectedStatus(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os status</SelectItem>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: status.cor }}
                          />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Seção: Período */}
        <AccordionItem value="periodo">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <CalendarIconOutline className="h-4 w-4 text-indigo-600" />
              <span>Período</span>
              {(dataInicio || dataFim) && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {(dataInicio ? 1 : 0) + (dataFim ? 1 : 0)}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              {/* Data Início */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataInicio ? (
                        format(dataInicio, "dd 'de' MMM, yyyy", { locale: ptBR })
                      ) : (
                        <span className="text-muted-foreground">Selecionar data</span>
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

              {/* Data Fim */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataFim ? (
                        format(dataFim, "dd 'de' MMM, yyyy", { locale: ptBR })
                      ) : (
                        <span className="text-muted-foreground">Selecionar data</span>
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

              {/* Limpar datas */}
              {(dataInicio || dataFim) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-8 text-xs"
                  onClick={() => {
                    setDataInicio(undefined);
                    setDataFim(undefined);
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar período
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Resumo */}
      <Separator />
      <div className="text-xs text-muted-foreground text-center py-1">
        {selectedTags.length} tag(s) • {selectedAreas.length} área(s)
        {selectedBairro && ` • ${selectedBairro}`}
        {selectedStatus && ` • ${STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}`}
      </div>
    </div>
  );
}
