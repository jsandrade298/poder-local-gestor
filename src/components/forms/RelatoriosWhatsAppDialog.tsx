import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function RelatoriosWhatsAppDialog() {
  const [open, setOpen] = useState(false);
  const [selectedEnvio, setSelectedEnvio] = useState<string | null>(null);
  const [expandedEnvios, setExpandedEnvios] = useState<Set<string>>(new Set());

  // Buscar lista de envios
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

  // Buscar destinatários do envio selecionado
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
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calcPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          Relatórios de Envio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Relatórios de Envio WhatsApp
          </DialogTitle>
          <DialogDescription>
            Histórico e status dos envios em massa
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {envios?.length || 0} envios encontrados
          </div>
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
              <p>Nenhum envio registrado ainda</p>
              <p className="text-sm">Os envios aparecerão aqui após você enviar mensagens</p>
            </div>
          ) : (
            <div className="space-y-3">
              {envios?.map(envio => {
                const statusConfig = STATUS_CONFIG[envio.status] || STATUS_CONFIG.pendente;
                const isExpanded = expandedEnvios.has(envio.id);
                
                return (
                  <Collapsible key={envio.id} open={isExpanded}>
                    <div className="border rounded-lg overflow-hidden">
                      {/* Header do envio */}
                      <CollapsibleTrigger asChild>
                        <button 
                          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                          onClick={() => toggleExpand(envio.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${statusConfig.color}`} />
                            <div className="text-left">
                              <div className="font-medium">
                                {envio.titulo || `Envio de ${formatDate(envio.created_at)}`}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {formatDate(envio.created_at)}
                                <span className="mx-1">•</span>
                                <Badge variant="outline" className="text-xs">
                                  {envio.tipo}
                                </Badge>
                                {envio.reacao_automatica && (
                                  <span title="Reação automática">
                                    {envio.reacao_automatica}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {/* Estatísticas resumidas */}
                            <div className="flex items-center gap-3 text-sm">
                              <div className="flex items-center gap-1" title="Total">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{envio.total_destinatarios}</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-600" title="Enviados">
                                <CheckCircle className="h-4 w-4" />
                                <span>{envio.total_enviados}</span>
                              </div>
                              {envio.total_erros > 0 && (
                                <div className="flex items-center gap-1 text-red-600" title="Erros">
                                  <XCircle className="h-4 w-4" />
                                  <span>{envio.total_erros}</span>
                                </div>
                              )}
                            </div>
                            
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                            
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      {/* Detalhes expandidos */}
                      <CollapsibleContent>
                        <div className="border-t p-4 bg-muted/30">
                          {/* Barra de progresso */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progresso do envio</span>
                              <span>{calcPercentage(envio.total_enviados, envio.total_destinatarios)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${calcPercentage(envio.total_enviados, envio.total_destinatarios)}%` }}
                              />
                            </div>
                          </div>

                          {/* Grid de estatísticas */}
                          <div className="grid grid-cols-5 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 text-center border">
                              <div className="text-2xl font-bold">{envio.total_destinatarios}</div>
                              <div className="text-xs text-muted-foreground">Total</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center border">
                              <div className="text-2xl font-bold text-blue-600">{envio.total_enviados}</div>
                              <div className="text-xs text-muted-foreground">Enviados</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center border">
                              <div className="text-2xl font-bold text-green-600">{envio.total_entregues}</div>
                              <div className="text-xs text-muted-foreground">Entregues</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center border">
                              <div className="text-2xl font-bold text-purple-600">{envio.total_lidos}</div>
                              <div className="text-xs text-muted-foreground">Lidos</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center border">
                              <div className="text-2xl font-bold text-red-600">{envio.total_erros}</div>
                              <div className="text-xs text-muted-foreground">Erros</div>
                            </div>
                          </div>

                          {/* Tabela de destinatários */}
                          <div className="border rounded-lg bg-white">
                            <div className="p-3 border-b flex items-center justify-between">
                              <span className="font-medium text-sm">Destinatários</span>
                              {loadingDest && selectedEnvio === envio.id && (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              )}
                            </div>
                            <ScrollArea className="h-[200px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Enviado em</TableHead>
                                    <TableHead>Erro</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {destinatarios?.map((dest, idx) => {
                                    const destStatus = STATUS_DEST_CONFIG[dest.status] || STATUS_DEST_CONFIG.pendente;
                                    return (
                                      <TableRow key={dest.id}>
                                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell className="font-medium">{dest.nome || '-'}</TableCell>
                                        <TableCell>{dest.telefone}</TableCell>
                                        <TableCell>
                                          <Badge variant={destStatus.variant}>{destStatus.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{formatDate(dest.enviado_em)}</TableCell>
                                        <TableCell className="text-sm text-red-600 max-w-[150px] truncate" title={dest.erro_mensagem || ''}>
                                          {dest.erro_mensagem || '-'}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  {(!destinatarios || destinatarios.length === 0) && !loadingDest && (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        Nenhum destinatário encontrado
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </div>

                          {/* Info adicional */}
                          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4">
                            {envio.usuario_nome && <span>Por: {envio.usuario_nome}</span>}
                            {envio.instancia_nome && <span>Instância: {envio.instancia_nome}</span>}
                            {envio.concluido_em && <span>Concluído: {formatDate(envio.concluido_em)}</span>}
                          </div>
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
