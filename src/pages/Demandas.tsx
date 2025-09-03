import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Filter, MoreHorizontal, Calendar, User, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDemandas } from "@/hooks/useDemandas";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";

const getStatusVariant = (status: string) => {
  switch (status) {
    case "solicitado": return "secondary";
    case "em_andamento": return "warning";
    case "concluido": return "default";
    case "nao_atendido": return "destructive";
    case "arquivado": return "outline";
    default: return "secondary";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "solicitado": return "Solicitado";
    case "em_andamento": return "Em Andamento";
    case "concluido": return "Concluído";
    case "nao_atendido": return "Não Atendido";
    case "arquivado": return "Arquivado";
    default: return status;
  }
};

export default function Demandas() {
  const { demandas, loading, fetchDemandas } = useDemandas();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const filteredDemandas = demandas.filter(demanda => {
    const matchesSearch = demanda.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (demanda.municipe?.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || demanda.status === statusFilter;
    const matchesArea = areaFilter === "all" || demanda.area?.nome === areaFilter;
    
    return matchesSearch && matchesStatus && matchesArea;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
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
            Gestão de Demandas
          </h1>
          <p className="text-muted-foreground">
            Gerencie todas as demandas do gabinete
          </p>
        </div>
        
        <NovaDemandaDialog onSuccess={fetchDemandas} />
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
                  placeholder="Título ou munícipe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="solicitado">Solicitado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="nao_atendido">Não Atendido</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Área
              </label>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as áreas</SelectItem>
                  <SelectItem value="Infraestrutura">Infraestrutura</SelectItem>
                  <SelectItem value="Trânsito">Trânsito</SelectItem>
                  <SelectItem value="Saúde">Saúde</SelectItem>
                  <SelectItem value="Educação">Educação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Ações
              </label>
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Demandas */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Demandas ({filteredDemandas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Munícipe</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDemandas.map((demanda) => (
                  <TableRow key={demanda.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{demanda.titulo}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {[demanda.end_logradouro, demanda.end_numero, demanda.end_bairro]
                              .filter(Boolean)
                              .join(', ') || 'Endereço não informado'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(demanda.status)}>
                        {getStatusLabel(demanda.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{demanda.area?.nome || 'Sem área'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-foreground">{demanda.municipe?.nome_completo || 'Sem munícipe'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{demanda.responsavel?.nome || 'Sem responsável'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {demanda.prazo_entrega 
                            ? new Date(demanda.prazo_entrega).toLocaleDateString('pt-BR')
                            : 'Sem prazo'
                          }
                        </span>
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
                          <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
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
          
          {filteredDemandas.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma demanda encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}