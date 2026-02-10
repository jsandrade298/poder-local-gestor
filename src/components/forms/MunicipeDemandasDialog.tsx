import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Calendar, User, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateOnly } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";

interface MunicipeDemandasDialogProps {
  municipe: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MunicipeDemandasDialog({ municipe, open, onOpenChange }: MunicipeDemandasDialogProps) {
  const navigate = useNavigate();
  const { statusList, getStatusLabel, getStatusColor } = useDemandaStatus();

  // Buscar demandas do munícipe
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas-municipe', municipe?.id],
    queryFn: async () => {
      if (!municipe?.id) return [];
      
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          areas(nome),
          demanda_tags(
            tags(
              id,
              nome,
              cor
            )
          )
        `)
        .eq('municipe_id', municipe.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!municipe?.id && open
  });

  // Buscar os nomes dos responsáveis separadamente
  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis-demandas', demandas],
    queryFn: async () => {
      if (!demandas || demandas.length === 0) return [];
      
      const responsaveisIds = [...new Set(demandas.map(d => d.responsavel_id).filter(Boolean))];
      if (responsaveisIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', responsaveisIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: demandas && demandas.length > 0
  });

  // Mapear responsáveis por ID para facilitar o acesso
  const responsaveisMap = new Map(responsaveis.map(r => [r.id, r.nome]));

  const getPrioridadeBadge = (prioridade: string) => {
    const prioridadeMap = {
      'baixa': { label: 'Baixa', color: '#10B981' },
      'media': { label: 'Média', color: '#F59E0B' },
      'alta': { label: 'Alta', color: '#EF4444' },
      'urgente': { label: 'Urgente', color: '#DC2626' }
    };
    return prioridadeMap[prioridade as keyof typeof prioridadeMap] || prioridadeMap.media;
  };

  // Contar demandas por status (dinâmico)
  const statusCounts: Record<string, number> = {};
  demandas.forEach((d) => {
    const s = d.status || "solicitada";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  if (!municipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demandas de {municipe.nome}
          </DialogTitle>
          <DialogDescription>
            Visualize todas as demandas registradas para este munícipe, com estatísticas detalhadas e opções de navegação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Estatísticas dinâmicas */}
          <div className="flex flex-wrap gap-3">
            {/* Total */}
            <Card className="flex-shrink-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{demandas.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status dinâmicos - só mostra os que têm contagem > 0 ou que estão na statusList */}
            {statusList.map((status) => {
              const count = statusCounts[status.slug] || 0;
              return (
                <Card key={status.id} className="flex-shrink-0">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.cor }}
                      />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {status.nome}
                        </p>
                        <p className="text-lg font-bold" style={{ color: status.cor }}>
                          {count}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lista de Demandas */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Demandas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Carregando demandas...</span>
                </div>
              ) : demandas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Este munícipe ainda não possui demandas cadastradas.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demandas.map((demanda) => {
                      const statusColor = getStatusColor(demanda.status);
                      const statusLabel = getStatusLabel(demanda.status);
                      const prioridadeBadge = getPrioridadeBadge(demanda.prioridade);
                      
                      return (
                         <TableRow 
                           key={demanda.id} 
                           className="hover:bg-muted/50 cursor-pointer"
                           onClick={() => {
                             onOpenChange(false);
                             navigate(`/demandas?protocolo=${demanda.protocolo}`);
                           }}
                         >
                          <TableCell>
                            <span className="font-mono text-sm">{demanda.protocolo}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{demanda.titulo}</p>
                              {demanda.descricao && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {demanda.descricao}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary"
                              style={{ 
                                backgroundColor: `${statusColor}20`,
                                borderColor: statusColor,
                                color: statusColor
                              }}
                            >
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              style={{ 
                                backgroundColor: `${prioridadeBadge.color}10`,
                                borderColor: prioridadeBadge.color,
                                color: prioridadeBadge.color
                              }}
                            >
                              {prioridadeBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {demanda.areas?.nome || 'Não definida'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {responsaveisMap.get(demanda.responsavel_id) || 'Não definido'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateOnly(demanda.created_at)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
