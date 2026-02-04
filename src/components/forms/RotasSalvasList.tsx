import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
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
  Loader2
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

export function RotasSalvasList({
  onVisualizarRota,
  onConcluirRota,
  onAbrirGoogleMaps
}: RotasSalvasListProps) {
  const { user } = useAuth();
  const { 
    rotas, 
    rotasPendentes, 
    rotasEmAndamento, 
    rotasConcluidas,
    isLoading,
    iniciarRota,
    cancelarRota,
    excluirRota,
    copiarRota
  } = useRotas();

  const [tabAtiva, setTabAtiva] = useState('pendentes');
  const [rotaParaExcluir, setRotaParaExcluir] = useState<Rota | null>(null);
  const [rotaParaCopiar, setRotaParaCopiar] = useState<Rota | null>(null);
  const [dataCopiaNova, setDataCopiaNova] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'em_andamento': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'concluida': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelada': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
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

    return (
      <Card key={rota.id} className={cn(
        "transition-all hover:shadow-md",
        isPast && "border-red-200 bg-red-50/50",
        isHoje && rota.status === 'pendente' && "border-blue-200 bg-blue-50/50"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold truncate">{rota.titulo}</h4>
                <Badge variant="outline" className={getStatusColor(rota.status)}>
                  {getStatusLabel(rota.status)}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(dataProgramada, "dd/MM/yyyy", { locale: ptBR })}
                  {isHoje && <Badge variant="secondary" className="text-xs ml-1">Hoje</Badge>}
                  {isPast && <Badge variant="destructive" className="text-xs ml-1">Atrasada</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {rota.profiles?.nome || 'Usuário'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {pontosCount} pontos
                </span>
                {demandasCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-red-500" />
                    {demandasCount} demandas
                  </span>
                )}
                {municipesCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-purple-500" />
                    {municipesCount} munícipes
                  </span>
                )}
              </div>

              {rota.observacoes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                  {rota.observacoes}
                </p>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1">
              {/* Ações rápidas baseadas no status */}
              {rota.status === 'pendente' && isOwner && (
                <Button 
                  variant="outline" 
                  size="sm"
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
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => onConcluirRota?.(rota)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluir
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => abrirGoogleMaps(rota)}
                title="Abrir no Google Maps"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              {/* Menu de mais opções */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
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
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Concluída em {format(new Date(rota.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              {rota.observacoes_conclusao && (
                <p className="mt-1 italic">"{rota.observacoes_conclusao}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Carregando rotas...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes" className="text-xs">
              Pendentes ({rotasPendentes.length + rotasEmAndamento.length})
            </TabsTrigger>
            <TabsTrigger value="concluidas" className="text-xs">
              Concluídas ({rotasConcluidas.length})
            </TabsTrigger>
            <TabsTrigger value="todas" className="text-xs">
              Todas ({rotas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-4">
            <ScrollArea className="h-[400px]">
              {rotasPendentes.length === 0 && rotasEmAndamento.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma rota pendente</p>
                  <p className="text-xs mt-1">Crie uma rota para começar</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {/* Em andamento primeiro */}
                  {rotasEmAndamento.map(renderRotaCard)}
                  {/* Depois pendentes */}
                  {rotasPendentes.map(renderRotaCard)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="concluidas" className="mt-4">
            <ScrollArea className="h-[400px]">
              {rotasConcluidas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma rota concluída</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {rotasConcluidas.map(renderRotaCard)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="todas" className="mt-4">
            <ScrollArea className="h-[400px]">
              {rotas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma rota cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {rotas.map(renderRotaCard)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
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
