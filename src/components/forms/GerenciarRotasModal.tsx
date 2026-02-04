import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
  Search,
  Filter
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

interface GerenciarRotasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVisualizarRota?: (rota: Rota) => void;
  onConcluirRota?: (rota: Rota) => void;
}

// Configuração dos status
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', cor: '#eab308', bgClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  em_andamento: { label: 'Em Andamento', cor: '#3b82f6', bgClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  concluida: { label: 'Concluída', cor: '#22c55e', bgClass: 'bg-green-100 text-green-800 border-green-300' },
  cancelada: { label: 'Cancelada', cor: '#6b7280', bgClass: 'bg-gray-100 text-gray-800 border-gray-300' }
};

export function GerenciarRotasModal({
  open,
  onOpenChange,
  onVisualizarRota,
  onConcluirRota
}: GerenciarRotasModalProps) {
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

  // Filtros
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string[]>(['pendente', 'em_andamento']);
  const [apenasMinhas, setApenasMinhas] = useState(false);
  
  // Modais internos
  const [rotaParaExcluir, setRotaParaExcluir] = useState<Rota | null>(null);
  const [rotaParaCopiar, setRotaParaCopiar] = useState<Rota | null>(null);
  const [rotaDetalhes, setRotaDetalhes] = useState<Rota | null>(null);
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
    
    // Filtro por busca
    if (busca.trim()) {
      const termoBusca = busca.toLowerCase();
      resultado = resultado.filter(r => 
        r.titulo.toLowerCase().includes(termoBusca) ||
        r.usuario_nome?.toLowerCase().includes(termoBusca) ||
        r.observacoes?.toLowerCase().includes(termoBusca)
      );
    }
    
    // Filtro por status
    if (statusFiltro.length > 0) {
      resultado = resultado.filter(r => statusFiltro.includes(r.status));
    }
    
    // Filtro apenas minhas
    if (apenasMinhas && user) {
      resultado = resultado.filter(r => r.usuario_id === user.id);
    }
    
    return resultado;
  }, [rotas, busca, statusFiltro, apenasMinhas, user]);

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

    const waypoints = rota.rota_pontos.map(p => `${p.latitude},${p.longitude}`);

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

  const handleVisualizarRota = (rota: Rota) => {
    onVisualizarRota?.(rota);
    onOpenChange(false);
  };

  const handleConcluirRota = (rota: Rota) => {
    onConcluirRota?.(rota);
    onOpenChange(false);
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
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold truncate">{rota.titulo}</h4>
                <Badge variant="outline" className={cn("text-xs", statusConfig.bgClass)}>
                  {statusConfig.label}
                </Badge>
                {isOwner && (
                  <Badge variant="secondary" className="text-xs">Minha</Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(dataProgramada, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                </span>
                {isHoje && <Badge variant="secondary" className="text-xs">Hoje</Badge>}
                {isPast && <Badge variant="destructive" className="text-xs">Atrasada</Badge>}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {rota.usuario_nome || 'Usuário'}
                </span>
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
                  📝 {rota.observacoes}
                </p>
              )}

              {/* Info de conclusão */}
              {rota.status === 'concluida' && rota.concluida_em && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Concluída em {format(new Date(rota.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {rota.observacoes_conclusao && (
                    <p className="mt-1 italic">"{rota.observacoes_conclusao}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-1">
              {/* Ações rápidas */}
              {rota.status === 'pendente' && isOwner && (
                <Button 
                  variant="default" 
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
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleConcluirRota(rota)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluir
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirGoogleMaps(rota)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Maps
              </Button>

              {/* Menu de mais opções */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleVisualizarRota(rota)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar no Mapa
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => setRotaDetalhes(rota)}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Ver Detalhes
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
                        <DropdownMenuItem onClick={() => handleConcluirRota(rota)}>
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
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Gerenciar Rotas
            </DialogTitle>
            <DialogDescription>
              Visualize, edite e gerencie todas as rotas de visitas
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 gap-4">
            {/* Barra de Busca e Filtros */}
            <div className="flex flex-col gap-3">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, usuário ou observação..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Filtros de Status */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <div key={value} className="flex items-center space-x-1">
                      <Checkbox 
                        id={`modal-status-${value}`}
                        checked={statusFiltro.includes(value)}
                        onCheckedChange={() => toggleStatus(value)}
                      />
                      <label 
                        htmlFor={`modal-status-${value}`}
                        className="flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: config.cor }}
                        />
                        {config.label}
                        <span className="text-muted-foreground">
                          ({contagemStatus[value] || 0})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-4" />

                {/* Apenas minhas */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="modal-apenas-minhas"
                    checked={apenasMinhas}
                    onCheckedChange={(checked) => setApenasMinhas(!!checked)}
                  />
                  <label 
                    htmlFor="modal-apenas-minhas"
                    className="text-xs cursor-pointer"
                  >
                    Apenas minhas rotas
                  </label>
                </div>

                {/* Limpar filtros */}
                {(statusFiltro.length > 0 || apenasMinhas || busca) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setStatusFiltro([]);
                      setApenasMinhas(false);
                      setBusca('');
                    }}
                    className="text-xs h-7"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Lista de Rotas */}
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <span className="text-muted-foreground">Carregando rotas...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-red-500">
                  <p>Erro ao carregar rotas</p>
                  <p className="text-sm mt-1">{(error as Error).message}</p>
                </div>
              ) : rotasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma rota encontrada</p>
                  {(statusFiltro.length > 0 || apenasMinhas || busca) && (
                    <p className="text-sm mt-1">Tente ajustar os filtros</p>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {rotasFiltradas.map(renderRotaCard)}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Footer com contagem */}
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              {rotasFiltradas.length} de {rotas.length} rotas
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Rota */}
      <Dialog open={!!rotaDetalhes} onOpenChange={() => setRotaDetalhes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Rota</DialogTitle>
          </DialogHeader>
          {rotaDetalhes && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">{rotaDetalhes.titulo}</h4>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(rotaDetalhes.data_programada + 'T00:00:00'), "PPPP", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-medium">Pontos da Rota ({rotaDetalhes.rota_pontos?.length || 0})</h5>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {rotaDetalhes.rota_pontos?.map((ponto, index) => (
                      <div key={ponto.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                        {ponto.tipo === 'demanda' ? (
                          <FileText className="h-4 w-4 text-red-500" />
                        ) : (
                          <Users className="h-4 w-4 text-purple-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ponto.nome}</p>
                          {ponto.endereco && (
                            <p className="text-xs text-muted-foreground truncate">{ponto.endereco}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {rotaDetalhes.observacoes && (
                <div>
                  <h5 className="text-sm font-medium">Observações</h5>
                  <p className="text-sm text-muted-foreground">{rotaDetalhes.observacoes}</p>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={() => {
                  abrirGoogleMaps(rotaDetalhes);
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir no Google Maps
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
