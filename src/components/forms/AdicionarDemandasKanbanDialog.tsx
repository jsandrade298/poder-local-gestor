import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateTime } from '@/lib/dateUtils';

interface AdicionarDemandasKanbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdicionarDemandasKanbanDialog({ open, onOpenChange }: AdicionarDemandasKanbanDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("aguardando");
  const [areaFilter, setAreaFilter] = useState("all");
  const [municipeFilter, setMunicipeFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [selectedDemandas, setSelectedDemandas] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Buscar demandas não incluídas no kanban
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-nao-kanban'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome)
        `)
        .not('status', 'in', '(aberta,em_andamento,resolvida)')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar demandas:', error);
        throw error;
      }
      return data || [];
    },
    enabled: open
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar áreas:', error);
        throw error;
      }
      return data || [];
    },
    enabled: open
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar responsáveis:', error);
        throw error;
      }
      return data || [];
    },
    enabled: open
  });

  const { data: municipes = [] } = useQuery({
    queryKey: ['municipes-select'], // Chave específica para seleção
    queryFn: async () => {
      console.log('🔄 Kanban Form: Carregando munícipes para seleção...');
      
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome')
        .order('nome')
        .limit(10000); // Limite alto para garantir que pega todos
      
      if (error) {
        console.error('❌ Kanban Form: Erro ao buscar munícipes:', error);
        throw error;
      }
      
      console.log(`✅ Kanban Form: ${data?.length || 0} munícipes carregados para seleção`);
      return data || [];
    },
    enabled: open
  });

  const adicionarKanbanMutation = useMutation({
    mutationFn: async (demandaIds: string[]) => {
      const { error } = await supabase
        .from('demandas')
        .update({ status: 'aberta' })
        .in('id', demandaIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['demandas-nao-kanban'] });
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
    const matchesResponsavel = responsavelFilter === "all" || demanda.responsavel_id === responsavelFilter;

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
          <DialogTitle>Adicionar Demandas ao Kanban</DialogTitle>
          <DialogDescription>
            Selecione as demandas que deseja adicionar à produção legislativa. 
            Elas serão adicionadas na coluna "A Fazer".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-[250px]">
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
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Área" />
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

            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("aguardando");
                setAreaFilter("all");
                setMunicipeFilter("all");
                setPrioridadeFilter("all");
                setResponsavelFilter("all");
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar
            </Button>
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
                  Selecionar todas ({filteredDemandas.length})
                </label>
              </div>
              <Badge variant="secondary">
                {selectedDemandas.length} selecionada(s)
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredDemandas.length} demanda(s) disponível(is)
            </p>
          </div>

          {/* Lista de demandas */}
          <div className="border rounded-lg flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Carregando demandas...</span>
              </div>
            ) : filteredDemandas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma demanda encontrada com os filtros selecionados.</p>
                <p className="text-xs mt-1">Todas as demandas já estão no kanban ou foram canceladas.</p>
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