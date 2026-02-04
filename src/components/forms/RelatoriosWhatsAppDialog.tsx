import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { 
  BarChart3, CheckCircle, XCircle, Clock, Eye, Send, 
  Users, Calendar, RefreshCw, ChevronDown, ChevronUp,
  MessageSquare, BookOpen, Mail, MailCheck, MailOpen,
  Search, Download, Filter, AlertCircle, Smartphone,
  Timer, Shuffle, Heart
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RelatoriosWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightEnvioId?: string | null;
}

interface EnvioResumo {
  id: string;
  titulo: string;
  tipo: string;
  conteudo: any;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_entregues: number;
  total_lidos: number;
  total_erros: number;
  usuario_nome: string;
  instancia_nome: string;
  created_at: string;
  iniciado_em: string;
  concluido_em: string;
  reacao_automatica: string | null;
  ordem_aleatoria: boolean;
  delay_min: number;
  delay_max: number;
}

interface Destinatario {
  id: string;
  telefone: string;
  telefone_formatado: string;
  nome: string;
  status: string;
  erro_mensagem: string | null;
  mensagem_enviada: string;
  variaveis: any;
  enviado_em: string | null;
  entregue_em: string | null;
  lido_em: string | null;
  ordem: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Clock },
  enviando: { label: 'Enviando', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Send },
  pausado: { label: 'Pausado', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  concluido: { label: 'Concluído', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  erro: { label: 'Erro', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
  cancelado: { label: 'Cancelado', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: XCircle },
};

const STATUS_DEST_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'text-gray-500', icon: Clock },
  enviando: { label: 'Enviando', color: 'text-blue-500', icon: Send },
  enviado: { label: 'Enviado', color: 'text-green-500', icon: Mail },
  entregue: { label: 'Entregue', color: 'text-blue-600', icon: MailCheck },
  lido: { label: 'Lido', color: 'text-purple-600', icon: MailOpen },
  reproduzido: { label: 'Reproduzido', color: 'text-purple-600', icon: Eye },
  erro: { label: 'Erro', color: 'text-red-500', icon: XCircle },
  cancelado: { label: 'Cancelado', color: 'text-orange-500', icon: XCircle },
};

export function RelatoriosWhatsAppDialog({ open, onOpenChange, highlightEnvioId }: RelatoriosWhatsAppDialogProps) {
  const [selectedEnvio, setSelectedEnvio] = useState<string | null>(null);
  const [expandedEnvios, setExpandedEnvios] = useState<Set<string>>(new Set());
  const [searchEnvio, setSearchEnvio] = useState("");
  const [searchDest, setSearchDest] = useState("");
  const queryClient = useQueryClient();

  // Auto-expandir envio destacado
  useEffect(() => {
    if (highlightEnvioId && open) {
      setExpandedEnvios(new Set([highlightEnvioId]));
      setSelectedEnvio(highlightEnvioId);
    }
  }, [highlightEnvioId, open]);

  // Buscar lista de envios
  const { data: envios, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-envios-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_envios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as EnvioResumo[];
    },
    enabled: open,
    refetchInterval: open ? 10000 : false, // Auto-refresh a cada 10s
  });

  // Buscar destinatários do envio selecionado
  const { data: destinatarios, isLoading: loadingDest, refetch: refetchDest } = useQuery({
    queryKey: ["whatsapp-envio-destinatarios-relatorio", selectedEnvio],
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
    refetchInterval: selectedEnvio ? 5000 : false,
  });

  // Filtrar envios
  const filteredEnvios = envios?.filter(e => {
    if (!searchEnvio.trim()) return true;
    const search = searchEnvio.toLowerCase();
    return e.titulo?.toLowerCase().includes(search) ||
           e.instancia_nome?.toLowerCase().includes(search) ||
           e.status?.toLowerCase().includes(search);
  }) || [];

  // Filtrar destinatários
  const filteredDestinatarios = destinatarios?.filter(d => {
    if (!searchDest.trim()) return true;
    const search = searchDest.toLowerCase();
    return d.nome?.toLowerCase().includes(search) ||
           d.telefone?.includes(search) ||
           d.status?.toLowerCase().includes(search);
  }) || [];

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

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '-';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const calcPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const handleRefresh = () => {
    refetch();
    if (selectedEnvio) refetchDest();
  };

  // Estatísticas gerais
  const stats = envios ? {
    total: envios.length,
    enviando: envios.filter(e => e.status === 'enviando').length,
    concluidos: envios.filter(e => e.status === 'concluido').length,
    erros: envios.filter(e => e.status === 'erro').length,
    totalMensagens: envios.reduce((acc, e) => acc + e.total_destinatarios, 0),
    totalEnviadas: envios.reduce((acc, e) => acc + e.total_enviados, 0),
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-blue-500 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              Relatórios de Envio WhatsApp
            </DialogTitle>
            <DialogDescription>
              Histórico completo de envios por remessa • Atualização automática
            </DialogDescription>
          </DialogHeader>

          {/* Cards de estatísticas */}
          {stats && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Remessas</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <div className="text-2xl font-bold text-green-600">{stats.concluidos}</div>
                <div className="text-xs text-muted-foreground">Concluídas</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <div className="text-2xl font-bold text-purple-600">{stats.totalMensagens}</div>
                <div className="text-xs text-muted-foreground">Total Mensagens</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <div className="text-2xl font-bold text-emerald-600">{stats.totalEnviadas}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex items-center gap-3 bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, instância ou status..."
              value={searchEnvio}
              onChange={(e) => setSearchEnvio(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p className="text-muted-foreground">Carregando relatórios...</p>
              </div>
            </div>
          ) : filteredEnvios.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhum envio registrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os envios aparecerão aqui automaticamente
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3">
              {filteredEnvios.map(envio => {
                const statusConfig = STATUS_CONFIG[envio.status] || STATUS_CONFIG.pendente;
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedEnvios.has(envio.id);
                const isHighlighted = envio.id === highlightEnvioId;
                
                const taxaSucesso = calcPercentage(envio.total_enviados, envio.total_destinatarios);
                const taxaLeitura = calcPercentage(envio.total_lidos, envio.total_enviados);
                
                return (
                  <Collapsible key={envio.id} open={isExpanded}>
                    <div className={`border rounded-xl overflow-hidden transition-all ${
                      isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                    } ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
                      
                      {/* Header do envio */}
                      <CollapsibleTrigger asChild>
                        <button
                          onClick={() => toggleExpand(envio.id)}
                          className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            {/* Status badge */}
                            <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
                              <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                            </div>
                            
                            {/* Info principal */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                                  {statusConfig.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {envio.tipo}
                                </Badge>
                                {envio.ordem_aleatoria && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className="gap-1">
                                          <Shuffle className="h-3 w-3" />
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>Ordem aleatória</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {envio.reacao_automatica && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <span className="text-lg">{envio.reacao_automatica}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>Reação automática</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              
                              <h3 className="font-medium truncate text-base">
                                {envio.titulo || 'Envio sem título'}
                              </h3>
                              
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(envio.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {envio.total_destinatarios} destinatários
                                </span>
                                {envio.instancia_nome && (
                                  <span className="flex items-center gap-1">
                                    <Smartphone className="h-3 w-3" />
                                    {envio.instancia_nome}
                                  </span>
                                )}
                                {envio.concluido_em && (
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    {formatDuration(envio.iniciado_em, envio.concluido_em)}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Estatísticas mini */}
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-lg font-bold text-green-600">{envio.total_enviados}</div>
                                <div className="text-[10px] text-muted-foreground">Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">{envio.total_entregues}</div>
                                <div className="text-[10px] text-muted-foreground">Entregues</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-600">{envio.total_lidos}</div>
                                <div className="text-[10px] text-muted-foreground">Lidos</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-red-600">{envio.total_erros}</div>
                                <div className="text-[10px] text-muted-foreground">Erros</div>
                              </div>
                              
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                              {envio.total_enviados - envio.total_entregues - envio.total_lidos > 0 && (
                                <div 
                                  className="bg-green-500 transition-all" 
                                  style={{ width: `${calcPercentage(envio.total_enviados - envio.total_entregues, envio.total_destinatarios)}%` }}
                                />
                              )}
                              {envio.total_entregues - envio.total_lidos > 0 && (
                                <div 
                                  className="bg-blue-500 transition-all" 
                                  style={{ width: `${calcPercentage(envio.total_entregues - envio.total_lidos, envio.total_destinatarios)}%` }}
                                />
                              )}
                              {envio.total_lidos > 0 && (
                                <div 
                                  className="bg-purple-500 transition-all" 
                                  style={{ width: `${calcPercentage(envio.total_lidos, envio.total_destinatarios)}%` }}
                                />
                              )}
                              {envio.total_erros > 0 && (
                                <div 
                                  className="bg-red-500 transition-all" 
                                  style={{ width: `${calcPercentage(envio.total_erros, envio.total_destinatarios)}%` }}
                                />
                              )}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      {/* Conteúdo expandido */}
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20">
                          {/* Barra de busca dos destinatários */}
                          <div className="p-4 border-b">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Buscar destinatário por nome, telefone ou status..."
                                  value={searchDest}
                                  onChange={(e) => setSearchDest(e.target.value)}
                                  className="pl-10 h-9"
                                />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {filteredDestinatarios.length} de {destinatarios?.length || 0}
                              </div>
                            </div>
                          </div>

                          {/* Mensagem enviada */}
                          {envio.conteudo?.mensagem && (
                            <div className="p-4 border-b">
                              <Label className="text-xs text-muted-foreground mb-2 block">Mensagem enviada:</Label>
                              <div className="p-3 bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg text-sm max-h-24 overflow-y-auto">
                                {envio.conteudo.mensagem}
                              </div>
                            </div>
                          )}

                          {/* Lista de destinatários */}
                          <div className="max-h-80 overflow-y-auto">
                            {loadingDest ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Carregando destinatários...</span>
                              </div>
                            ) : filteredDestinatarios.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhum destinatário encontrado</p>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs w-10">#</TableHead>
                                    <TableHead className="text-xs">Nome</TableHead>
                                    <TableHead className="text-xs">Telefone</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Enviado</TableHead>
                                    <TableHead className="text-xs">Entregue</TableHead>
                                    <TableHead className="text-xs">Lido</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredDestinatarios.map((dest) => {
                                    const destStatus = STATUS_DEST_CONFIG[dest.status] || STATUS_DEST_CONFIG.pendente;
                                    const DestIcon = destStatus.icon;
                                    return (
                                      <TableRow key={dest.id} className="hover:bg-muted/30">
                                        <TableCell className="text-xs text-muted-foreground font-mono">
                                          {dest.ordem + 1}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                          {dest.nome || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                          {dest.telefone}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1.5">
                                            <DestIcon className={`h-4 w-4 ${destStatus.color}`} />
                                            <span className={`text-xs font-medium ${destStatus.color}`}>
                                              {destStatus.label}
                                            </span>
                                          </div>
                                          {dest.erro_mensagem && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger>
                                                  <div className="text-xs text-red-500 truncate max-w-[150px] mt-0.5">
                                                    {dest.erro_mensagem}
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-sm">
                                                  {dest.erro_mensagem}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {formatDate(dest.enviado_em)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {formatDate(dest.entregue_em)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {formatDate(dest.lido_em)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
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

// Helper Label component (caso não exista)
function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className}`}>{children}</label>;
}
