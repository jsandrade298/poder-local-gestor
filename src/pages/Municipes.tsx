import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Download, Upload, MoreHorizontal, Mail, Phone, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateOnly } from "@/lib/dateUtils";

export default function Municipes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [cidadeFilter, setCidadeFilter] = useState("all");

  // Buscar munícipes com suas tags
  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ['municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          *,
          municipe_tags(
            tags(
              id,
              nome,
              cor
            )
          )
        `)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar cidades únicas para o filtro
  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades-municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('cidade')
        .not('cidade', 'is', null)
        .order('cidade');
      
      if (error) throw error;
      
      // Extrair cidades únicas
      const cidadesUnicas = [...new Set(data.map(item => item.cidade))];
      return cidadesUnicas.filter(Boolean).sort();
    }
  });

  // Buscar bairros únicos para o filtro
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-municipes'], 
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('bairro')
        .not('bairro', 'is', null)
        .order('bairro');
      
      if (error) throw error;
      
      // Extrair bairros únicos
      const bairrosUnicos = [...new Set(data.map(item => item.bairro))];
      return bairrosUnicos.filter(Boolean).sort();
    }
  });

  // Buscar tags para os filtros
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredMunicipes = municipes.filter(municipe => {
    const matchesSearch = !searchTerm || 
      municipe.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      municipe.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      municipe.telefone?.includes(searchTerm);
    
    const matchesTag = tagFilter === "all" || 
      (municipe.municipe_tags && municipe.municipe_tags.some((mt: any) => mt.tags?.id === tagFilter));
    
    const matchesBairro = bairroFilter === "all" || 
      municipe.bairro?.toLowerCase() === bairroFilter.toLowerCase();

    const matchesCidade = cidadeFilter === "all" ||
      municipe.cidade?.toLowerCase() === cidadeFilter.toLowerCase();
    
    return matchesSearch && matchesTag && matchesBairro && matchesCidade;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setTagFilter("all");
    setBairroFilter("all");
    setCidadeFilter("all");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Munícipes
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              Gerencie o cadastro de munícipes e suas informações
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
            <NovoMunicipeDialog />
          </div>
        </div>

        {/* Filtros */}
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email ou telefone..."
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
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.cor }}
                          />
                          {tag.nome}
                        </div>
                      </SelectItem>
                    ))}
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
                    {bairros.map((bairro) => (
                      <SelectItem key={bairro} value={bairro.toLowerCase()}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Cidade
                </label>
                <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as cidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {cidades.map((cidade) => (
                      <SelectItem key={cidade} value={cidade.toLowerCase()}>
                        {cidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total de Munícipes</p>
                  <p className="text-2xl font-bold text-foreground">{municipes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Com Email</p>
                  <p className="text-2xl font-bold text-foreground">
                    {municipes.filter(m => m.email).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Com Telefone</p>
                  <p className="text-2xl font-bold text-foreground">
                    {municipes.filter(m => m.telefone).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Resultado da Busca</p>
                  <p className="text-2xl font-bold text-foreground">{filteredMunicipes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Munícipes */}
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lista de Munícipes</span>
              <span className="text-sm font-normal text-muted-foreground">
                {isLoading ? 'Carregando...' : `${filteredMunicipes.length} munícipes`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Munícipe</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Carregando munícipes...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMunicipes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum munícipe encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMunicipes.map((municipe) => (
                    <TableRow key={municipe.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{municipe.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {municipe.data_nascimento && `Nascimento: ${formatDateOnly(municipe.data_nascimento)}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm text-foreground">
                            <Mail className="h-3 w-3" />
                            {municipe.email || 'Não informado'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-foreground">
                            <Phone className="h-3 w-3" />
                            {municipe.telefone || 'Não informado'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p>{municipe.endereco || 'Endereço não informado'}</p>
                            {municipe.bairro && (
                              <p className="text-xs">{municipe.bairro}, {municipe.cidade}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {municipe.municipe_tags && municipe.municipe_tags.length > 0 ? (
                            municipe.municipe_tags.map((mt: any) => (
                              mt.tags && (
                                <Badge 
                                  key={mt.tags.id} 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: `${mt.tags.cor}20`,
                                    borderColor: mt.tags.cor,
                                    color: mt.tags.cor
                                  }}
                                >
                                  {mt.tags.nome}
                                </Badge>
                              )
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem tags</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}