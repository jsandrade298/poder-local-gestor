import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Users, Edit, Trash, Filter, Grid3x3, List, Star, Circle, Square, Triangle, Hexagon, Heart, Pentagon, Diamond, Cross, RectangleHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Opções de cores
const colorOptions = [
  { value: "#f59e0b", label: "Dourado" },
  { value: "#8b5cf6", label: "Roxo" },
  { value: "#10b981", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#06b6d4", label: "Ciano" },
  { value: "#84cc16", label: "Lima" },
  { value: "#f97316", label: "Laranja" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#6b7280", label: "Cinza" },
];

// Opções de ícones
const iconOptions = [
  { value: "star", label: "Estrela", icon: Star },
  { value: "circle", label: "Círculo", icon: Circle },
  { value: "square", label: "Quadrado", icon: Square },
  { value: "triangle", label: "Triângulo", icon: Triangle },
  { value: "hexagon", label: "Hexágono", icon: Hexagon },
  { value: "pentagon", label: "Pentágono", icon: Pentagon },
  { value: "diamond", label: "Losango", icon: Diamond },
  { value: "rectangle", label: "Retângulo", icon: RectangleHorizontal },
  { value: "cross", label: "Cruz", icon: Cross },
  { value: "heart", label: "Coração", icon: Heart },
];

// Função para obter o componente de ícone
const getIconComponent = (iconName: string) => {
  const iconOption = iconOptions.find(i => i.value === iconName);
  return iconOption?.icon || Circle;
};

export default function Categorias() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageMunicipesDialogOpen, setIsManageMunicipesDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<any>(null);
  const [newCategoriaName, setNewCategoriaName] = useState("");
  const [newCategoriaDescription, setNewCategoriaDescription] = useState("");
  const [newCategoriaColor, setNewCategoriaColor] = useState(colorOptions[0].value);
  const [newCategoriaIcon, setNewCategoriaIcon] = useState("circle");
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>([]);
  
  // Estados para filtros de munícipes
  const [municipesSearchTerm, setMunicipesSearchTerm] = useState("");
  const [selectedBairro, setSelectedBairro] = useState("all");
  const [selectedCidade, setSelectedCidade] = useState("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar categorias com contagem de munícipes
  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias-with-counts'],
    queryFn: async () => {
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('municipe_categorias')
        .select('*')
        .order('ordem');
      
      if (categoriasError) throw categoriasError;
      
      // Para cada categoria, contar os munícipes associados
      const categoriasWithCounts = await Promise.all(
        categoriasData.map(async (categoria) => {
          const { count, error: countError } = await supabase
            .from('municipes')
            .select('*', { count: 'exact', head: true })
            .eq('categoria_id', categoria.id);
          
          if (countError) {
            return { ...categoria, total_municipes: 0 };
          }
          
          return { ...categoria, total_municipes: count || 0 };
        })
      );
      
      return categoriasWithCounts;
    }
  });

  // Buscar todos os munícipes
  const { data: allMunicipes = [] } = useQuery({
    queryKey: ['all-municipes-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome, email, bairro, cidade, categoria_id')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar listas únicas de bairros e cidades para os filtros
  const { data: filtroOptions = { bairros: [], cidades: [] } } = useQuery({
    queryKey: ['filtro-options-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('bairro, cidade');
      
      if (error) throw error;
      
      const bairros = [...new Set(data.map(item => item.bairro).filter(Boolean))].sort();
      const cidades = [...new Set(data.map(item => item.cidade).filter(Boolean))].sort();
      
      return { bairros, cidades };
    }
  });

  // Buscar munícipes da categoria selecionada
  const { data: categoriaMunicipes = [] } = useQuery({
    queryKey: ['categoria-municipes', selectedCategoria?.id],
    queryFn: async () => {
      if (!selectedCategoria?.id) return [];
      
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome, email, bairro, cidade')
        .eq('categoria_id', selectedCategoria.id)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategoria?.id
  });

  // Mutação para criar nova categoria
  const createCategoriaMutation = useMutation({
    mutationFn: async (data: { nome: string; descricao?: string; cor: string; icone: string }) => {
      // Buscar maior ordem existente
      const { data: maxOrdem } = await supabase
        .from('municipe_categorias')
        .select('ordem')
        .order('ordem', { ascending: false })
        .limit(1)
        .single();
      
      const novaOrdem = (maxOrdem?.ordem || 0) + 1;
      
      const { data: result, error } = await supabase
        .from('municipe_categorias')
        .insert({
          nome: data.nome,
          descricao: data.descricao || null,
          cor: data.cor,
          icone: data.icone,
          ordem: novaOrdem
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Categoria criada com sucesso!",
        description: "A nova categoria foi adicionada ao sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['categorias-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-categorias-todas'] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para atualizar categoria
  const updateCategoriaMutation = useMutation({
    mutationFn: async (data: { id: string; nome: string; descricao?: string; cor: string; icone: string }) => {
      const { error } = await supabase
        .from('municipe_categorias')
        .update({
          nome: data.nome,
          descricao: data.descricao || null,
          cor: data.cor,
          icone: data.icone,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Categoria atualizada!",
        description: "As alterações foram salvas com sucesso."
      });
      queryClient.invalidateQueries({ queryKey: ['categorias-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-categorias-todas'] });
      setIsEditDialogOpen(false);
      setSelectedCategoria(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar categoria",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para deletar categoria
  const deleteCategoriaMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro, remover categoria dos munícipes
      await supabase
        .from('municipes')
        .update({ categoria_id: null })
        .eq('categoria_id', id);
      
      // Depois, deletar a categoria
      const { error } = await supabase
        .from('municipe_categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Categoria excluída!",
        description: "A categoria foi removida do sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['categorias-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-categorias-todas'] });
      queryClient.invalidateQueries({ queryKey: ['all-municipes-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-municipes-todos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para adicionar munícipes à categoria
  const addMunicipesToCategoriaMutation = useMutation({
    mutationFn: async ({ categoriaId, municipeIds }: { categoriaId: string; municipeIds: string[] }) => {
      const { error } = await supabase
        .from('municipes')
        .update({ categoria_id: categoriaId })
        .in('id', municipeIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Munícipes atualizados!",
        description: "Os munícipes foram adicionados à categoria."
      });
      queryClient.invalidateQueries({ queryKey: ['categorias-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['categoria-municipes', selectedCategoria?.id] });
      queryClient.invalidateQueries({ queryKey: ['all-municipes-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-municipes-todos'] });
      setSelectedMunicipes([]);
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar munícipes",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para remover munícipe da categoria
  const removeMunicipeFromCategoriaMutation = useMutation({
    mutationFn: async (municipeId: string) => {
      const { error } = await supabase
        .from('municipes')
        .update({ categoria_id: null })
        .eq('id', municipeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Munícipe removido!",
        description: "O munícipe foi removido da categoria."
      });
      queryClient.invalidateQueries({ queryKey: ['categorias-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['categoria-municipes', selectedCategoria?.id] });
      queryClient.invalidateQueries({ queryKey: ['all-municipes-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-municipes-todos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setNewCategoriaName("");
    setNewCategoriaDescription("");
    setNewCategoriaColor(colorOptions[0].value);
    setNewCategoriaIcon("circle");
  };

  const openEditDialog = (categoria: any) => {
    setSelectedCategoria(categoria);
    setNewCategoriaName(categoria.nome);
    setNewCategoriaDescription(categoria.descricao || "");
    setNewCategoriaColor(categoria.cor);
    setNewCategoriaIcon(categoria.icone);
    setIsEditDialogOpen(true);
  };

  const openManageMunicipesDialog = (categoria: any) => {
    setSelectedCategoria(categoria);
    setSelectedMunicipes([]);
    setMunicipesSearchTerm("");
    setSelectedBairro("all");
    setSelectedCidade("all");
    setIsManageMunicipesDialogOpen(true);
  };

  // Filtrar categorias
  const filteredCategorias = categorias.filter(categoria =>
    categoria.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar munícipes disponíveis (que não estão na categoria selecionada ou em nenhuma categoria)
  const filteredMunicipes = allMunicipes.filter(municipe => {
    // Excluir munícipes que já estão na categoria selecionada
    if (municipe.categoria_id === selectedCategoria?.id) return false;
    
    // Aplicar filtros
    if (municipesSearchTerm && !municipe.nome.toLowerCase().includes(municipesSearchTerm.toLowerCase())) {
      return false;
    }
    if (selectedBairro !== "all" && municipe.bairro !== selectedBairro) {
      return false;
    }
    if (selectedCidade !== "all" && municipe.cidade !== selectedCidade) {
      return false;
    }
    
    return true;
  });

  // Renderizar ícone da categoria
  const renderCategoriaIcon = (categoria: any, size: string = "h-5 w-5") => {
    const IconComponent = getIconComponent(categoria.icone);
    return <IconComponent className={size} style={{ color: categoria.cor }} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Categorias de Munícipes</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias para classificar o perfil e nível de engajamento dos munícipes
          </p>
        </div>
        
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Filtros e visualização */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categorias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Categorias */}
      {isLoading ? (
        <div className="text-center py-8">Carregando categorias...</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategorias.map((categoria) => (
            <Card key={categoria.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${categoria.cor}20` }}
                    >
                      {renderCategoriaIcon(categoria, "h-6 w-6")}
                    </div>
                    <div>
                      <CardTitle className="text-base">{categoria.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {categoria.total_municipes} munícipe{categoria.total_municipes !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(categoria)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openManageMunicipesDialog(categoria)}>
                        <Users className="h-4 w-4 mr-2" />
                        Gerenciar Munícipes
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Os munícipes desta categoria ficarão sem categoria definida.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategoriaMutation.mutate(categoria.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              {categoria.descricao && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {categoria.descricao}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
          
          {filteredCategorias.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">Nenhuma categoria encontrada</p>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Ícone</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Munícipes</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategorias.map((categoria) => (
                    <TableRow key={categoria.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: categoria.cor }}
                          />
                          <span className="font-medium">{categoria.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {renderCategoriaIcon(categoria, "h-4 w-4")}
                          <span className="text-sm text-muted-foreground">
                            {iconOptions.find(i => i.value === categoria.icone)?.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {categoria.descricao || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {categoria.total_municipes}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(categoria)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openManageMunicipesDialog(categoria)}>
                              <Users className="h-4 w-4 mr-2" />
                              Gerenciar Munícipes
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Os munícipes desta categoria ficarão sem categoria definida.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCategoriaMutation.mutate(categoria.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {filteredCategorias.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma categoria encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criar Categoria */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={newCategoriaName}
                onChange={(e) => setNewCategoriaName(e.target.value)}
                placeholder="Ex: Liderança Comunitária"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={newCategoriaDescription}
                onChange={(e) => setNewCategoriaDescription(e.target.value)}
                placeholder="Descreva o perfil desta categoria..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select value={newCategoriaIcon} onValueChange={setNewCategoriaIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => {
                      const IconComp = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={newCategoriaColor} onValueChange={setNewCategoriaColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: option.value }}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="flex items-center gap-3 mt-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${newCategoriaColor}20` }}
                >
                  {(() => {
                    const IconComp = getIconComponent(newCategoriaIcon);
                    return <IconComp className="h-6 w-6" style={{ color: newCategoriaColor }} />;
                  })()}
                </div>
                <span className="font-medium">{newCategoriaName || "Nome da categoria"}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createCategoriaMutation.mutate({
                nome: newCategoriaName,
                descricao: newCategoriaDescription,
                cor: newCategoriaColor,
                icone: newCategoriaIcon
              })}
              disabled={!newCategoriaName || createCategoriaMutation.isPending}
            >
              {createCategoriaMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Editar Categoria */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={newCategoriaName}
                onChange={(e) => setNewCategoriaName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Descrição (opcional)</Label>
              <Textarea
                id="edit-descricao"
                value={newCategoriaDescription}
                onChange={(e) => setNewCategoriaDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select value={newCategoriaIcon} onValueChange={setNewCategoriaIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => {
                      const IconComp = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={newCategoriaColor} onValueChange={setNewCategoriaColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: option.value }}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="flex items-center gap-3 mt-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${newCategoriaColor}20` }}
                >
                  {(() => {
                    const IconComp = getIconComponent(newCategoriaIcon);
                    return <IconComp className="h-6 w-6" style={{ color: newCategoriaColor }} />;
                  })()}
                </div>
                <span className="font-medium">{newCategoriaName || "Nome da categoria"}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedCategoria(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateCategoriaMutation.mutate({
                id: selectedCategoria?.id,
                nome: newCategoriaName,
                descricao: newCategoriaDescription,
                cor: newCategoriaColor,
                icone: newCategoriaIcon
              })}
              disabled={!newCategoriaName || updateCategoriaMutation.isPending}
            >
              {updateCategoriaMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Gerenciar Munícipes */}
      <Dialog open={isManageMunicipesDialogOpen} onOpenChange={setIsManageMunicipesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCategoria && renderCategoriaIcon(selectedCategoria, "h-5 w-5")}
              Gerenciar Munícipes - {selectedCategoria?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
            {/* Munícipes já na categoria */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-semibold">Munícipes na Categoria ({categoriaMunicipes.length})</h3>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-lg p-2">
                {categoriaMunicipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum munícipe nesta categoria
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categoriaMunicipes.map((municipe: any) => (
                      <div key={municipe.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{municipe.nome}</p>
                          <p className="text-sm text-muted-foreground">{municipe.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeMunicipeFromCategoriaMutation.mutate(municipe.id)}
                          disabled={removeMunicipeFromCategoriaMutation.isPending}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Munícipes disponíveis */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <h3 className="font-semibold">Adicionar Munícipes</h3>
              </div>
              
              {/* Filtros */}
              <div className="space-y-3 border-b pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={municipesSearchTerm}
                    onChange={(e) => setMunicipesSearchTerm(e.target.value)}
                    className="pl-10 h-8"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedBairro} onValueChange={setSelectedBairro}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os bairros</SelectItem>
                      {filtroOptions.bairros.map((bairro: string) => (
                        <SelectItem key={bairro} value={bairro}>
                          {bairro}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedCidade} onValueChange={setSelectedCidade}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Cidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {filtroOptions.cidades.map((cidade: string) => (
                        <SelectItem key={cidade} value={cidade}>
                          {cidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                {filteredMunicipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum munícipe encontrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMunicipes.map((municipe: any) => (
                      <div key={municipe.id} className="flex items-center gap-3 p-2 border rounded">
                        <Checkbox
                          checked={selectedMunicipes.includes(municipe.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMunicipes([...selectedMunicipes, municipe.id]);
                            } else {
                              setSelectedMunicipes(selectedMunicipes.filter(id => id !== municipe.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{municipe.nome}</p>
                          <div className="text-xs text-muted-foreground">
                            {[municipe.bairro, municipe.cidade].filter(Boolean).join(", ")}
                            {municipe.categoria_id && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                Já tem categoria
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              
              {selectedMunicipes.length > 0 && (
                <Button
                  onClick={() => {
                    addMunicipesToCategoriaMutation.mutate({
                      categoriaId: selectedCategoria?.id,
                      municipeIds: selectedMunicipes
                    });
                  }}
                  disabled={addMunicipesToCategoriaMutation.isPending}
                  className="w-full"
                >
                  {addMunicipesToCategoriaMutation.isPending ? "Adicionando..." : `Adicionar ${selectedMunicipes.length} munícipe(s)`}
                </Button>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsManageMunicipesDialogOpen(false);
                setSelectedMunicipes([]);
                setSelectedCategoria(null);
                setMunicipesSearchTerm("");
                setSelectedBairro("all");
                setSelectedCidade("all");
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
