import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { toast } from "sonner";

export default function Demandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [municipeFilter, setMunicipeFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [cidadeFilter, setCidadeFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          municipes(nome),
          responsavel:profiles!demandas_responsavel_id_fkey(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
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
    }
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
    }
  });

  // Buscar valores únicos para cidade e bairro
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
    }
  });

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
    }
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta': return 'hsl(var(--chart-1))'; // #3b82f6
      case 'em_andamento': return 'hsl(var(--chart-2))'; // #f59e0b
      case 'aguardando': return 'hsl(var(--chart-3))'; // #8b5cf6
      case 'resolvida': return 'hsl(var(--chart-4))'; // #10b981
      case 'cancelada': return 'hsl(var(--chart-5))'; // #ef4444
      default: return 'hsl(var(--muted-foreground))';
    }
  };

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

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))'; // Verde
      case 'media': return 'hsl(var(--chart-2))'; // Laranja
      case 'alta': return 'hsl(var(--chart-1))'; // Azul
      case 'urgente': return 'hsl(var(--chart-5))'; // Vermelho
      default: return 'hsl(var(--muted-foreground))';
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

  const filteredDemandas = demandas.filter(demanda => {
    const matchesSearch = demanda.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demanda.municipes?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || demanda.status === statusFilter;
    const matchesArea = areaFilter === "all" || demanda.area_id === areaFilter;
    const matchesMunicipe = municipeFilter === "all" || demanda.municipe_id === municipeFilter;
    const matchesResponsavel = responsavelFilter === "all" || demanda.responsavel_id === responsavelFilter;
    const matchesCidade = cidadeFilter === "all" || demanda.cidade === cidadeFilter;
    const matchesBairro = bairroFilter === "all" || demanda.bairro === bairroFilter;

    return matchesSearch && matchesStatus && matchesArea && matchesMunicipe && matchesResponsavel && matchesCidade && matchesBairro;
  });

  // Mutação para excluir demanda
  const deleteMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase
        .from('demandas')
        .delete()
        .eq('id', demandaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      toast.success("Demanda excluída com sucesso!");
    },
    onError: (error) => {
      console.error('Erro ao excluir demanda:', error);
      toast.error("Erro ao excluir demanda");
    }
  });

  const handleViewDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsViewDialogOpen(true);
  };

  const handleEditDemanda = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsEditDialogOpen(true);
  };

  const handleDeleteDemanda = (demandaId: string) => {
    deleteMutation.mutate(demandaId);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setAreaFilter("all");
    setMunicipeFilter("all");
    setResponsavelFilter("all");
    setCidadeFilter("all");
    setBairroFilter("all");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando demandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Gestão de Demandas
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              Acompanhe e gerencie todas as demandas do gabinete
            </p>
          </div>
          <NovaDemandaDialog />
        </div>

        {/* Filtros */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por título, protocolo ou munícipe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="resolvida">Resolvida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as áreas</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={municipeFilter} onValueChange={setMunicipeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Munícipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os munícipes</SelectItem>
                  {demandas.map((demanda) => demanda.municipes).filter((municipe, index, self) => 
                    municipe && self.findIndex(m => m?.nome === municipe.nome) === index
                  ).map((municipe) => (
                    <SelectItem key={municipe?.nome} value={demandas.find(d => d.municipes?.nome === municipe?.nome)?.municipe_id || ""}>
                      {municipe?.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {responsaveis.map((responsavel) => (
                    <SelectItem key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {cidades.map((cidade) => (
                    <SelectItem key={cidade} value={cidade}>
                      {cidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bairroFilter} onValueChange={setBairroFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bairros</SelectItem>
                  {bairros.map((bairro) => (
                    <SelectItem key={bairro} value={bairro}>
                      {bairro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Demandas */}
        <div className="space-y-4">
          {filteredDemandas.length === 0 ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma demanda encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDemandas.map((demanda) => (
              <Card key={demanda.id} className="backdrop-blur-sm bg-card/95 border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {demanda.titulo}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          #{demanda.protocolo}
                        </Badge>
                        <Badge 
                          variant={getStatusVariant(demanda.status)}
                          style={{ backgroundColor: getStatusColor(demanda.status), color: 'white' }}
                        >
                          {getStatusLabel(demanda.status)}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          style={{ backgroundColor: getPrioridadeColor(demanda.prioridade), color: 'white' }}
                        >
                          {getPrioridadeLabel(demanda.prioridade)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Munícipe:</span> {demanda.municipes?.nome || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Área:</span> {demanda.areas?.nome || 'Sem área'}
                        </div>
                        <div>
                          <span className="font-medium">Responsável:</span> {demanda.responsavel?.nome || 'Sem responsável'}
                        </div>
                      </div>

                      {demanda.data_prazo && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Prazo:</span> {new Date(demanda.data_prazo).toLocaleDateString('pt-BR')}
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {demanda.descricao}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <div>Criado em</div>
                        <div className="font-medium">
                          {new Date(demanda.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border">
                          <DropdownMenuItem onClick={() => handleViewDemanda(demanda)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditDemanda(demanda)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a demanda "{demanda.titulo}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteDemanda(demanda.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog de Visualização */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Demanda</DialogTitle>
            </DialogHeader>
            {selectedDemanda && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Protocolo</label>
                    <p className="text-sm text-muted-foreground">#{selectedDemanda.protocolo}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <p className="text-sm">
                      <Badge 
                        variant={getStatusVariant(selectedDemanda.status)}
                        style={{ backgroundColor: getStatusColor(selectedDemanda.status), color: 'white' }}
                      >
                        {getStatusLabel(selectedDemanda.status)}
                      </Badge>
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Título</label>
                  <p className="text-sm text-muted-foreground">{selectedDemanda.titulo}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <p className="text-sm text-muted-foreground">{selectedDemanda.descricao}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Munícipe</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.municipes?.nome || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Área</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.areas?.nome || 'Sem área'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Responsável</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.responsavel?.nome || 'Sem responsável'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Prioridade</label>
                    <p className="text-sm">
                      <Badge 
                        variant="secondary"
                        style={{ backgroundColor: getPrioridadeColor(selectedDemanda.prioridade), color: 'white' }}
                      >
                        {getPrioridadeLabel(selectedDemanda.prioridade)}
                      </Badge>
                    </p>
                  </div>
                </div>
                
                {selectedDemanda.data_prazo && (
                  <div>
                    <label className="text-sm font-medium">Prazo</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedDemanda.data_prazo).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Cidade</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.cidade || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Bairro</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.bairro || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">CEP</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.cep || 'N/A'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Endereço</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedDemanda.logradouro && selectedDemanda.numero 
                      ? `${selectedDemanda.logradouro}, ${selectedDemanda.numero}${selectedDemanda.complemento ? `, ${selectedDemanda.complemento}` : ''}`
                      : 'N/A'
                    }
                  </p>
                </div>
                
                {selectedDemanda.observacoes && (
                  <div>
                    <label className="text-sm font-medium">Observações</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.observacoes}</p>
                  </div>
                )}
                
                {selectedDemanda.resolucao && (
                  <div>
                    <label className="text-sm font-medium">Resolução</label>
                    <p className="text-sm text-muted-foreground">{selectedDemanda.resolucao}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium">Criado em</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedDemanda.created_at).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(selectedDemanda.created_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Atualizado em</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedDemanda.updated_at).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(selectedDemanda.updated_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Dialog de Edição - Por enquanto apenas um placeholder */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Demanda</DialogTitle>
            </DialogHeader>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Funcionalidade de edição será implementada em breve.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                className="mt-4"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}