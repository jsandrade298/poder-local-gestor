import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Users, Tag as TagIcon, Edit, Trash, Settings, Filter, Grid3x3, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Color picker básico para seleção de cores
const colorOptions = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#8b5cf6", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
  "#6b7280"  // gray
];

export default function Tags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageMunicipesDialogOpen, setIsManageMunicipesDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<any>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>([]);
  
  // Estados para filtros de munícipes
  const [municipesSearchTerm, setMunicipesSearchTerm] = useState("");
  const [selectedBairro, setSelectedBairro] = useState("all");
  const [selectedCidade, setSelectedCidade] = useState("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar tags com contagem de munícipes
  const { data: tags = [], isLoading, error } = useQuery({
    queryKey: ['tags-with-counts'],
    queryFn: async () => {
      console.log('🔍 Buscando tags do banco de dados...');
      
      // Primeiro buscar todas as tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .order('nome');
      
      console.log('📋 Tags encontradas:', tagsData);
      
      if (tagsError) {
        console.error('❌ Erro ao buscar tags:', tagsError);
        throw tagsError;
      }
      
      // Para cada tag, contar os munícipes associados
      const tagsWithCounts = await Promise.all(
        tagsData.map(async (tag) => {
          const { count, error: countError } = await supabase
            .from('municipe_tags')
            .select('*', { count: 'exact', head: true })
            .eq('tag_id', tag.id);
          
          if (countError) {
            console.error('Erro ao contar munícipes para tag:', tag.nome, countError);
            return { ...tag, total_municipes: 0 };
          }
          
          console.log(`📊 Tag "${tag.nome}": ${count} munícipes`);
          return { ...tag, total_municipes: count || 0 };
        })
      );
      
      console.log('✅ Tags processadas:', tagsWithCounts);
      return tagsWithCounts;
    }
  });

  // Buscar todos os munícipes com bairro e cidade
  const { data: allMunicipes = [] } = useQuery({
    queryKey: ['all-municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome, email, bairro, cidade')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar listas únicas de bairros e cidades para os filtros
  const { data: filtroOptions = { bairros: [], cidades: [] } } = useQuery({
    queryKey: ['filtro-options'],
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

  // Buscar munícipes da tag selecionada
  const { data: tagMunicipes = [] } = useQuery({
    queryKey: ['tag-municipes', selectedTag?.id],
    queryFn: async () => {
      if (!selectedTag?.id) return [];
      
      const { data, error } = await supabase
        .from('municipe_tags')
        .select(`
          municipe_id,
          municipes!inner(id, nome, email)
        `)
        .eq('tag_id', selectedTag.id);
      
      if (error) throw error;
      return data.map(item => item.municipes);
    },
    enabled: !!selectedTag?.id
  });

  console.log('🏷️ Estado atual - tags:', tags, 'loading:', isLoading, 'error:', error);

  // Mutação para criar nova tag
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { nome: string; descricao?: string; cor: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          nome: tagData.nome,
          cor: tagData.cor,
          ...(tagData.descricao && { descricao: tagData.descricao })
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Tag criada com sucesso!",
        description: "A nova tag foi adicionada ao sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['tags-with-counts'] });
      setIsCreateDialogOpen(false);
      setNewTagName("");
      setNewTagDescription("");
      setNewTagColor(colorOptions[0]);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar tag",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para atualizar tag
  const updateTagMutation = useMutation({
    mutationFn: async (tagData: { id: string; nome: string; descricao?: string; cor: string }) => {
      console.log('🔄 Atualizando tag:', tagData);
      
      const { data, error } = await supabase
        .from('tags')
        .update({
          nome: tagData.nome,
          cor: tagData.cor,
          updated_at: new Date().toISOString()
        })
        .eq('id', tagData.id)
        .select();

      console.log('📝 Resultado da atualização:', { data, error });

      if (error) {
        console.error('❌ Erro na atualização:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Tag atualizada com sucesso:', data);
      toast({
        title: "Tag atualizada com sucesso!",
        description: "As alterações foram salvas."
      });
      queryClient.invalidateQueries({ queryKey: ['tags-with-counts'] });
      setIsEditDialogOpen(false);
      setSelectedTag(null);
    },
    onError: (error) => {
      console.error('❌ Erro ao atualizar tag:', error);
      toast({
        title: "Erro ao atualizar tag",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para excluir tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      // Primeiro, remover associações com munícipes
      await supabase
        .from('municipe_tags')
        .delete()
        .eq('tag_id', tagId);

      // Depois, excluir a tag
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Tag excluída com sucesso!",
        description: "A tag foi removida do sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['tags-with-counts'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir tag",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutações para gerenciar munícipes nas tags
  const addMunicipesToTagMutation = useMutation({
    mutationFn: async ({ tagId, municipeIds }: { tagId: string; municipeIds: string[] }) => {
      const inserts = municipeIds.map(municipeId => ({
        tag_id: tagId,
        municipe_id: municipeId
      }));

      const { error } = await supabase
        .from('municipe_tags')
        .insert(inserts);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Munícipes adicionados com sucesso!",
        description: "Os munícipes foram associados à tag."
      });
      queryClient.invalidateQueries({ queryKey: ['tags-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['tag-municipes'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar munícipes",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const removeMunicipeFromTagMutation = useMutation({
    mutationFn: async ({ tagId, municipeId }: { tagId: string; municipeId: string }) => {
      const { error } = await supabase
        .from('municipe_tags')
        .delete()
        .eq('tag_id', tagId)
        .eq('municipe_id', municipeId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Munícipe removido com sucesso!",
        description: "O munícipe foi removido da tag."
      });
      queryClient.invalidateQueries({ queryKey: ['tags-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['tag-municipes'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredTags = tags.filter(tag =>
    tag.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tag.descricao && tag.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtrar munícipes disponíveis com base nos critérios de busca
  const filteredMunicipes = allMunicipes.filter((municipe: any) => {
    // Excluir munícipes já associados à tag
    if (tagMunicipes.some((tm: any) => tm.id === municipe.id)) return false;
    
    // Filtro por nome
    const matchesName = municipesSearchTerm === "" || 
      municipe.nome.toLowerCase().includes(municipesSearchTerm.toLowerCase()) ||
      (municipe.email && municipe.email.toLowerCase().includes(municipesSearchTerm.toLowerCase()));
    
    // Filtro por bairro
    const matchesBairro = selectedBairro === "all" || municipe.bairro === selectedBairro;
    
    // Filtro por cidade
    const matchesCidade = selectedCidade === "all" || municipe.cidade === selectedCidade;
    
    return matchesName && matchesBairro && matchesCidade;
  });

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    
    createTagMutation.mutate({
      nome: newTagName.trim(),
      descricao: newTagDescription.trim() || undefined,
      cor: newTagColor
    });
  };

  const handleEditTag = (tag: any) => {
    setSelectedTag(tag);
    setNewTagName(tag.nome);
    setNewTagDescription(tag.descricao || "");
    setNewTagColor(tag.cor);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTag = () => {
    if (!selectedTag || !newTagName.trim()) return;
    
    updateTagMutation.mutate({
      id: selectedTag.id,
      nome: newTagName.trim(),
      descricao: newTagDescription.trim() || undefined,
      cor: newTagColor
    });
  };

  const handleDeleteTag = (tagId: string) => {
    deleteTagMutation.mutate(tagId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
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
            Gestão de Tags
          </h1>
          <p className="text-muted-foreground">
            Organize os munícipes por categorias e características
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Tag</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Idoso, Comerciante..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o propósito desta tag..."
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor da Tag</Label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        newTagColor === color ? 'border-foreground' : 'border-muted'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTag} disabled={!newTagName.trim() || createTagMutation.isPending}>
                {createTagMutation.isPending ? "Criando..." : "Criar Tag"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome da Tag</Label>
              <Input
                id="edit-nome"
                placeholder="Ex: Idoso, Comerciante..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Descrição (opcional)</Label>
              <Textarea
                id="edit-descricao"
                placeholder="Descreva o propósito desta tag..."
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor da Tag</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      newTagColor === color ? 'border-foreground' : 'border-muted'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTag} disabled={!newTagName.trim() || updateTagMutation.isPending}>
              {updateTagMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filtro de Busca e Controles de Visualização */}
      <Card className="shadow-sm border-0 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tags por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Toggle de Visualização */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Visualização:</span>
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Tags - Grid or List View */}
      {viewMode === "grid" ? (
        /* Grid de Tags */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map((tag) => (
            <Card key={tag.id} className="shadow-sm border-0 bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.cor }}
                    />
                    <CardTitle className="text-base font-semibold">{tag.nome}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                       <DropdownMenuItem onClick={() => {
                         setSelectedTag(tag);
                         setIsManageMunicipesDialogOpen(true);
                       }}>
                         <Settings className="h-4 w-4 mr-2" />
                         Gerenciar Munícipes
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                         <Edit className="h-4 w-4 mr-2" />
                         Editar
                       </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash className="h-4 w-4 mr-2" />
                            <span className="text-destructive">Excluir</span>
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a tag "{tag.nome}"? 
                              Esta ação removerá a tag de todos os munícipes e não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTag(tag.id)}
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
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {tag.descricao || "Sem descrição"}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{tag.total_municipes} munícipes</span>
                    </div>
                    <Badge variant="secondary">
                      {tag.total_municipes}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredTags.length === 0 && (
            <div className="col-span-full">
              <Card className="shadow-sm border-0 bg-card">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma tag encontrada</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* Lista de Tags */
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Todas as Tags ({filteredTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Munícipes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.cor }}
                          />
                          <span className="font-medium text-foreground">{tag.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{tag.descricao || "Sem descrição"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {tag.total_municipes}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                             <DropdownMenuItem onClick={() => {
                               setSelectedTag(tag);
                               setIsManageMunicipesDialogOpen(true);
                             }}>
                               <Settings className="h-4 w-4 mr-2" />
                               Gerenciar Munícipes
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                               <Edit className="h-4 w-4 mr-2" />
                               Editar
                             </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash className="h-4 w-4 mr-2" />
                                  <span className="text-destructive">Excluir</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a tag "{tag.nome}"? 
                                    Esta ação removerá a tag de todos os munícipes e não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteTag(tag.id)}
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
            
            {filteredTags.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma tag encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Gestão de Munícipes */}
      <Dialog open={isManageMunicipesDialogOpen} onOpenChange={setIsManageMunicipesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: selectedTag?.cor }}
              />
              Gerenciar Munícipes - {selectedTag?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
            {/* Munícipes já associados à tag */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-semibold">Munícipes na Tag ({tagMunicipes.length})</h3>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-lg p-2">
                {tagMunicipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum munícipe associado a esta tag
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tagMunicipes.map((municipe: any) => (
                      <div key={municipe.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{municipe.nome}</p>
                          <p className="text-sm text-muted-foreground">{municipe.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeMunicipeFromTagMutation.mutate({
                            tagId: selectedTag?.id,
                            municipeId: municipe.id
                          })}
                          disabled={removeMunicipeFromTagMutation.isPending}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Munícipes disponíveis para adicionar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <h3 className="font-semibold">Adicionar Munícipes</h3>
              </div>
              
              {/* Filtros de Busca */}
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
                  <div>
                    <Select value={selectedBairro} onValueChange={setSelectedBairro}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os bairros</SelectItem>
                        {filtroOptions.bairros.map((bairro) => (
                          <SelectItem key={bairro} value={bairro}>
                            {bairro}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Select value={selectedCidade} onValueChange={setSelectedCidade}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Cidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as cidades</SelectItem>
                        {filtroOptions.cidades.map((cidade) => (
                          <SelectItem key={cidade} value={cidade}>
                            {cidade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                {filteredMunicipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {municipesSearchTerm || selectedBairro !== "all" || selectedCidade !== "all" ? 
                      "Nenhum munícipe encontrado com os filtros aplicados" : 
                      "Nenhum munícipe disponível"
                    }
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
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{municipe.email}</p>
                            {(municipe.bairro || municipe.cidade) && (
                              <p>{[municipe.bairro, municipe.cidade].filter(Boolean).join(", ")}</p>
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
                    addMunicipesToTagMutation.mutate({
                      tagId: selectedTag?.id,
                      municipeIds: selectedMunicipes
                    });
                    setSelectedMunicipes([]);
                  }}
                  disabled={addMunicipesToTagMutation.isPending}
                  className="w-full"
                >
                  {addMunicipesToTagMutation.isPending ? "Adicionando..." : `Adicionar ${selectedMunicipes.length} munícipe(s)`}
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
                setSelectedTag(null);
                // Limpar filtros
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