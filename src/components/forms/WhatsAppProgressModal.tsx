import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Minimize2, Maximize2, X, Users, Clock, Send, CheckCircle, AlertCircle } from "lucide-react";

interface ProgressItem {
  telefone: string;
  nome: string;
  status: 'pending' | 'sending' | 'success' | 'error';
  erro?: string;
}

interface WhatsAppProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinatarios: Array<{ id: string; nome: string; telefone: string }>;
  tempoMinimo: number;
  tempoMaximo: number;
  onConfirmSend: () => void;
  isLoading: boolean;
  sendingResults?: any;
}

export function WhatsAppProgressModal({
  open,
  onOpenChange,
  destinatarios,
  tempoMinimo,
  tempoMaximo,
  onConfirmSend,
  isLoading,
  sendingResults
}: WhatsAppProgressModalProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [sendingStarted, setSendingStarted] = useState(false);

  // Inicializar lista de progresso
  useEffect(() => {
    if (destinatarios.length > 0) {
      setProgressItems(destinatarios.map(dest => ({
        telefone: dest.telefone,
        nome: dest.nome,
        status: 'pending'
      })));
    }
  }, [destinatarios]);

  // Simular progresso de envio quando começar
  useEffect(() => {
    if (isLoading && sendingStarted) {
      let interval: NodeJS.Timeout;
      
      // Simular envio progressivo com delays
      const simulateProgress = async () => {
        for (let i = 0; i < destinatarios.length; i++) {
          // Calcular delay aleatório
          const delaySeconds = Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo;
          const delayMs = delaySeconds * 1000;
          
          // Atualizar item atual como "enviando"
          setProgressItems(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'sending' } : item
          ));
          
          setCurrentIndex(i);
          setTimeRemaining(delayMs);
          
          // Countdown do tempo restante
          const countdownInterval = setInterval(() => {
            setTimeRemaining(prev => {
              if (prev <= 100) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 100;
            });
          }, 100);
          
          // Aguardar delay
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Marcar como enviado
          setProgressItems(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'success' } : item
          ));
          
          // Atualizar progresso geral
          setProgress((i + 1) / destinatarios.length * 100);
        }
      };
      
      simulateProgress();
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [isLoading, sendingStarted, destinatarios.length, tempoMinimo, tempoMaximo]);

  // Processar resultados reais quando disponíveis
  useEffect(() => {
    if (sendingResults?.resultados) {
      setProgressItems(prev => 
        prev.map(item => {
          const result = sendingResults.resultados.find((r: any) => 
            r.telefone === item.telefone
          );
          if (result) {
            return {
              ...item,
              status: result.status === 'sucesso' ? 'success' : 'error',
              erro: result.erro
            };
          }
          return item;
        })
      );
      setProgress(100);
    }
  }, [sendingResults]);

  const handleConfirm = () => {
    setSendingStarted(true);
    onConfirmSend();
  };

  const successCount = progressItems.filter(item => item.status === 'success').length;
  const errorCount = progressItems.filter(item => item.status === 'error').length;
  const pendingCount = progressItems.filter(item => item.status === 'pending').length;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[250px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Enviando WhatsApp ({successCount}/{destinatarios.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(false)}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-2 h-1" />
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Envio WhatsApp - {destinatarios.length} destinatários
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-8 w-8 p-0"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col">
          {/* Estatísticas */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{destinatarios.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-xs text-muted-foreground">Enviados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso geral</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Tempo restante para próximo envio */}
          {isLoading && timeRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm bg-muted p-3 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Próximo envio em: {Math.ceil(timeRemaining / 1000)}s</span>
              <div className="flex-1">
                <Progress 
                  value={100 - (timeRemaining / (tempoMaximo * 1000)) * 100} 
                  className="h-1" 
                />
              </div>
            </div>
          )}

          {/* Lista de Destinatários */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-4 space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Lista de Destinatários
              </h4>
              {progressItems.map((item, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    item.status === 'sending' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' :
                    item.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' :
                    item.status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
                    'bg-muted'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.nome}</div>
                    <div className="text-xs text-muted-foreground">{item.telefone}</div>
                    {item.erro && (
                      <div className="text-xs text-red-600 mt-1">{item.erro}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && <Badge variant="secondary">Aguardando</Badge>}
                    {item.status === 'sending' && <Badge variant="default">Enviando...</Badge>}
                    {item.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {item.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Configuração de Delay */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm font-medium mb-1">Configuração de Delay</div>
            <div className="text-xs text-muted-foreground">
              Intervalo entre envios: {tempoMinimo}s - {tempoMaximo}s
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4 border-t">
            {!sendingStarted ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleConfirm} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Confirmar Envio
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Enviando...' : 'Fechar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}