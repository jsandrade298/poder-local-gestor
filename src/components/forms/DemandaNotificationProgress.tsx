import React from 'react';
import { useDemandaNotification } from '@/contexts/DemandaNotificationContext';
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
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DemandaNotificationProgress() {
  const { state, setMinimized, resetNotifications, cancelNotifications } = useDemandaNotification();

  // Não renderiza se não há notificações ativas
  if (!state.isActive) {
    return null;
  }

  const progressPercentage = (state.processedNotifications / state.totalNotifications) * 100;
  const isComplete = state.processedNotifications === state.totalNotifications;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'sending':
        return <Send className="h-3.5 w-3.5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-500" />;
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
    <div 
      className={cn(
        "fixed z-40 bg-background border border-border shadow-lg transition-all duration-300 rounded-lg",
        state.isMinimized 
          ? "bottom-20 right-4 w-72"
          : "bottom-20 right-4 w-80 sm:w-96"
      )}
      data-demanda-notification-state
      data-cancelled={state.isCancelled}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="px-4 py-3 pb-2 space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="h-4 w-4 flex-shrink-0 text-primary" />
              <CardTitle className="text-xs font-semibold truncate">
                {state.isMinimized 
                  ? `Notificações (${state.processedNotifications}/${state.totalNotifications})`
                  : 'Notificações de Demandas'
                }
              </CardTitle>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
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
              {!isComplete && !state.isCancelled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelNotifications}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  title="Cancelar envio"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              {(isComplete || state.isCancelled) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetNotifications}
                  className="h-6 w-6 p-0"
                  title="Fechar"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Barra de progresso - sempre visível quando não minimizado */}
          {!state.isMinimized && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{state.processedNotifications} de {state.totalNotifications}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-1.5" />
            </div>
          )}

          {/* Barra de progresso compacta quando minimizado */}
          {state.isMinimized && (
            <Progress value={progressPercentage} className="h-1 mt-2" />
          )}
        </CardHeader>

        {!state.isMinimized && (
          <CardContent className="px-4 pt-0 pb-3">
            {/* Lista de Notificações */}
            <ScrollArea className={cn(
              "border rounded-md mt-2",
              state.notifications.length <= 2 ? "" : "max-h-[200px]"
            )}>
              <div className="p-1.5 space-y-1.5">
                {state.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border text-xs",
                      notification.status === 'sending' && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
                      notification.status === 'sent' && "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
                      notification.status === 'error' && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    )}
                  >
                    {/* Ícone de status */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(notification.status)}
                    </div>
                    
                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-xs">{notification.municipe_nome}</div>
                      <div className="text-muted-foreground truncate text-[10px]">
                        {notification.demanda_titulo} → {notification.novo_status}
                      </div>
                      {notification.error && (
                        <div className="text-red-600 dark:text-red-400 truncate text-[10px]" title={notification.error}>
                          {notification.error}
                        </div>
                      )}
                    </div>
                    
                    {/* Badge / Countdown */}
                    <div className="flex-shrink-0">
                      {notification.countdown !== undefined && notification.countdown > 0 ? (
                        <span className="text-[10px] text-blue-600 font-mono">{notification.countdown}s</span>
                      ) : (
                        <Badge 
                          variant={getStatusBadgeVariant(notification.status)}
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {getStatusText(notification.status)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Resumo - só mostra quando há mais de 1 notificação */}
            {state.totalNotifications > 1 && (
              <div className="mt-2 flex justify-between items-center text-[10px] bg-muted/60 px-2 py-1.5 rounded">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  {state.notifications.filter(n => n.status === 'sent').length}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3 w-3" />
                  {state.notifications.filter(n => n.status === 'error').length}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {state.notifications.filter(n => n.status === 'pending').length}
                </span>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
