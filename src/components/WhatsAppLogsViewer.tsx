import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Clock, Users, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface LogAniversario {
  id: string;
  data_envio: string;
  quantidade: number;
  teste: boolean;
  aniversariantes: any[];
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export function WhatsAppLogsViewer() {
  const [logs, setLogs] = useState<LogAniversario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('logs_aniversario')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoading(false);
    }
  };

  const formatarDataHora = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Carregando Histórico...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico de Envios Automáticos
            </CardTitle>
            <CardDescription>
              Registro dos últimos envios de mensagens de aniversário
            </CardDescription>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum envio registrado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Os logs aparecerão aqui após o primeiro envio automático
            </p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">
                          {log.success ? 'Envio Realizado' : 'Erro no Envio'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {log.teste && (
                          <Badge variant="secondary">TESTE</Badge>
                        )}
                        <Badge variant={log.success ? 'default' : 'destructive'}>
                          {log.quantidade} mensagens
                        </Badge>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatarDataHora(log.data_envio)}
                    </span>
                  </div>

                  {log.error_message && (
                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800 mb-3">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Erro</span>
                      </div>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {log.error_message}
                      </p>
                    </div>
                  )}

                  {log.aniversariantes && log.aniversariantes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Aniversariantes ({log.aniversariantes.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {log.aniversariantes.map((aniv: any, index: number) => (
                          <div key={index} className="bg-muted/50 p-2 rounded text-sm">
                            <div className="font-medium">{aniv.nome}</div>
                            <div className="text-muted-foreground">{aniv.telefone}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.quantidade === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Nenhum aniversariante encontrado para este dia
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}