import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, FolderOpen, BarChart3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAreas } from "@/hooks/useAreas";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Areas() {
  const { areas, loading, createArea } = useAreas();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");

  const filteredAreas = areas.filter(area =>
    area.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (area.descricao && area.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;

    const { error } = await createArea({
      nome: newAreaName,
      descricao: newAreaDescription,
      cor: '#3b82f6'
    });

    if (error) {
      toast({
        title: "Erro ao criar área",
        description: error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Área criada com sucesso",
        description: "A nova área foi adicionada ao sistema."
      });
      setIsCreateDialogOpen(false);
      setNewAreaName("");
      setNewAreaDescription("");
    }
  };

  const totalDemandas = areas.reduce((acc, area) => acc + (area.total_demandas || 0), 0);
  const totalAtivas = areas.reduce((acc, area) => acc + (area.demandas_ativas || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
          ))}
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
              <Button onClick={handleCreateArea} disabled={!newAreaName.trim()}>
                Criar Área
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
                    <div className="text-xl font-bold text-foreground">{area.total_demandas || 0}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-warning">{area.demandas_ativas || 0}</div>
                    <p className="text-xs text-muted-foreground">Ativas</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="text-muted-foreground">
                      {(area.total_demandas || 0) > 0 ? Math.round(((area.total_demandas! - (area.demandas_ativas || 0)) / area.total_demandas!) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ 
                        width: `${(area.total_demandas || 0) > 0 ? (((area.total_demandas! - (area.demandas_ativas || 0)) / area.total_demandas!) * 100) : 0}%` 
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
                  const concluidas = (area.total_demandas || 0) - (area.demandas_ativas || 0);
                  const taxaConclusao = (area.total_demandas || 0) > 0 ? Math.round((concluidas / area.total_demandas!) * 100) : 0;
                  
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
                          {area.total_demandas || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="warning">
                          {area.demandas_ativas || 0}
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