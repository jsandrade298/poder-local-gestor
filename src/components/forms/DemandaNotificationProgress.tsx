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

  // Não renderiza se não há notificação ativa
  if (!state.isActive) {
    return null;
  }

  const progressPercentage = (state.processedNotifications / state.totalNotifications) * 100;
  const isComplete = state.processedNotifications === state.totalNotifications;

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
    <div 
      className={cn(
        "fixed z-50 bg-background border border-border shadow-lg transition-all duration-300",
        state.isMinimized 
          ? "bottom-20 right-4 w-80 h-16 rounded-lg"
          : "bottom-20 right-4 w-96 h-[500px] rounded-lg"
      )}
      data-demanda-notification-state
      data-cancelled={state.isCancelled}
    >
      <Card className="h-full">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <CardTitle className="text-sm">
                {state.isMinimized 
                  ? `Notificações Demandas (${state.processedNotifications}/${state.totalNotifications})`
                  : 'Progresso das Notificações'
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
              {!isComplete && !state.isCancelled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelNotifications}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  title="Cancelar notificações"
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
          
          {!state.isMinimized && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso: {state.processedNotifications} de {state.totalNotifications}</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Instância: {state.instanceName}</div>
                <div>Tipo: Notificações de Demandas</div>
              </div>
            </>
          )}
        </CardHeader>

        {!state.isMinimized && (
          <CardContent className="pt-0 flex flex-col overflow-hidden" style={{ height: 'calc(100% - 120px)' }}>
            <div className="flex-1 space-y-3 overflow-hidden min-h-0">
              {/* Lista de Notificações */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="font-medium text-xs mb-2">Notificações:</div>
                <ScrollArea className="flex-1 border rounded">
                  <div className="p-2 space-y-2">
                    {state.notifications.map((notification, index) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border text-xs",
                          notification.status === 'sending' && "bg-blue-50 border-blue-200",
                          notification.status === 'sent' && "bg-green-50 border-green-200",
                          notification.status === 'error' && "bg-red-50 border-red-200"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{notification.municipe_nome}</div>
                          <div className="text-muted-foreground truncate">
                            Demanda: {notification.demanda_id.slice(0, 8)}...
                          </div>
                          <div className="text-muted-foreground truncate">
                            {notification.telefone}
                          </div>
                          {notification.error && (
                            <div className="text-red-600 text-xs truncate" title={notification.error}>
                              {notification.error}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-2">
                          {notification.countdown !== undefined && notification.countdown > 0 && (
                            <div className="text-xs text-blue-600 font-mono">
                              {notification.countdown}s
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            {getStatusIcon(notification.status)}
                            <Badge 
                              variant={getStatusBadgeVariant(notification.status)}
                              className="text-xs px-1 py-0"
                            >
                              {getStatusText(notification.status)}
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
                {state.notifications.filter(n => n.status === 'sent').length} enviadas
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {state.notifications.filter(n => n.status === 'error').length} erros
              </span>
              <span className="flex items-center gap-1 text-gray-600">
                <Clock className="h-3 w-3" />
                {state.notifications.filter(n => n.status === 'pending').length} pendentes
              </span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}