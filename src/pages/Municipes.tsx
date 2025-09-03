import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Download, Upload, MoreHorizontal, Mail, Phone, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMunicipes } from "@/hooks/useMunicipes";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";

export default function Municipes() {
  const { municipes, loading, fetchMunicipes } = useMunicipes();
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");

  const filteredMunicipes = municipes.filter(municipe => {
    const matchesSearch = municipe.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         municipe.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = tagFilter === "all" || (municipe.tags && municipe.tags.some(tag => tag.nome === tagFilter));
    const matchesBairro = bairroFilter === "all" || (municipe.end_bairro && municipe.end_bairro.includes(bairroFilter));
    
    return matchesSearch && matchesTag && matchesBairro;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
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
            Gestão de Munícipes
          </h1>
          <p className="text-muted-foreground">
            Gerencie a base de dados de munícipes
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <NovoMunicipeDialog onSuccess={fetchMunicipes} />
        </div>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Tag
              </label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  <SelectItem value="Idoso">Idoso</SelectItem>
                  <SelectItem value="Deficiente">Deficiente</SelectItem>
                  <SelectItem value="Comerciante">Comerciante</SelectItem>
                  <SelectItem value="Jovem">Jovem</SelectItem>
                  <SelectItem value="Estudante">Estudante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Bairro
              </label>
              <Select value={bairroFilter} onValueChange={setBairroFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os bairros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bairros</SelectItem>
                  <SelectItem value="Centro">Centro</SelectItem>
                  <SelectItem value="Vila Nova">Vila Nova</SelectItem>
                  <SelectItem value="Jardim América">Jardim América</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Ações
              </label>
              <Button variant="outline" className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{municipes.length}</div>
            <p className="text-sm text-muted-foreground">Total de Munícipes</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {municipes.reduce((acc, m) => acc + (m.total_demandas || 0), 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total de Demandas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {new Set(municipes.flatMap(m => m.tags?.map(t => t.nome) || [])).size}
            </div>
            <p className="text-sm text-muted-foreground">Tags Ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Munícipes */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Munícipes ({filteredMunicipes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Demandas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMunicipes.map((municipe) => (
                  <TableRow key={municipe.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{municipe.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          Nascimento: {municipe.data_nascimento 
                            ? new Date(municipe.data_nascimento).toLocaleDateString('pt-BR')
                            : 'Não informado'
                          }
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-foreground">{municipe.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-foreground">{municipe.telefone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-foreground">
                          {[municipe.end_logradouro, municipe.end_numero, municipe.end_bairro, municipe.end_cidade]
                            .filter(Boolean)
                            .join(', ') || 'Endereço não informado'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {municipe.tags?.map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs">
                            {tag.nome}
                          </Badge>
                        )) || (
                          <span className="text-xs text-muted-foreground">Sem tags</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {municipe.total_demandas || 0}
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
                          <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Ver Demandas</DropdownMenuItem>
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
          
          {filteredMunicipes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum munícipe encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}