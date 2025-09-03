import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, FolderOpen, BarChart3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Areas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");
  const queryClient = useQueryClient();

  // Fetch areas from Supabase
  const { data: areas = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch demandas count for each area
  const { data: demandasCount = [], isLoading: isLoadingDemandas } = useQuery({
    queryKey: ['demandas-count-by-area'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('area_id, status');
      
      if (error) throw error;
      
      // Count demandas by area
      const countByArea = data.reduce((acc, demanda) => {
        if (!demanda.area_id) return acc;
        
        if (!acc[demanda.area_id]) {
          acc[demanda.area_id] = { total: 0, ativas: 0 };
        }
        
        acc[demanda.area_id].total += 1;
        if (['aberta', 'em_andamento', 'aguardando'].includes(demanda.status)) {
          acc[demanda.area_id].ativas += 1;
        }
        
        return acc;
      }, {});
      
      return countByArea;
    }
  });

  // Create area mutation
  const createAreaMutation = useMutation({
    mutationFn: async (newArea: { nome: string; descricao: string }) => {
      const { data, error } = await supabase
        .from('areas')
        .insert([newArea])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast({
        title: "Área criada",
        description: "A área foi criada com sucesso.",
      });
      setIsCreateDialogOpen(false);
      setNewAreaName("");
      setNewAreaDescription("");
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar área: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Combine areas with demandas count
  const areasWithCount = useMemo(() => {
    return areas.map(area => ({
      ...area,
      total_demandas: demandasCount[area.id]?.total || 0,
      demandas_ativas: demandasCount[area.id]?.ativas || 0,
    }));
  }, [areas, demandasCount]);

  const filteredAreas = areasWithCount.filter(area =>
    area.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (area.descricao && area.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateArea = () => {
    if (!newAreaName.trim()) return;
    
    createAreaMutation.mutate({
      nome: newAreaName.trim(),
      descricao: newAreaDescription.trim() || null,
    });
  };

  const totalDemandas = areasWithCount.reduce((acc, area) => acc + area.total_demandas, 0);
  const totalAtivas = areasWithCount.reduce((acc, area) => acc + area.demandas_ativas, 0);

  if (isLoadingAreas || isLoadingDemandas) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Carregando áreas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Áreas de Atuação
          </h1>
          <p className="text-muted-foreground">
            Gerencie as áreas de atuação do gabinete
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Área de Atuação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Área</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Infraestrutura, Saúde..."
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o escopo desta área de atuação..."
                  value={newAreaDescription}
                  onChange={(e) => setNewAreaDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateArea} 
                disabled={!newAreaName.trim() || createAreaMutation.isPending}
              >
                {createAreaMutation.isPending ? "Criando..." : "Criar Área"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{areas.length}</div>
                <p className="text-sm text-muted-foreground">Áreas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{totalDemandas}</div>
                <p className="text-sm text-muted-foreground">Total de Demandas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{totalAtivas}</div>
            <p className="text-sm text-muted-foreground">Demandas Ativas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {totalDemandas > 0 ? Math.round((totalAtivas / totalDemandas) * 100) : 0}%
            </div>
            <p className="text-sm text-muted-foreground">Taxa de Atividade</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de Busca */}
      <Card className="shadow-sm border-0 bg-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar áreas por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grid de Áreas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAreas.map((area) => (
          <Card key={area.id} className="shadow-sm border-0 bg-card hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: area.cor }}
                  />
                  <CardTitle className="text-base font-semibold">{area.nome}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem>Ver Demandas</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {area.descricao}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{area.total_demandas}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-warning">{area.demandas_ativas}</div>
                    <p className="text-xs text-muted-foreground">Ativas</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="text-muted-foreground">
                      {area.total_demandas > 0 ? Math.round(((area.total_demandas - area.demandas_ativas) / area.total_demandas) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ 
                        width: `${area.total_demandas > 0 ? ((area.total_demandas - area.demandas_ativas) / area.total_demandas) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Ver Demandas
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela Detalhada */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Todas as Áreas ({filteredAreas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Ativas</TableHead>
                  <TableHead className="text-center">Concluídas</TableHead>
                  <TableHead className="text-center">Taxa de Conclusão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAreas.map((area) => {
                  const concluidas = area.total_demandas - area.demandas_ativas;
                  const taxaConclusao = area.total_demandas > 0 ? Math.round((concluidas / area.total_demandas) * 100) : 0;
                  
                  return (
                    <TableRow key={area.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: area.cor }}
                          />
                          <span className="font-medium text-foreground">{area.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{area.descricao}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {area.total_demandas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="warning">
                          {area.demandas_ativas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default">
                          {concluidas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-foreground">{taxaConclusao}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Ver Demandas</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredAreas.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma área encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}