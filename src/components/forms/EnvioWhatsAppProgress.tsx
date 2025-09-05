import React, { useEffect } from 'react';
import { useWhatsAppSending } from '@/contexts/WhatsAppSendingContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Minimize2, 
  Maximize2, 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function EnvioWhatsAppProgress() {
  const { state, setMinimized, resetSending } = useWhatsAppSending();

  // Não renderiza se não há envio ativo
  if (!state.isActive) {
    return null;
  }

  const progressPercentage = (state.processedRecipients / state.totalRecipients) * 100;
  const isComplete = state.processedRecipients === state.totalRecipients;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'sending':
        return <Send className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Enviado';
      case 'error':
        return 'Erro';
      case 'sending':
        return 'Enviando';
      default:
        return 'Aguardando';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'error':
        return 'destructive';
      case 'sending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className={cn(
      "fixed z-50 bg-background border border-border shadow-lg transition-all duration-300",
      state.isMinimized 
        ? "bottom-4 right-4 w-80 h-16 rounded-lg"
        : "bottom-4 right-4 w-96 h-[500px] rounded-lg"
    )}>
      <Card className="h-full">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <CardTitle className="text-sm">
                {state.isMinimized 
                  ? `Enviando WhatsApp (${state.processedRecipients}/${state.totalRecipients})`
                  : 'Progresso do Envio WhatsApp'
                }
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMinimized(!state.isMinimized)}
                className="h-6 w-6 p-0"
              >
                {state.isMinimized ? (
                  <Maximize2 className="h-3 w-3" />
                ) : (
                  <Minimize2 className="h-3 w-3" />
                )}
              </Button>
              {isComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSending}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          {!state.isMinimized && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso: {state.processedRecipients} de {state.totalRecipients}</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Instância: {state.instanceName}</div>
                <div>Intervalo: {state.tempoMinimo}-{state.tempoMaximo}s</div>
              </div>
            </>
          )}
        </CardHeader>

        {!state.isMinimized && (
          <CardContent className="pt-0 flex flex-col overflow-hidden" style={{ height: 'calc(100% - 120px)' }}>
            <div className="flex-1 space-y-3 overflow-hidden min-h-0">
              {/* Mensagem */}
              <div className="text-xs">
                <div className="font-medium mb-1">Mensagem:</div>
                <div className="text-muted-foreground p-2 bg-muted rounded text-xs max-h-16 overflow-y-auto">
                  {state.message || 'Apenas mídia'}
                </div>
              </div>

              {/* Lista de Destinatários */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="font-medium text-xs mb-2">Destinatários:</div>
                <ScrollArea className="flex-1 border rounded">
                  <div className="p-2 space-y-2">
                    {state.recipients.map((recipient, index) => (
                      <div
                        key={recipient.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border text-xs",
                          recipient.status === 'sending' && "bg-blue-50 border-blue-200",
                          recipient.status === 'sent' && "bg-green-50 border-green-200",
                          recipient.status === 'error' && "bg-red-50 border-red-200"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{recipient.nome}</div>
                          <div className="text-muted-foreground truncate">{recipient.telefone}</div>
                          {recipient.error && (
                            <div className="text-red-600 text-xs truncate" title={recipient.error}>
                              {recipient.error}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-2">
                          {recipient.countdown !== undefined && recipient.countdown > 0 && (
                            <div className="text-xs text-blue-600 font-mono">
                              {recipient.countdown}s
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            {getStatusIcon(recipient.status)}
                            <Badge 
                              variant={getStatusBadgeVariant(recipient.status)}
                              className="text-xs px-1 py-0"
                            >
                              {getStatusText(recipient.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Status Summary - fixo no final */}
            <div className="mt-3 flex justify-between items-center text-xs bg-muted p-2 rounded flex-shrink-0">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                {state.recipients.filter(r => r.status === 'sent').length} enviadas
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {state.recipients.filter(r => r.status === 'error').length} erros
              </span>
              <span className="flex items-center gap-1 text-gray-600">
                <Clock className="h-3 w-3" />
                {state.recipients.filter(r => r.status === 'pending').length} pendentes
              </span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}