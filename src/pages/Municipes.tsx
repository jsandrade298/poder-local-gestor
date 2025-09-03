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

  // Buscar munícipes
  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ['municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          *,
          municipe_tags (
            tags (
              id,
              nome,
              cor
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar tags para filtros
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

  // Buscar contagem de demandas por munícipe
  const { data: demandasCount = [] } = useQuery({
    queryKey: ['demandas-count-by-municipe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('municipe_id')
        .not('municipe_id', 'is', null);
      
      if (error) throw error;
      
      // Contar demandas por munícipe
      const counts = data.reduce((acc, demanda) => {
        acc[demanda.municipe_id] = (acc[demanda.municipe_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return counts;
    }
  });

  const filteredMunicipes = municipes.filter(municipe => {
    const matchesSearch = municipe.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (municipe.email && municipe.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const municipeTags = municipe.municipe_tags?.map(mt => mt.tags).filter(Boolean) || [];
    const matchesTag = tagFilter === "all" || municipeTags.some(tag => tag?.id === tagFilter);
    
    const matchesBairro = bairroFilter === "all" || 
                         (municipe.bairro && municipe.bairro.toLowerCase().includes(bairroFilter.toLowerCase()));
    
    return matchesSearch && matchesTag && matchesBairro;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando munícipes...</p>
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
          <NovoMunicipeDialog />
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
              {Object.values(demandasCount).reduce((acc, count) => acc + count, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total de Demandas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {tags.length}
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
                  <TableRow key={municipe.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{municipe.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {municipe.data_nascimento ? `Nascimento: ${formatDateOnly(municipe.data_nascimento)}` : 'Data de nascimento não informada'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {municipe.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-foreground">{municipe.email}</span>
                          </div>
                        )}
                        {municipe.telefone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-foreground">{municipe.telefone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-foreground">
                            {[municipe.endereco, municipe.bairro, municipe.cidade].filter(Boolean).join(', ')}
                          </p>
                          {municipe.cep && (
                            <p className="text-xs text-muted-foreground">CEP: {municipe.cep}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {municipe.municipe_tags?.map((mt) => (
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
                        ))}
                        {(!municipe.municipe_tags || municipe.municipe_tags.length === 0) && (
                          <span className="text-xs text-muted-foreground">Sem tags</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {demandasCount[municipe.id] || 0}
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