import React, { useEffect, useRef } from 'react';
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

  // Scroll automático para acompanhar o item sendo processado (somente se não foi cancelado)
  useEffect(() => {
    if (!state.isActive || state.isMinimized || state.isCancelled) return;
    
    // Encontrar o item sendo excluído atualmente
    const currentMunicipe = state.municipes.find(m => m.status === 'deleting');
    if (!currentMunicipe) return;

    console.log('🔄 Auto-scroll para:', currentMunicipe.nome);

    const scrollToCurrentItem = () => {
      // Buscar o elemento no DOM usando o data attribute
      const itemElement = document.querySelector(`[data-municipe-id="${currentMunicipe.id}"]`) as HTMLElement;
      
      if (!itemElement) {
        console.log('❌ Item não encontrado no DOM:', currentMunicipe.id);
        return;
      }

      console.log('✅ Elemento encontrado, fazendo scroll...');
      
      // Usar scrollIntoView para scroll automático suave
      itemElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    };

    // Delay para garantir que o DOM foi atualizado com o novo status
    const timeoutId = setTimeout(scrollToCurrentItem, 300);
    return () => clearTimeout(timeoutId);
  }, [state.municipes.map(m => `${m.id}-${m.status}`).join(','), state.isActive, state.isMinimized, state.isCancelled]);

  // Quando cancelado, fazer scroll para o primeiro munícipe pendente para mostrar os não processados
  useEffect(() => {
    if (!state.isCancelled || state.isMinimized) return;
    
    setTimeout(() => {
      // Primeiro tentar encontrar um item pendente
      let targetElement = state.municipes.find(m => m.status === 'pending');
      
      // Se não houver pendentes, procurar por erros de cancelamento
      if (!targetElement) {
        targetElement = state.municipes.find(m => m.status === 'error' && m.error?.includes('cancelada'));
      }
      
      if (targetElement) {
        const element = document.querySelector(`[data-municipe-id="${targetElement.id}"]`) as HTMLElement;
        if (element) {
          console.log('📍 Fazendo scroll para item não processado:', targetElement.nome);
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
          
          // Destacar o item temporariamente
          element.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.5)';
          setTimeout(() => {
            element.style.boxShadow = '';
          }, 2000);
        }
      }
    }, 500);
  }, [state.isCancelled, state.isMinimized]);

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
        return <Clock className="h-4 w-4 text-muted-foreground" />;
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
          <CardContent className="pt-0 flex flex-col" style={{ height: 'calc(100% - 120px)' }}>
            <div className="flex-1 space-y-3 min-h-0 flex flex-col">
              {/* Lista de Munícipes */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="font-medium text-xs mb-2">Munícipes:</div>
                <ScrollArea className="flex-1 border rounded h-[300px]">
                  <div className="p-2 space-y-2">
                    {state.municipes.map((municipe, index) => (
                      <div
                        key={municipe.id}
                         className={cn(
                           "flex items-center gap-3 p-3 rounded border text-xs transition-all duration-300",
                           municipe.status === 'deleting' && "bg-red-50 border-red-200 ring-2 ring-red-300 ring-opacity-50 scale-105 animate-pulse dark:bg-red-950/40 dark:border-red-800",
                           municipe.status === 'deleted' && "bg-green-50 border-green-200 opacity-75 dark:bg-green-950/40 dark:border-green-800",
                           municipe.status === 'error' && "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800",
                           municipe.status === 'pending' && state.isCancelled && "bg-orange-50 border-orange-300 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:border-orange-800",
                           municipe.status === 'pending' && !state.isCancelled && "bg-muted/60 border-border opacity-60"
                         )}
                        data-municipe-id={municipe.id}
                        data-municipe-status={municipe.status}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{municipe.nome}</div>
                          {municipe.error && (
                            <div className="text-red-600 text-xs truncate mt-1 dark:text-red-400" title={municipe.error}>
                              {municipe.error}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusIcon(municipe.status)}
                          <Badge 
                            variant={getStatusBadgeVariant(municipe.status)}
                            className="text-xs px-2 py-1 whitespace-nowrap"
                          >
                            {getStatusText(municipe.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Status Summary - fixo no final */}
            <div className="mt-3 flex justify-between items-center text-xs bg-muted p-2 rounded flex-shrink-0">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                {state.municipes.filter(m => m.status === 'deleted').length} excluídos
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-3 w-3" />
                {state.municipes.filter(m => m.status === 'error').length} erros
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {state.municipes.filter(m => m.status === 'pending').length} não processados
              </span>
              {state.isCancelled && (
                <span className="text-orange-600 font-medium dark:text-orange-400">
                  ⚠️ Cancelado
                </span>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}