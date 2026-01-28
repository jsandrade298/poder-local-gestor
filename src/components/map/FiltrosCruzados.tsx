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
import { CalendarIcon, Filter, X, FileText, Users, BarChart3, MapPin, Home } from 'lucide-react';
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
  areas: Area[];
  tags: Tag[];
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

// Opções fixas para status e prioridade
const statusOptions = [
  { value: 'solicitada', label: 'Solicitada' },
  { value: 'em_producao', label: 'Em Produção' },
  { value: 'encaminhado', label: 'Encaminhado' },
  { value: 'devolvido', label: 'Devolvido' },
  { value: 'visitado', label: 'Visitado' },
  { value: 'atendido', label: 'Atendido' },
];

const prioridadeOptions = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

export function FiltrosCruzados({ 
  areas, 
  tags, 
  bairros, 
  onFiltrosChange 
}: FiltrosCruzadosProps) {
  // Estados para filtros de Demandas
  const [statusDemanda, setStatusDemanda] = useState<string>('');
  const [areasSelecionadas, setAreasSelecionadas] = useState<string[]>([]);
  const [prioridadeDemanda, setPrioridadeDemanda] = useState<string>('');
  const [bairroDemanda, setBairroDemanda] = useState<string>('');
  const [cidadeDemanda, setCidadeDemanda] = useState<string>('');
  const [dataInicioDemanda, setDataInicioDemanda] = useState<Date>();
  const [dataFimDemanda, setDataFimDemanda] = useState<Date>();

  // Estados para filtros de Munícipes
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [bairroMunicipe, setBairroMunicipe] = useState<string>('');
  const [cidadeMunicipe, setCidadeMunicipe] = useState<string>('');

  // Cidades únicas (podem vir do backend, mas vamos usar um array fixo para exemplo)
  const cidadesOptions = [
    'Santo André', 'São Paulo', 'São Bernardo do Campo', 'São Caetano do Sul',
    'Diadema', 'Mauá', 'Ribeirão Pires', 'Rio Grande da Serra'
  ];

  // Aplicar filtros sempre que houver mudança
  useEffect(() => {
    const filtrosAtivos = {
      demandas: {
        ...(statusDemanda && { status: statusDemanda }),
        ...(areasSelecionadas.length > 0 && { areaIds: areasSelecionadas }),
        ...(prioridadeDemanda && { prioridade: prioridadeDemanda }),
        ...(bairroDemanda && { bairro: bairroDemanda }),
        ...(cidadeDemanda && { cidade: cidadeDemanda }),
        ...(dataInicioDemanda && dataFimDemanda && {
          dataInicio: format(dataInicioDemanda, 'yyyy-MM-dd'),
          dataFim: format(dataFimDemanda, 'yyyy-MM-dd')
        }),
      },
      municipes: {
        ...(tagsSelecionadas.length > 0 && { tagIds: tagsSelecionadas }),
        ...(bairroMunicipe && { bairro: bairroMunicipe }),
        ...(cidadeMunicipe && { cidade: cidadeMunicipe }),
      }
    };

    onFiltrosChange(filtrosAtivos);
  }, [
    statusDemanda, areasSelecionadas, prioridadeDemanda, bairroDemanda, cidadeDemanda,
    dataInicioDemanda, dataFimDemanda, tagsSelecionadas, bairroMunicipe, cidadeMunicipe
  ]);

  const limparFiltros = () => {
    setStatusDemanda('');
    setAreasSelecionadas([]);
    setPrioridadeDemanda('');
    setBairroDemanda('');
    setCidadeDemanda('');
    setDataInicioDemanda(undefined);
    setDataFimDemanda(undefined);
    setTagsSelecionadas([]);
    setBairroMunicipe('');
    setCidadeMunicipe('');
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Filtros Cruzados</h2>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={limparFiltros}
          className="h-8"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar Filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEÇÃO DE DEMANDAS */}
        <Card className="border border-blue-100">
          <CardHeader className="pb-3 bg-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5" />
              Demandas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={statusDemanda} onValueChange={setStatusDemanda}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um status" />
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

            {/* Áreas */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Áreas</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                {areas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhuma área disponível
                  </p>
                ) : (
                  areas.map(area => (
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
                          style={{ backgroundColor: area.cor || '#6b7280' }}
                        />
                        <span>{area.nome}</span>
                      </Label>
                    </div>
                  ))
                )}
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

            {/* Prioridade */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prioridade</Label>
              <Select value={prioridadeDemanda} onValueChange={setPrioridadeDemanda}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as prioridades</SelectItem>
                  {prioridadeOptions.map(prio => (
                    <SelectItem key={prio.value} value={prio.value}>
                      {prio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bairro */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bairro</Label>
              <Select value={bairroDemanda} onValueChange={setBairroDemanda}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um bairro" />
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

            {/* Cidade */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cidade</Label>
              <Select value={cidadeDemanda} onValueChange={setCidadeDemanda}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as cidades</SelectItem>
                  {cidadesOptions.map(cidade => (
                    <SelectItem key={cidade} value={cidade}>
                      {cidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período (Criação)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-9"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dataInicioDemanda ? (
                          format(dataInicioDemanda, 'dd/MM/yyyy', { locale: ptBR })
                        ) : (
                          <span className="text-muted-foreground">Data inicial</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicioDemanda}
                        onSelect={setDataInicioDemanda}
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
                        className="w-full justify-start text-left font-normal h-9"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dataFimDemanda ? (
                          format(dataFimDemanda, 'dd/MM/yyyy', { locale: ptBR })
                        ) : (
                          <span className="text-muted-foreground">Data final</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFimDemanda}
                        onSelect={setDataFimDemanda}
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

        {/* SEÇÃO DE MUNÍCIPES */}
        <Card className="border border-green-100">
          <CardHeader className="pb-3 bg-green-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Users className="h-5 w-5" />
              Munícipes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Grupos (Tags)</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                {tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhuma tag disponível
                  </p>
                ) : (
                  tags.map(tag => (
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
                          style={{ backgroundColor: tag.cor || '#6b7280' }}
                        />
                        <span>{tag.nome}</span>
                      </Label>
                    </div>
                  ))
                )}
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

            {/* Bairro */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bairro</Label>
              <Select value={bairroMunicipe} onValueChange={setBairroMunicipe}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um bairro" />
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

            {/* Cidade */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cidade</Label>
              <Select value={cidadeMunicipe} onValueChange={setCidadeMunicipe}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as cidades</SelectItem>
                  {cidadesOptions.map(cidade => (
                    <SelectItem key={cidade} value={cidade}>
                      {cidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
