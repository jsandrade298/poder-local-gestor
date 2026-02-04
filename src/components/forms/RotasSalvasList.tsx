import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Route, 
  Calendar as CalendarIcon, 
  User, 
  Play, 
  CheckCircle, 
  Copy, 
  Trash2, 
  Eye,
  ExternalLink,
  MoreVertical,
  MapPin,
  Clock,
  FileText,
  Users,
  XCircle,
  RefreshCw,
  Loader2,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Rota, useRotas } from '@/hooks/useRotas';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface RotasSalvasListProps {
  onVisualizarRota?: (rota: Rota) => void;
  onConcluirRota?: (rota: Rota) => void;
  onAbrirGoogleMaps?: (rota: Rota) => void;
}

// Configuração dos status
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', cor: '#eab308', bgClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  em_andamento: { label: 'Em Andamento', cor: '#3b82f6', bgClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  concluida: { label: 'Concluída', cor: '#22c55e', bgClass: 'bg-green-100 text-green-800 border-green-300' },
  cancelada: { label: 'Cancelada', cor: '#6b7280', bgClass: 'bg-gray-100 text-gray-800 border-gray-300' }
};

export function RotasSalvasList({
  onVisualizarRota,
  onConcluirRota,
  onAbrirGoogleMaps
}: RotasSalvasListProps) {
  const { user } = useAuth();
  const { 
    rotas, 
    isLoading,
    error,
    iniciarRota,
    cancelarRota,
    excluirRota,
    copiarRota
  } = useRotas();

  // Filtros por status (multi-select)
  const [statusFiltro, setStatusFiltro] = useState<string[]>(['pendente', 'em_andamento']);
  const [apenasMinhas, setApenasMinhas] = useState(false);
  
  const [rotaParaExcluir, setRotaParaExcluir] = useState<Rota | null>(null);
  const [rotaParaCopiar, setRotaParaCopiar] = useState<Rota | null>(null);
  const [dataCopiaNova, setDataCopiaNova] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Contagem por status
  const contagemStatus = useMemo(() => {
    const contagem: Record<string, number> = {
      pendente: 0,
      em_andamento: 0,
      concluida: 0,
      cancelada: 0
    };
    rotas.forEach(r => {
      if (contagem[r.status] !== undefined) {
        contagem[r.status]++;
      }
    });
    return contagem;
  }, [rotas]);

  // Rotas filtradas
  const rotasFiltradas = useMemo(() => {
    let resultado = rotas;
    
    // Filtro por status
    if (statusFiltro.length > 0) {
      resultado = resultado.filter(r => statusFiltro.includes(r.status));
    }
    
    // Filtro apenas minhas
    if (apenasMinhas && user) {
      resultado = resultado.filter(r => r.usuario_id === user.id);
    }
    
    return resultado;
  }, [rotas, statusFiltro, apenasMinhas, user]);

  const toggleStatus = (status: string) => {
    setStatusFiltro(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleIniciarRota = async (rota: Rota) => {
    await iniciarRota.mutateAsync(rota.id);
  };

  const handleCancelarRota = async (rota: Rota) => {
    await cancelarRota.mutateAsync(rota.id);
  };

  const handleExcluirRota = async () => {
    if (rotaParaExcluir) {
      await excluirRota.mutateAsync(rotaParaExcluir.id);
      setRotaParaExcluir(null);
    }
  };

  const handleCopiarRota = async () => {
    if (rotaParaCopiar && dataCopiaNova) {
      await copiarRota.mutateAsync({
        rotaOriginal: rotaParaCopiar,
        novaData: format(dataCopiaNova, 'yyyy-MM-dd')
      });
      setRotaParaCopiar(null);
      setDataCopiaNova(undefined);
    }
  };

  const abrirGoogleMaps = (rota: Rota) => {
    if (!rota.rota_pontos || rota.rota_pontos.length === 0) return;

    const waypoints = rota.rota_pontos
      .map(p => `${p.latitude},${p.longitude}`);

    let url = 'https://www.google.com/maps/dir/';
    
    if (rota.origem_lat && rota.origem_lng) {
      url += `${rota.origem_lat},${rota.origem_lng}/`;
    }
    
    url += waypoints.join('/');
    
    if (rota.destino_lat && rota.destino_lng) {
      url += `/${rota.destino_lat},${rota.destino_lng}`;
    }
    
    window.open(url, '_blank');
  };

  const renderRotaCard = (rota: Rota) => {
    const isOwner = rota.usuario_id === user?.id;
    const pontosCount = rota.rota_pontos?.length || 0;
    const demandasCount = rota.rota_pontos?.filter(p => p.tipo === 'demanda').length || 0;
    const municipesCount = rota.rota_pontos?.filter(p => p.tipo === 'municipe').length || 0;
    const dataProgramada = new Date(rota.data_programada + 'T00:00:00');
    const isHoje = format(dataProgramada, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    const isPast = dataProgramada < new Date(new Date().setHours(0, 0, 0, 0)) && rota.status === 'pendente';
    const statusConfig = STATUS_CONFIG[rota.status as keyof typeof STATUS_CONFIG];

    return (
      <Card key={rota.id} className={cn(
        "transition-all hover:shadow-md",
        isPast && "border-red-200 bg-red-50/50",
        isHoje && rota.status === 'pendente' && "border-blue-200 bg-blue-50/50"
      )}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-sm truncate">{rota.titulo}</h4>
                <Badge variant="outline" className={cn("text-xs", statusConfig.bgClass)}>
                  {statusConfig.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(dataProgramada, "dd/MM/yyyy", { locale: ptBR })}
                </span>
                {isHoje && <Badge variant="secondary" className="text-xs py-0">Hoje</Badge>}
                {isPast && <Badge variant="destructive" className="text-xs py-0">Atrasada</Badge>}
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {rota.usuario_nome || 'Usuário'}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {pontosCount} pontos
                </span>
                {demandasCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-red-500" />
                    {demandasCount}
                  </span>
                )}
                {municipesCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-purple-500" />
                    {municipesCount}
                  </span>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1">
              {/* Ações rápidas baseadas no status */}
              {rota.status === 'pendente' && isOwner && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleIniciarRota(rota)}
                  disabled={iniciarRota.isPending}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Iniciar
                </Button>
              )}

              {rota.status === 'em_andamento' && isOwner && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => onConcluirRota?.(rota)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluir
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => abrirGoogleMaps(rota)}
                title="Abrir no Google Maps"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>

              {/* Menu de mais opções */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onVisualizarRota?.(rota)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar no Mapa
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => abrirGoogleMaps(rota)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir no Google Maps
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setRotaParaCopiar(rota)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar / Refazer Rota
                  </DropdownMenuItem>

                  {isOwner && rota.status !== 'concluida' && rota.status !== 'cancelada' && (
                    <>
                      <DropdownMenuSeparator />
                      
                      {rota.status === 'pendente' && (
                        <DropdownMenuItem onClick={() => handleIniciarRota(rota)}>
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Rota
                        </DropdownMenuItem>
                      )}

                      {rota.status === 'em_andamento' && (
                        <DropdownMenuItem onClick={() => onConcluirRota?.(rota)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Concluir Rota
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem 
                        onClick={() => handleCancelarRota(rota)}
                        className="text-orange-600"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar Rota
                      </DropdownMenuItem>

                      <DropdownMenuItem 
                        onClick={() => setRotaParaExcluir(rota)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Rota
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Info de conclusão */}
          {rota.status === 'concluida' && rota.concluida_em && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Concluída em {format(new Date(rota.concluida_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
              {rota.observacoes_conclusao && (
                <p className="mt-1 italic line-clamp-1">"{rota.observacoes_conclusao}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <span className="text-sm text-muted-foreground">Carregando rotas...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p className="text-sm">Erro ao carregar rotas</p>
        <p className="text-xs mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Filtros por Status */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">FILTRAR POR STATUS</label>
          <div className="space-y-1">
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox 
                  id={`status-rota-${value}`}
                  checked={statusFiltro.includes(value)}
                  onCheckedChange={() => toggleStatus(value)}
                />
                <label 
                  htmlFor={`status-rota-${value}`}
                  className="flex items-center gap-2 text-xs cursor-pointer flex-1"
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: config.cor }}
                  />
                  {config.label}
                  <span className="text-muted-foreground ml-auto">
                    ({contagemStatus[value] || 0})
                  </span>
                </label>
              </div>
            ))}
          </div>
          
          {/* Filtro apenas minhas rotas */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox 
              id="apenas-minhas"
              checked={apenasMinhas}
              onCheckedChange={(checked) => setApenasMinhas(!!checked)}
            />
            <label 
              htmlFor="apenas-minhas"
              className="text-xs cursor-pointer"
            >
              Apenas minhas rotas
            </label>
          </div>
        </div>

        {/* Lista de Rotas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              ROTAS ({rotasFiltradas.length})
            </label>
            {statusFiltro.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStatusFiltro([])}
                className="h-5 text-xs px-2"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <ScrollArea className="h-[280px]">
            {rotasFiltradas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Route className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Nenhuma rota encontrada</p>
                {statusFiltro.length > 0 && (
                  <p className="text-xs mt-1">Tente ajustar os filtros</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {rotasFiltradas.map(renderRotaCard)}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!rotaParaExcluir} onOpenChange={() => setRotaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rota?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a rota "{rotaParaExcluir?.titulo}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluirRota}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de copiar rota */}
      <AlertDialog open={!!rotaParaCopiar} onOpenChange={() => {
        setRotaParaCopiar(null);
        setDataCopiaNova(undefined);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Copiar / Refazer Rota
            </AlertDialogTitle>
            <AlertDialogDescription>
              Selecione a nova data para realizar esta rota. Uma cópia será criada para você.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataCopiaNova && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataCopiaNova 
                    ? format(dataCopiaNova, "PPP", { locale: ptBR })
                    : "Selecione a nova data"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataCopiaNova}
                  onSelect={(date) => {
                    setDataCopiaNova(date);
                    setCalendarOpen(false);
                  }}
                  locale={ptBR}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCopiarRota}
              disabled={!dataCopiaNova || copiarRota.isPending}
            >
              {copiarRota.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copiando...
                </>
              ) : (
                'Criar Cópia'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
