import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Users, Tag as TagIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Dados mockados - substituir pela integração com Supabase
const tagsMock = [
  {
    id: "1",
    nome: "Idoso",
    descricao: "Munícipes com mais de 60 anos",
    total_municipes: 25,
    cor: "#3b82f6"
  },
  {
    id: "2",
    nome: "Deficiente",
    descricao: "Munícipes com necessidades especiais",
    total_municipes: 12,
    cor: "#10b981"
  },
  {
    id: "3",
    nome: "Comerciante",
    descricao: "Proprietários de estabelecimentos comerciais",
    total_municipes: 38,
    cor: "#f59e0b"
  },
  {
    id: "4",
    nome: "Jovem",
    descricao: "Munícipes de 18 a 30 anos",
    total_municipes: 45,
    cor: "#8b5cf6"
  },
  {
    id: "5",
    nome: "Estudante",
    descricao: "Estudantes de ensino médio e superior",
    total_municipes: 22,
    cor: "#ef4444"
  }
];

export default function Tags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");

  const filteredTags = tagsMock.filter(tag =>
    tag.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTag = () => {
    // Aqui implementar a criação da tag via Supabase
    console.log("Criar tag:", { nome: newTagName, descricao: newTagDescription });
    setIsCreateDialogOpen(false);
    setNewTagName("");
    setNewTagDescription("");
  };

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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Criar Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{tagsMock.length}</div>
                <p className="text-sm text-muted-foreground">Tags Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {tagsMock.reduce((acc, tag) => acc + tag.total_municipes, 0)}
                </div>
                <p className="text-sm text-muted-foreground">Munícipes Categorizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {Math.round(tagsMock.reduce((acc, tag) => acc + tag.total_municipes, 0) / tagsMock.length)}
            </div>
            <p className="text-sm text-muted-foreground">Média por Tag</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de Busca */}
      <Card className="shadow-sm border-0 bg-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tags por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grid de Tags */}
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
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem>Gerenciar Munícipes</DropdownMenuItem>
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
                  {tag.descricao}
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
                <Button variant="outline" size="sm" className="w-full">
                  Ver Munícipes
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela Alternativa (para telas maiores) */}
      <Card className="shadow-sm border-0 bg-card hidden lg:block">
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
                      <span className="text-sm text-muted-foreground">{tag.descricao}</span>
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Gerenciar Munícipes</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Excluir
                          </DropdownMenuItem>
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
    </div>
  );
}