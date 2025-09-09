import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Filter, Check, ChevronsUpDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMunicipesSelect } from "@/hooks/useMunicipesSelect";
import { formatDateTime } from '@/lib/dateUtils';
import { cn } from "@/lib/utils";

interface AdicionarDemandasKanbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser?: string; // Para filtrar demandas por usuário responsável
}

export function AdicionarDemandasKanbanDialog({ open, onOpenChange, selectedUser }: AdicionarDemandasKanbanDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [municipeFilter, setMunicipeFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [selectedDemandas, setSelectedDemandas] = useState<string[]>([]);
  const [municipeOpen, setMunicipeOpen] = useState(false);
  const queryClient = useQueryClient();

  // Buscar todas as demandas (permitindo adicionar a múltiplos kanbans)
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-disponiveis'],
    queryFn: async () => {
      let allDemandas: any[] = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('demandas')
          .select(`
            *,
            areas(nome),
            municipes(nome)
          `)
          .range(start, start + batchSize - 1)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Erro ao buscar demandas:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allDemandas = [...allDemandas, ...data];
          start += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      
      return allDemandas;
    },
    enabled: open
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      let allAreas: any[] = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('areas')
          .select('id, nome')
          .range(start, start + batchSize - 1)
          .order('nome');
        
        if (error) {
          console.error('Erro ao buscar áreas:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allAreas = [...allAreas, ...data];
          start += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      
      return allAreas;
    },
    enabled: open
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      let allResponsaveis: any[] = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nome')
          .range(start, start + batchSize - 1)
          .order('nome');
        
        if (error) {
          console.error('Erro ao buscar responsáveis:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allResponsaveis = [...allResponsaveis, ...data];
          start += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      
      return allResponsaveis;
    },
    enabled: open
  });

  const { data: municipes = [] } = useMunicipesSelect();

  const adicionarKanbanMutation = useMutation({
    mutationFn: async (demandaIds: string[]) => {
      // Inserir na tabela de relacionamento (usar ON CONFLICT para evitar duplicatas)
      const kanbanEntries = demandaIds.map(demandaId => ({
        demanda_id: demandaId,
        kanban_type: selectedUser || 'producao-legislativa',
        kanban_position: 'a_fazer'
      }));

      const { error } = await supabase
        .from('demanda_kanbans')
        .upsert(kanbanEntries, { 
          onConflict: 'demanda_id,kanban_type',
          ignoreDuplicates: false 
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['demandas-disponiveis'] });
      toast.success(`${selectedDemandas.length} demanda(s) adicionada(s) ao kanban!`);
      setSelectedDemandas([]);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao adicionar demandas ao kanban:', error);
      toast.error("Erro ao adicionar demandas ao kanban");
    }
  });

  const filteredDemandas = demandas.filter(demanda => {
    const matchesSearch = demanda.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.municipes?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || demanda.status === statusFilter;
    const matchesArea = areaFilter === "all" || demanda.area_id === areaFilter;
    const matchesMunicipe = municipeFilter === "all" || demanda.municipe_id === municipeFilter;
    const matchesPrioridade = prioridadeFilter === "all" || demanda.prioridade === prioridadeFilter;
    const matchesResponsavel = responsavelFilter === "all" || 
                            (responsavelFilter === "undefined" && !demanda.responsavel_id) ||
                            demanda.responsavel_id === responsavelFilter;

    return matchesSearch && matchesStatus && matchesArea && matchesMunicipe && matchesPrioridade && matchesResponsavel;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'em_andamento': return 'Em Andamento';
      case 'aguardando': return 'Aguardando';
      case 'resolvida': return 'Resolvida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'aberta': return 'default';
      case 'em_andamento': return 'secondary';
      case 'aguardando': return 'outline';
      case 'resolvida': return 'default';
      case 'cancelada': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return prioridade;
    }
  };

  const getPrioridadeVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'secondary';
      case 'media': return 'outline';
      case 'alta': return 'default';
      case 'urgente': return 'destructive';
      default: return 'outline';
    }
  };

  const handleSelectDemanda = (demandaId: string, checked: boolean) => {
    if (checked) {
      setSelectedDemandas(prev => [...prev, demandaId]);
    } else {
      setSelectedDemandas(prev => prev.filter(id => id !== demandaId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDemandas(filteredDemandas.map(d => d.id));
    } else {
      setSelectedDemandas([]);
    }
  };

  const handleConcluir = () => {
    if (selectedDemandas.length === 0) {
      toast.error("Selecione pelo menos uma demanda");
      return;
    }
    adicionarKanbanMutation.mutate(selectedDemandas);
  };

  const getResponsavelNome = (responsavelId: string | undefined) => {
    if (!responsavelId) return 'Não definido';
    const responsavel = responsaveis.find(r => r.id === responsavelId);
    return responsavel?.nome || 'Não definido';
  };

  const getMunicipeNome = (municipeId: string | undefined) => {
    if (!municipeId) return 'N/A';
    const municipe = municipes.find(m => m.id === municipeId);
    return municipe?.nome || 'N/A';
  };

  const getAreaNome = (areaId: string | undefined) => {
    if (!areaId) return 'N/A';
    const area = areas.find(a => a.id === areaId);
    return area?.nome || 'N/A';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Adicionar Demandas ao Kanban{" "}
            {selectedUser === "producao-legislativa" 
              ? "de Produção Legislativa"
              : `pessoal de ${responsaveis.find(r => r.id === selectedUser)?.nome || "usuário"}`
            }
          </DialogTitle>
          <DialogDescription>
            {selectedUser === "producao-legislativa" 
              ? "Selecione as demandas que deseja adicionar à produção legislativa."
              : `Selecione as demandas onde ${responsaveis.find(r => r.id === selectedUser)?.nome || "o usuário"} é responsável para adicionar ao kanban pessoal.`
            }
            {" "}Elas serão adicionadas na coluna "A Fazer".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Filtros organizados */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            {/* Grid de filtros com labels */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="aguardando">Aguardando</SelectItem>
                    <SelectItem value="resolvida">Resolvida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Área */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Área</label>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Áreas</SelectItem>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Munícipe */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Munícipe</label>
                <Popover open={municipeOpen} onOpenChange={setMunicipeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={municipeOpen}
                      className="w-full justify-between"
                    >
                      {municipeFilter === "all" 
                        ? "Todos os..."
                        : municipes.find(m => m.id === municipeFilter)?.nome || "Munícipe não encontrado"
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 bg-background border z-50">
                    <Command>
                      <CommandInput placeholder="Buscar munícipe..." />
                      <CommandList>
                        <CommandEmpty>Nenhum munícipe encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setMunicipeFilter("all");
                              setMunicipeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                municipeFilter === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Todos os Munícipes
                          </CommandItem>
                          {municipes.map((municipe) => (
                            <CommandItem
                              key={municipe.id}
                              value={municipe.nome}
                              onSelect={() => {
                                setMunicipeFilter(municipe.id);
                                setMunicipeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  municipeFilter === municipe.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {municipe.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Responsável */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Responsável</label>
                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="all">Todos os Responsáveis</SelectItem>
                    <SelectItem value="undefined">Sem Responsável</SelectItem>
                    {responsaveis.map((responsavel) => (
                      <SelectItem key={responsavel.id} value={responsavel.id}>
                        {responsavel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campo de busca textual */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por título, protocolo ou munícipe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Botão limpar filtros */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setAreaFilter("all");
                  setMunicipeFilter("all");
                  setPrioridadeFilter("all");
                  setResponsavelFilter("all");
                  setMunicipeOpen(false);
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Seleção e estatísticas */}
          <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedDemandas.length === filteredDemandas.length && filteredDemandas.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Selecionar todas ({filteredDemandas.length} de {demandas.length} total)
                </label>
              </div>
              <Badge variant="secondary">
                {selectedDemandas.length} selecionada(s)
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredDemandas.length} de {demandas.length} demanda(s) disponível(is)
              {demandas.length > 1000 && " (carregadas em lotes)"}
            </p>
          </div>

          {/* Lista de demandas */}
          <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Carregando todas as demandas em lotes...</span>
                <div className="ml-2 text-xs text-muted-foreground">
                  Isso pode levar alguns segundos para grandes volumes de dados
                </div>
              </div>
            ) : filteredDemandas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma demanda encontrada com os filtros selecionados.</p>
                <p className="text-xs mt-1">Ajuste os filtros para ver mais demandas.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Munícipe</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDemandas.map((demanda) => (
                    <TableRow key={demanda.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDemandas.includes(demanda.id)}
                          onCheckedChange={(checked) => 
                            handleSelectDemanda(demanda.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">#{demanda.protocolo}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium line-clamp-1">{demanda.titulo}</p>
                          {demanda.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {demanda.descricao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getMunicipeNome(demanda.municipe_id)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getAreaNome(demanda.area_id)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(demanda.status)}>
                          {getStatusLabel(demanda.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPrioridadeVariant(demanda.prioridade)}>
                          {getPrioridadeLabel(demanda.prioridade)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getResponsavelNome(demanda.responsavel_id)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDateTime(demanda.created_at).split(' ')[0]}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConcluir}
            disabled={selectedDemandas.length === 0 || adicionarKanbanMutation.isPending}
          >
            {adicionarKanbanMutation.isPending 
              ? "Adicionando..." 
              : `Adicionar ${selectedDemandas.length} demanda(s)`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}