import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { CalendarIcon, Filter, X, FileText, Users, BarChart3, Clock } from 'lucide-react';
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
    demandas?: {
      status?: string;
      areaIds?: string[];
      prioridade?: string;
      bairro?: string;
      cidade?: string;
      dataInicio?: string;
      dataFim?: string;
    };
    municipes?: {
      tagIds?: string[];
      bairro?: string;
      cidade?: string;
    };
  }) => void;
}

export function FiltrosCruzados({ 
  tags, 
  areas, 
  bairros, 
  onFiltrosChange 
}: FiltrosCruzadosProps) {
  // Estados para filtros de Demandas
  const [statusDemanda, setStatusDemanda] = useState<string>('');
  const [areasSelecionadas, setAreasSelecionadas] = useState<string[]>([]);
  const [prioridadeDemanda, setPrioridadeDemanda] = useState<string>('');
  const [bairroDemanda, setBairroDemanda] = useState<string>('');
  const [cidadeDemanda, setCidadeDemanda] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();

  // Estados para filtros de Munícipes
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [bairroMunicipe, setBairroMunicipe] = useState<string>('');
  const [cidadeMunicipe, setCidadeMunicipe] = useState<string>('');

  // Status disponíveis
  const statusOptions = [
    { value: 'solicitada', label: 'Solicitada' },
    { value: 'em_producao', label: 'Em Produção' },
    { value: 'encaminhado', label: 'Encaminhado' },
    { value: 'devolvido', label: 'Devolvido' },
    { value: 'visitado', label: 'Visitado' },
    { value: 'atendido', label: 'Atendido' },
  ];

  // Prioridades disponíveis
  const prioridadeOptions = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' },
  ];

  const aplicarFiltros = () => {
    const filtros: any = {
      demandas: {},
      municipes: {}
    };

    // Filtros de demandas - só adiciona se não for vazio
    if (statusDemanda && statusDemanda !== 'todos') {
      filtros.demandas.status = statusDemanda;
    }
    if (areasSelecionadas.length > 0) {
      filtros.demandas.areaIds = areasSelecionadas;
    }
    if (prioridadeDemanda && prioridadeDemanda !== 'todos') {
      filtros.demandas.prioridade = prioridadeDemanda;
    }
    if (bairroDemanda && bairroDemanda !== 'todos') {
      filtros.demandas.bairro = bairroDemanda;
    }
    if (cidadeDemanda) {
      filtros.demandas.cidade = cidadeDemanda;
    }
    if (dataInicio && dataFim) {
      filtros.demandas.dataInicio = format(dataInicio, 'yyyy-MM-dd');
      filtros.demandas.dataFim = format(dataFim, 'yyyy-MM-dd');
    }

    // Filtros de munícipes
    if (tagsSelecionadas.length > 0) {
      filtros.municipes.tagIds = tagsSelecionadas;
    }
    if (bairroMunicipe && bairroMunicipe !== 'todos') {
      filtros.municipes.bairro = bairroMunicipe;
    }
    if (cidadeMunicipe) {
      filtros.municipes.cidade = cidadeMunicipe;
    }

    console.log('Aplicando filtros:', filtros);
    onFiltrosChange(filtros);
  };

  const limparFiltros = () => {
    setStatusDemanda('');
    setAreasSelecionadas([]);
    setPrioridadeDemanda('');
    setBairroDemanda('');
    setCidadeDemanda('');
    setDataInicio(undefined);
    setDataFim(undefined);
    setTagsSelecionadas([]);
    setBairroMunicipe('');
    setCidadeMunicipe('');
    
    onFiltrosChange({});
  };

  const toggleArea = (areaId: string) => {
    setAreasSelecionadas(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const toggleTag = (tagId: string) => {
    setTagsSelecionadas(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Aplicar filtros automaticamente quando algum filtro mudar
  useEffect(() => {
    const timer = setTimeout(() => {
      aplicarFiltros();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [
    statusDemanda, areasSelecionadas, prioridadeDemanda, bairroDemanda, cidadeDemanda, dataInicio, dataFim,
    tagsSelecionadas, bairroMunicipe, cidadeMunicipe
  ]);

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-lg">Filtros Cruzados</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={limparFiltros}
          className="h-8"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar Tudo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEÇÃO DEMANDAS */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Demandas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Status</Label>
              <Select value={statusDemanda} onValueChange={setStatusDemanda}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Área</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {areas.map(area => (
                  <div key={area.id} className="flex items-center space-x-2 py-1">
                    <Checkbox 
                      id={`area-${area.id}`}
                      checked={areasSelecionadas.includes(area.id)}
                      onCheckedChange={() => toggleArea(area.id)}
                    />
                    <Label 
                      htmlFor={`area-${area.id}`}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: area.cor }}
                      />
                      <span>{area.nome}</span>
                    </Label>
                  </div>
                ))}
              </div>
              {areasSelecionadas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {areasSelecionadas.map(areaId => {
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Prioridade</Label>
                <Select value={prioridadeDemanda} onValueChange={setPrioridadeDemanda}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {prioridadeOptions.map(pri => (
                      <SelectItem key={pri.value} value={pri.value}>
                        {pri.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Bairro</Label>
                <Select value={bairroDemanda} onValueChange={setBairroDemanda}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bairros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os bairros</SelectItem>
                    {bairros.map(bairro => (
                      <SelectItem key={bairro} value={bairro}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Cidade</Label>
              <Input 
                placeholder="Filtrar por cidade"
                value={cidadeDemanda}
                onChange={(e) => setCidadeDemanda(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Período (Criação)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
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
                        className="w-full justify-start text-left font-normal"
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
            </div>
          </CardContent>
        </Card>

        {/* SEÇÃO MUNÍCIPES */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Munícipes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Grupos (Tags)</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center space-x-2 py-1">
                    <Checkbox 
                      id={`tag-${tag.id}`}
                      checked={tagsSelecionadas.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    <Label 
                      htmlFor={`tag-${tag.id}`}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.cor }}
                      />
                      <span>{tag.nome}</span>
                    </Label>
                  </div>
                ))}
              </div>
              {tagsSelecionadas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tagsSelecionadas.map(tagId => {
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Bairro</Label>
                <Select value={bairroMunicipe} onValueChange={setBairroMunicipe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bairros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os bairros</SelectItem>
                    {bairros.map(bairro => (
                      <SelectItem key={bairro} value={bairro}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Cidade</Label>
                <Input 
                  placeholder="Filtrar por cidade"
                  value={cidadeMunicipe}
                  onChange={(e) => setCidadeMunicipe(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="text-xs text-muted-foreground">
                Filtros ativos: 
                <span className="ml-1">
                  {areasSelecionadas.length + tagsSelecionadas.length + 
                   (statusDemanda && statusDemanda !== 'todos' ? 1 : 0) +
                   (prioridadeDemanda && prioridadeDemanda !== 'todos' ? 1 : 0) +
                   (bairroDemanda && bairroDemanda !== 'todos' ? 1 : 0) +
                   (bairroMunicipe && bairroMunicipe !== 'todos' ? 1 : 0) +
                   (cidadeDemanda ? 1 : 0) +
                   (cidadeMunicipe ? 1 : 0) +
                   (dataInicio && dataFim ? 1 : 0)}
                </span>
              </div>
              <Button 
                onClick={aplicarFiltros} 
                className="w-full mt-3"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Card>
  );
}
