import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Filter,
  Edit,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// Transições de status permitidas
const STATUS_TRANSITIONS = {
  pendente: ['em_andamento', 'cancelada'],
  em_andamento: ['pendente', 'concluida', 'cancelada'],
  concluida: [], // Não pode voltar, apenas refazer
  cancelada: ['pendente'] // Pode reativar
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
    refetch,
    iniciarRota,
    cancelarRota,
    excluirRota,
    copiarRota,
    atualizarRota
  } = useRotas();

  // Buscar lista de usuários
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-rotas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Filtros - "apenas minhas" como padrão, sem filtro de status (mostra todos)
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [apenasMinhas, setApenasMinhas] = useState(true);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>('_todos');
  
  // Modais internos
  const [rotaParaExcluir, setRotaParaExcluir] = useState<Rota | null>(null);
  const [rotaParaCopiar, setRotaParaCopiar] = useState<Rota | null>(null);
  const [rotaParaEditar, setRotaParaEditar] = useState<Rota | null>(null);
  const [rotaDetalhes, setRotaDetalhes] = useState<Rota | null>(null);
  
  // Estados de cópia
  const [tituloCopia, setTituloCopia] = useState('');
  const [dataCopiaNova, setDataCopiaNova] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Estados de edição
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [dataEdicao, setDataEdicao] = useState<Date | undefined>(undefined);
  const [observacoesEdicao, setObservacoesEdicao] = useState('');
  const [calendarEdicaoOpen, setCalendarEdicaoOpen] = useState(false);

  // Reset filtro de usuário quando muda "apenas minhas"
  useEffect(() => {
    if (apenasMinhas) {
      setUsuarioSelecionado('_todos');
    }
  }, [apenasMinhas]);

  // Inicializar edição
  useEffect(() => {
    if (rotaParaEditar) {
      setTituloEdicao(rotaParaEditar.titulo);
      setDataEdicao(new Date(rotaParaEditar.data_programada + 'T00:00:00'));
      setObservacoesEdicao(rotaParaEditar.observacoes || '');
    }
  }, [rotaParaEditar]);

  // Inicializar cópia
  useEffect(() => {
    if (rotaParaCopiar) {
      setTituloCopia(`${rotaParaCopiar.titulo} (Cópia)`);
      setDataCopiaNova(undefined);
    }
  }, [rotaParaCopiar]);

  // Contagem por status
  const contagemStatus = useMemo(() => {
    const contagem: Record<string, number> = {
      pendente: 0,
      em_andamento: 0,
      concluida: 0,
      cancelada: 0
    };
    
    let rotasParaContar = rotas;
    if (apenasMinhas && user) {
      rotasParaContar = rotas.filter(r => r.usuario_id === user.id);
    } else if (usuarioSelecionado && usuarioSelecionado !== '_todos') {
      rotasParaContar = rotas.filter(r => r.usuario_id === usuarioSelecionado);
    }
    
    rotasParaContar.forEach(r => {
      if (contagem[r.status] !== undefined) {
        contagem[r.status]++;
      }
    });
    return contagem;
  }, [rotas, apenasMinhas, usuarioSelecionado, user]);

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
    
    // Filtro por status (se nenhum selecionado, mostra todos)
    if (statusFiltro.length > 0) {
      resultado = resultado.filter(r => statusFiltro.includes(r.status));
    }
    
    // Filtro por usuário
    if (apenasMinhas && user) {
      resultado = resultado.filter(r => r.usuario_id === user.id);
    } else if (usuarioSelecionado && usuarioSelecionado !== '_todos') {
      resultado = resultado.filter(r => r.usuario_id === usuarioSelecionado);
    }
    
    return resultado;
  }, [rotas, busca, statusFiltro, apenasMinhas, usuarioSelecionado, user]);

  const toggleStatus = (status: string) => {
    setStatusFiltro(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Mudar status da rota
  const handleMudarStatus = async (rota: Rota, novoStatus: string) => {
    try {
      await atualizarRota.mutateAsync({
        id: rota.id,
        status: novoStatus as any
      });
      toast.success(`Status alterado para "${STATUS_CONFIG[novoStatus as keyof typeof STATUS_CONFIG].label}"`);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleExcluirRota = async () => {
    if (rotaParaExcluir) {
      await excluirRota.mutateAsync(rotaParaExcluir.id);
      setRotaParaExcluir(null);
    }
  };

  const handleCopiarRota = async () => {
    if (rotaParaCopiar && dataCopiaNova && tituloCopia.trim()) {
      try {
        // Criar rota com título personalizado
        const { data: novaRota, error: rotaError } = await supabase
          .from('rotas')
          .insert({
            titulo: tituloCopia.trim(),
            usuario_id: user!.id,
            data_programada: format(dataCopiaNova, 'yyyy-MM-dd'),
            origem_lat: rotaParaCopiar.origem_lat,
            origem_lng: rotaParaCopiar.origem_lng,
            destino_lat: rotaParaCopiar.destino_lat,
            destino_lng: rotaParaCopiar.destino_lng,
            otimizar: rotaParaCopiar.otimizar,
            observacoes: rotaParaCopiar.observacoes
          })
          .select()
          .single();

        if (rotaError) throw rotaError;

        // Copiar pontos
        if (rotaParaCopiar.rota_pontos && rotaParaCopiar.rota_pontos.length > 0) {
          const pontosParaInserir = rotaParaCopiar.rota_pontos.map(ponto => ({
            rota_id: novaRota.id,
            ordem: ponto.ordem,
            tipo: ponto.tipo,
            referencia_id: ponto.referencia_id,
            nome: ponto.nome,
            endereco: ponto.endereco,
            latitude: ponto.latitude,
            longitude: ponto.longitude
          }));

          await supabase.from('rota_pontos').insert(pontosParaInserir);
        }

        toast.success('Rota copiada com sucesso!');
        setRotaParaCopiar(null);
        setTituloCopia('');
        setDataCopiaNova(undefined);
        refetch(); // Recarregar lista de rotas
      } catch (error: any) {
        toast.error('Erro ao copiar rota: ' + error.message);
      }
    }
  };

  const handleSalvarEdicao = async () => {
    if (rotaParaEditar && tituloEdicao.trim() && dataEdicao) {
      try {
        await atualizarRota.mutateAsync({
          id: rotaParaEditar.id,
          titulo: tituloEdicao.trim(),
          data_programada: format(dataEdicao, 'yyyy-MM-dd'),
          observacoes: observacoesEdicao || undefined
        });
        setRotaParaEditar(null);
      } catch (error) {
        // Erro já tratado no hook
      }
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
    const transicoesPossiveis = STATUS_TRANSITIONS[rota.status as keyof typeof STATUS_TRANSITIONS];

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
                  {format(dataProgramada, "dd/MM/yyyy (EEE)", { locale: ptBR })}
                </span>
                {isHoje && <Badge className="text-xs bg-blue-500">Hoje</Badge>}
                {isPast && <Badge variant="destructive" className="text-xs">Atrasada</Badge>}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {!apenasMinhas && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {rota.usuario_nome || 'Usuário'}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {pontosCount} pontos
                </span>
                {demandasCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <FileText className="h-3 w-3" />
                    {demandasCount}
                  </span>
                )}
                {municipesCount > 0 && (
                  <span className="flex items-center gap-1 text-purple-600">
                    <Users className="h-3 w-3" />
                    {municipesCount}
                  </span>
                )}
              </div>

              {rota.observacoes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic">
                  "{rota.observacoes}"
                </p>
              )}

              {/* Info de conclusão */}
              {rota.status === 'concluida' && rota.concluida_em && (
                <div className="mt-2 pt-2 border-t text-xs text-green-600">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Concluída em {format(new Date(rota.concluida_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-1">
              {/* Botões de mudança de status */}
              {isOwner && transicoesPossiveis.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      {rota.status === 'pendente' && <Play className="h-3 w-3 mr-1" />}
                      {rota.status === 'em_andamento' && <ArrowRight className="h-3 w-3 mr-1" />}
                      {rota.status === 'cancelada' && <RotateCcw className="h-3 w-3 mr-1" />}
                      Status
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {rota.status === 'pendente' && (
                      <DropdownMenuItem onClick={() => handleMudarStatus(rota, 'em_andamento')}>
                        <Play className="h-4 w-4 mr-2 text-blue-500" />
                        Iniciar Rota
                      </DropdownMenuItem>
                    )}
                    {rota.status === 'em_andamento' && (
                      <>
                        <DropdownMenuItem onClick={() => handleConcluirRota(rota)}>
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                          Concluir Rota
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMudarStatus(rota, 'pendente')}>
                          <ArrowLeft className="h-4 w-4 mr-2 text-yellow-500" />
                          Voltar para Pendente
                        </DropdownMenuItem>
                      </>
                    )}
                    {rota.status === 'cancelada' && (
                      <DropdownMenuItem onClick={() => handleMudarStatus(rota, 'pendente')}>
                        <RotateCcw className="h-4 w-4 mr-2 text-yellow-500" />
                        Reativar Rota
                      </DropdownMenuItem>
                    )}
                    {transicoesPossiveis.includes('cancelada') && rota.status !== 'cancelada' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleMudarStatus(rota, 'cancelada')}
                          className="text-orange-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Rota
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Botão Maps */}
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => abrirGoogleMaps(rota)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Maps
              </Button>

              {/* Menu de mais opções */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
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

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setRotaParaCopiar(rota)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar / Refazer
                  </DropdownMenuItem>

                  {isOwner && rota.status !== 'concluida' && (
                    <>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={() => setRotaParaEditar(rota)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Rota
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
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
            {/* Barra de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou observação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Apenas minhas rotas */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="modal-apenas-minhas"
                  checked={apenasMinhas}
                  onCheckedChange={(checked) => setApenasMinhas(!!checked)}
                />
                <label 
                  htmlFor="modal-apenas-minhas"
                  className="text-sm cursor-pointer font-medium"
                >
                  Apenas minhas rotas
                </label>
              </div>

              {/* Seletor de usuário */}
              {!apenasMinhas && (
                <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todos">Todos os usuários</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Separator orientation="vertical" className="h-6" />

              {/* Filtros de Status */}
              <div className="flex items-center gap-2 flex-wrap">
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

              {/* Limpar filtros */}
              {(statusFiltro.length < 4 || busca) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStatusFiltro(['pendente', 'em_andamento', 'concluida', 'cancelada']);
                    setBusca('');
                  }}
                  className="text-xs h-7"
                >
                  Mostrar todas
                </Button>
              )}
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
                  <p className="text-sm mt-1">Ajuste os filtros ou crie uma nova rota</p>
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
              Mostrando {rotasFiltradas.length} de {rotas.length} rotas
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
                onClick={() => abrirGoogleMaps(rotaDetalhes)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir no Google Maps
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!rotaParaEditar} onOpenChange={() => setRotaParaEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Rota
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="titulo-edicao">Título</Label>
              <Input
                id="titulo-edicao"
                value={tituloEdicao}
                onChange={(e) => setTituloEdicao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Programada</Label>
              <Popover open={calendarEdicaoOpen} onOpenChange={setCalendarEdicaoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataEdicao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataEdicao 
                      ? format(dataEdicao, "PPP", { locale: ptBR })
                      : "Selecione a data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataEdicao}
                    onSelect={(date) => {
                      setDataEdicao(date);
                      setCalendarEdicaoOpen(false);
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs-edicao">Observações</Label>
              <Textarea
                id="obs-edicao"
                value={observacoesEdicao}
                onChange={(e) => setObservacoesEdicao(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRotaParaEditar(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSalvarEdicao}
              disabled={!tituloEdicao.trim() || !dataEdicao || atualizarRota.isPending}
            >
              {atualizarRota.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
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
      <Dialog open={!!rotaParaCopiar} onOpenChange={() => {
        setRotaParaCopiar(null);
        setTituloCopia('');
        setDataCopiaNova(undefined);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Copiar / Refazer Rota
            </DialogTitle>
            <DialogDescription>
              Crie uma cópia desta rota com um novo título e data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="titulo-copia">Título da Nova Rota</Label>
              <Input
                id="titulo-copia"
                value={tituloCopia}
                onChange={(e) => setTituloCopia(e.target.value)}
                placeholder="Digite o título..."
              />
            </div>

            <div className="space-y-2">
              <Label>Nova Data</Label>
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
                      : "Selecione a data"
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

            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">Será copiado:</p>
              <ul className="text-muted-foreground text-xs space-y-1">
                <li>• {rotaParaCopiar?.rota_pontos?.length || 0} pontos de parada</li>
                <li>• Configurações de origem e destino</li>
                <li>• Observações originais</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRotaParaCopiar(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCopiarRota}
              disabled={!dataCopiaNova || !tituloCopia.trim()}
            >
              Criar Cópia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
