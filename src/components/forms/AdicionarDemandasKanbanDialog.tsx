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
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [municipeFilter, setMunicipeFilter] = useState("all");
  const [cidadeFilter, setCidadeFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [selectedDemandas, setSelectedDemandas] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Buscar todas as demandas (incluindo canceladas)
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
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
      
      if (error) throw error;
      return data;
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
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Buscar munícipes únicos das demandas
  const { data: municipes = [] } = useQuery({
    queryKey: ['municipes-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Buscar cidades únicas das demandas
  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('cidade')
        .not('cidade', 'is', null)
        .order('cidade');
      
      if (error) throw error;
      return [...new Set(data.map(item => item.cidade))];
    },
    enabled: open
  });

  // Buscar bairros únicos das demandas
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('bairro')
        .not('bairro', 'is', null)
        .order('bairro');
      
      if (error) throw error;
      return [...new Set(data.map(item => item.bairro))];
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
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
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
    const matchesCidade = cidadeFilter === "all" || demanda.cidade === cidadeFilter;
    const matchesBairro = bairroFilter === "all" || demanda.bairro === bairroFilter;
    const matchesResponsavel = responsavelFilter === "all" || demanda.responsavel_id === responsavelFilter;

    return matchesSearch && matchesStatus && matchesArea && matchesMunicipe && matchesCidade && matchesBairro && matchesResponsavel;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'em_andamento': return 'Em Andamento';
      case 'aguardando': return 'Aguardando';
      case 'resolvida': return 'Resolvida';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'aberta': return 'default';
      case 'em_andamento': return 'secondary';
      case 'aguardando': return 'outline';
      case 'resolvida': return 'default';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar Demandas ao Kanban</DialogTitle>
          <DialogDescription>
            Selecione as demandas que deseja adicionar à produção legislativa. 
            Elas serão adicionadas na coluna "A Fazer".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-[200px]">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="resolvida">Resolvida</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[200px]">
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

            <Select value={municipeFilter} onValueChange={setMunicipeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Munícipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Munícipes</SelectItem>
                {municipes.map((municipe) => (
                  <SelectItem key={municipe.id} value={municipe.id}>
                    {municipe.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Cidades</SelectItem>
                {cidades.map((cidade) => (
                  <SelectItem key={cidade} value={cidade}>
                    {cidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bairroFilter} onValueChange={setBairroFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Bairros</SelectItem>
                {bairros.map((bairro) => (
                  <SelectItem key={bairro} value={bairro}>
                    {bairro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Responsáveis</SelectItem>
                {responsaveis.map((responsavel) => (
                  <SelectItem key={responsavel.id} value={responsavel.id}>
                    {responsavel.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setAreaFilter("all");
                setMunicipeFilter("all");
                setCidadeFilter("all");
                setBairroFilter("all");
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
          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Carregando demandas...</span>
              </div>
            ) : filteredDemandas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma demanda encontrada com os filtros selecionados.</p>
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
                        <span className="text-sm">{demanda.municipes?.nome || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{demanda.areas?.nome || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(demanda.status)}>
                          {getStatusLabel(demanda.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
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
            {adicionarKanbanMutation.isPending ? "Adicionando..." : `Adicionar ${selectedDemandas.length} demanda(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}