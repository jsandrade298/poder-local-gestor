import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";

export default function Demandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'aberta': return 'default';
      case 'em_andamento': return 'secondary';
      case 'concluida': return 'default';
      case 'nao_atendida': return 'destructive';
      case 'arquivada': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'nao_atendida': return 'Não Atendida';
      case 'arquivada': return 'Arquivada';
      default: return status;
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

    return matchesSearch && matchesStatus && matchesArea;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setAreaFilter("all");
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
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
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="nao_atendida">Não Atendida</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
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
                        <Badge variant={getStatusVariant(demanda.status)}>
                          {getStatusLabel(demanda.status)}
                        </Badge>
                        <Badge variant="secondary">
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}