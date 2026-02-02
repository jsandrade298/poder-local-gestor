import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, CheckCircle, XCircle, Clock, Eye, Send, 
  Users, Calendar, RefreshCw, ChevronDown, ChevronUp,
  MessageSquare, BookOpen
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RelatoriosWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightEnvioId?: string | null;
}

interface EnvioResumo {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_entregues: number;
  total_lidos: number;
  total_erros: number;
  usuario_nome: string;
  instancia_nome: string;
  created_at: string;
  concluido_em: string;
  reacao_automatica: string | null;
}

interface Destinatario {
  id: string;
  telefone: string;
  nome: string;
  status: string;
  erro_mensagem: string | null;
  mensagem_enviada: string;
  enviado_em: string | null;
  entregue_em: string | null;
  lido_em: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'bg-gray-500', icon: Clock },
  enviando: { label: 'Enviando', color: 'bg-blue-500', icon: Send },
  concluido: { label: 'Concluído', color: 'bg-green-500', icon: CheckCircle },
  erro: { label: 'Erro', color: 'bg-red-500', icon: XCircle },
  cancelado: { label: 'Cancelado', color: 'bg-orange-500', icon: XCircle },
};

const STATUS_DEST_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  enviando: { label: 'Enviando', variant: 'outline' },
  enviado: { label: 'Enviado', variant: 'default' },
  entregue: { label: 'Entregue', variant: 'default' },
  lido: { label: 'Lido', variant: 'default' },
  erro: { label: 'Erro', variant: 'destructive' },
};

export function RelatoriosWhatsAppDialog({ open, onOpenChange, highlightEnvioId }: RelatoriosWhatsAppDialogProps) {
  const [selectedEnvio, setSelectedEnvio] = useState<string | null>(null);
  const [expandedEnvios, setExpandedEnvios] = useState<Set<string>>(new Set());

  const { data: envios, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-envios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_envios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as EnvioResumo[];
    },
    enabled: open,
  });

  const { data: destinatarios, isLoading: loadingDest } = useQuery({
    queryKey: ["whatsapp-envio-destinatarios", selectedEnvio],
    queryFn: async () => {
      if (!selectedEnvio) return [];
      
      const { data, error } = await supabase
        .from("whatsapp_envios_destinatarios")
        .select("*")
        .eq("envio_id", selectedEnvio)
        .order("ordem", { ascending: true });
      
      if (error) throw error;
      return data as Destinatario[];
    },
    enabled: !!selectedEnvio,
  });

  const toggleExpand = (envioId: string) => {
    const newExpanded = new Set(expandedEnvios);
    if (newExpanded.has(envioId)) {
      newExpanded.delete(envioId);
      if (selectedEnvio === envioId) setSelectedEnvio(null);
    } else {
      newExpanded.add(envioId);
      setSelectedEnvio(envioId);
    }
    setExpandedEnvios(newExpanded);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const calcPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Relatórios de Envio WhatsApp
          </DialogTitle>
          <DialogDescription>Histórico e status dos envios</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">{envios?.length || 0} envios</div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : envios?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum envio registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {envios?.map(envio => {
                const statusConfig = STATUS_CONFIG[envio.status] || STATUS_CONFIG.pendente;
                const isExpanded = expandedEnvios.has(envio.id);
                const isHighlighted = envio.id === highlightEnvioId;
                
                return (
                  <Collapsible key={envio.id} open={isExpanded}>
                    <div className={`border rounded-lg overflow-hidden ${isHighlighted ? 'ring-2 ring-blue-500' : ''}`}>
                      <CollapsibleTrigger asChild>
                        <button
                          onClick={() => toggleExpand(envio.id)}
                          className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={`${statusConfig.color} text-white text-xs`}>
                                  {statusConfig.label}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {envio.tipo}
                                </span>
                                {envio.reacao_automatica && (
                                  <span title="Reação automática">
                                    {envio.reacao_automatica}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium truncate">{envio.titulo}</div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(envio.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {envio.total_destinatarios} destinatários
                                </span>
                                <span>{envio.instancia_nome}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              {/* Mini estatísticas */}
                              <div className="flex gap-2 text-xs">
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-3 w-3" />
                                  {envio.total_enviados}
                                </span>
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Eye className="h-3 w-3" />
                                  {envio.total_lidos}
                                </span>
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircle className="h-3 w-3" />
                                  {envio.total_erros}
                                </span>
                              </div>
                              
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t p-4 bg-muted/30">
                          {/* Barra de progresso visual */}
                          <div className="mb-4">
                            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-200">
                              <div 
                                className="bg-green-500" 
                                style={{ width: `${calcPercentage(envio.total_enviados, envio.total_destinatarios)}%` }}
                              />
                              <div 
                                className="bg-blue-500" 
                                style={{ width: `${calcPercentage(envio.total_lidos, envio.total_destinatarios)}%` }}
                              />
                              <div 
                                className="bg-red-500" 
                                style={{ width: `${calcPercentage(envio.total_erros, envio.total_destinatarios)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Enviados: {envio.total_enviados} ({calcPercentage(envio.total_enviados, envio.total_destinatarios)}%)</span>
                              <span>Lidos: {envio.total_lidos}</span>
                              <span>Erros: {envio.total_erros}</span>
                            </div>
                          </div>

                          {/* Lista de destinatários */}
                          {loadingDest ? (
                            <div className="flex items-center justify-center py-4">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            </div>
                          ) : destinatarios && destinatarios.length > 0 ? (
                            <div className="border rounded overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Nome</TableHead>
                                    <TableHead className="text-xs">Telefone</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Enviado</TableHead>
                                    <TableHead className="text-xs">Lido</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {destinatarios.map((dest) => {
                                    const destStatus = STATUS_DEST_CONFIG[dest.status] || STATUS_DEST_CONFIG.pendente;
                                    return (
                                      <TableRow key={dest.id}>
                                        <TableCell className="text-xs font-medium">
                                          {dest.nome || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">{dest.telefone}</TableCell>
                                        <TableCell>
                                          <Badge variant={destStatus.variant} className="text-xs">
                                            {destStatus.label}
                                          </Badge>
                                          {dest.erro_mensagem && (
                                            <div className="text-xs text-red-600 mt-1 truncate max-w-[150px]" title={dest.erro_mensagem}>
                                              {dest.erro_mensagem}
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {formatDate(dest.enviado_em)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {formatDate(dest.lido_em)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              Nenhum destinatário registrado
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
