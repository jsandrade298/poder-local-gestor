import React from 'react';
import { useMunicipeDeletion } from '@/contexts/MunicipeDeletionContext';
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
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MunicipeDeletionProgress() {
  const { state, setMinimized, resetDeletion, cancelDeletion } = useMunicipeDeletion();

  // Não renderiza se não há exclusão ativa
  if (!state.isActive) {
    return null;
  }

  const progressPercentage = (state.processedMunicipes / state.totalMunicipes) * 100;
  const isComplete = state.processedMunicipes === state.totalMunicipes;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deleted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'deleting':
        return <Trash2 className="h-4 w-4 text-red-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'deleted':
        return 'Excluído';
      case 'error':
        return 'Erro';
      case 'deleting':
        return 'Excluindo';
      default:
        return 'Aguardando';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'deleted':
        return 'default';
      case 'error':
        return 'destructive';
      case 'deleting':
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
          ? "bottom-4 right-4 w-80 h-16 rounded-lg"
          : "bottom-4 right-4 w-96 h-[500px] rounded-lg"
      )}
      data-deletion-state
      data-cancelled={state.isCancelled}
    >
      <Card className="h-full">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm">
                {state.isMinimized 
                  ? `Excluindo Munícipes (${state.processedMunicipes}/${state.totalMunicipes})`
                  : 'Progresso da Exclusão'
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
                  onClick={cancelDeletion}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  title="Cancelar exclusão"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              {(isComplete || state.isCancelled) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetDeletion}
                  className="h-6 w-6 p-0"
                  title="Fechar"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          {!state.isMinimized && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso: {state.processedMunicipes} de {state.totalMunicipes}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </CardHeader>

        {!state.isMinimized && (
          <CardContent className="pt-0 flex flex-col overflow-hidden" style={{ height: 'calc(100% - 120px)' }}>
            <div className="flex-1 space-y-3 overflow-hidden min-h-0">
              {/* Lista de Munícipes */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="font-medium text-xs mb-2">Munícipes:</div>
                <ScrollArea className="flex-1 border rounded">
                  <div className="p-2 space-y-2">
                    {state.municipes.map((municipe, index) => (
                      <div
                        key={municipe.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border text-xs",
                          municipe.status === 'deleting' && "bg-red-50 border-red-200",
                          municipe.status === 'deleted' && "bg-green-50 border-green-200",
                          municipe.status === 'error' && "bg-red-50 border-red-200"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{municipe.nome}</div>
                          {municipe.error && (
                            <div className="text-red-600 text-xs truncate" title={municipe.error}>
                              {municipe.error}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-2">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(municipe.status)}
                            <Badge 
                              variant={getStatusBadgeVariant(municipe.status)}
                              className="text-xs px-1 py-0"
                            >
                              {getStatusText(municipe.status)}
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
                {state.municipes.filter(m => m.status === 'deleted').length} excluídos
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {state.municipes.filter(m => m.status === 'error').length} erros
              </span>
              <span className="flex items-center gap-1 text-gray-600">
                <Clock className="h-3 w-3" />
                {state.municipes.filter(m => m.status === 'pending').length} pendentes
              </span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}