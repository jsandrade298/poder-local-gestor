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
import { Switch } from '@/components/ui/switch';
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
  ChevronDown,
  Clock,
  ChevronUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parse, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Rota, RotaPonto, useRotas } from '@/hooks/useRotas';
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

// Interface para ponto com horário editável
interface PontoEditavel {
  id?: string;
  ordem: number;
  tipo: 'demanda' | 'municipe';
  referencia_id: string;
  nome: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  horario_agendado?: string;
  duracao_estimada?: number;
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
  const [pontosCopiados, setPontosCopiados] = useState<PontoEditavel[]>([]);
  const [agendarHorariosCopia, setAgendarHorariosCopia] = useState(false);
  const [horarioInicialCopia, setHorarioInicialCopia] = useState('09:00');
  const [tempoDeslocamentoCopia, setTempoDeslocamentoCopia] = useState(15);
  const [horariosExpandidosCopia, setHorariosExpandidosCopia] = useState(false);
  
  // Estados de edição
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [dataEdicao, setDataEdicao] = useState<Date | undefined>(undefined);
  const [observacoesEdicao, setObservacoesEdicao] = useState('');
  const [calendarEdicaoOpen, setCalendarEdicaoOpen] = useState(false);
  const [pontosEdicao, setPontosEdicao] = useState<PontoEditavel[]>([]);
  const [horariosExpandidosEdicao, setHorariosExpandidosEdicao] = useState(false);

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
      // Inicializar pontos para edição
      setPontosEdicao(rotaParaEditar.rota_pontos?.map(p => ({
        id: p.id,
        ordem: p.ordem,
        tipo: p.tipo,
        referencia_id: p.referencia_id,
        nome: p.nome,
        endereco: p.endereco,
        latitude: p.latitude,
        longitude: p.longitude,
        horario_agendado: p.horario_agendado || '',
        duracao_estimada: p.duracao_estimada || 30
      })) || []);
    }
  }, [rotaParaEditar]);

  // Inicializar cópia
  useEffect(() => {
    if (rotaParaCopiar) {
      setTituloCopia(`${rotaParaCopiar.titulo} (Cópia)`);
      setDataCopiaNova(undefined);
      // Verificar se a rota original tem horários
      const temHorarios = rotaParaCopiar.rota_pontos?.some(p => p.horario_agendado);
      setAgendarHorariosCopia(!!temHorarios);
      // Inicializar pontos para cópia
      setPontosCopiados(rotaParaCopiar.rota_pontos?.map(p => ({
        ordem: p.ordem,
        tipo: p.tipo,
        referencia_id: p.referencia_id,
        nome: p.nome,
        endereco: p.endereco,
        latitude: p.latitude,
        longitude: p.longitude,
        horario_agendado: p.horario_agendado || '',
        duracao_estimada: p.duracao_estimada || 30
      })) || []);
    }
  }, [rotaParaCopiar]);

  // Recalcular horários para cópia
  const recalcularHorariosCopia = () => {
    if (!agendarHorariosCopia || pontosCopiados.length === 0) return;
    
    const novosHorarios = pontosCopiados.map((ponto, index) => {
      let minutosAcumulados = 0;
      for (let i = 0; i < index; i++) {
        minutosAcumulados += (pontosCopiados[i].duracao_estimada || 30) + tempoDeslocamentoCopia;
      }
      
      try {
        const horaBase = parse(horarioInicialCopia, 'HH:mm', new Date());
        const novaHora = addMinutes(horaBase, minutosAcumulados);
        return { ...ponto, horario_agendado: format(novaHora, 'HH:mm') };
      } catch {
        return ponto;
      }
    });
    
    setPontosCopiados(novosHorarios);
  };

  // Atualizar horário de ponto na cópia
  const atualizarHorarioPontoCopia = (index: number, horario: string) => {
    const novos = [...pontosCopiados];
    novos[index] = { ...novos[index], horario_agendado: horario };
    setPontosCopiados(novos);
  };

  // Atualizar duração de ponto na cópia
  const atualizarDuracaoPontoCopia = (index: number, duracao: number) => {
    const novos = [...pontosCopiados];
    novos[index] = { ...novos[index], duracao_estimada: duracao };
    setPontosCopiados(novos);
    // Recalcular próximos
    setTimeout(() => recalcularHorariosCopia(), 0);
  };

  // Atualizar horário de ponto na edição
  const atualizarHorarioPontoEdicao = (index: number, horario: string) => {
    const novos = [...pontosEdicao];
    novos[index] = { ...novos[index], horario_agendado: horario };
    setPontosEdicao(novos);
  };

  // Atualizar duração de ponto na edição
  const atualizarDuracaoPontoEdicao = (index: number, duracao: number) => {
    const novos = [...pontosEdicao];
    novos[index] = { ...novos[index], duracao_estimada: duracao };
    setPontosEdicao(novos);
  };

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
      toast.success(`Status alterado para ${STATUS_CONFIG[novoStatus as keyof typeof STATUS_CONFIG]?.label}`);
    } catch (error) {
      console.error('Erro ao mudar status:', error);
    }
  };

  const handleExcluirRota = async () => {
    if (!rotaParaExcluir) return;
    await excluirRota.mutateAsync(rotaParaExcluir.id);
    setRotaParaExcluir(null);
  };

  const handleCopiarRota = async () => {
    if (!rotaParaCopiar || !dataCopiaNova) return;
    
    try {
      // Criar nova rota com título e data novos
      const { data: novaRota, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          titulo: tituloCopia,
          usuario_id: user?.id,
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

      // Copiar os pontos com horários atualizados
      if (pontosCopiados.length > 0) {
        const pontosParaInserir = pontosCopiados.map(ponto => ({
          rota_id: novaRota.id,
          ordem: ponto.ordem,
          tipo: ponto.tipo,
          referencia_id: ponto.referencia_id,
          nome: ponto.nome,
          endereco: ponto.endereco,
          latitude: ponto.latitude,
          longitude: ponto.longitude,
          horario_agendado: agendarHorariosCopia ? ponto.horario_agendado : null,
          duracao_estimada: ponto.duracao_estimada || 30
        }));

        const { error: pontosError } = await supabase
          .from('rota_pontos')
          .insert(pontosParaInserir);

        if (pontosError) throw pontosError;
      }

      toast.success('Rota copiada com sucesso!');
      refetch();
      setRotaParaCopiar(null);
      setTituloCopia('');
      setDataCopiaNova(undefined);
      setPontosCopiados([]);
    } catch (error: any) {
      toast.error('Erro ao copiar rota: ' + error.message);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!rotaParaEditar || !dataEdicao) return;
    
    // Preparar pontos com horários
    const pontosParaSalvar = pontosEdicao.map(p => ({
      ordem: p.ordem,
      tipo: p.tipo,
      referencia_id: p.referencia_id,
      nome: p.nome,
      endereco: p.endereco,
      latitude: p.latitude,
      longitude: p.longitude,
      horario_agendado: p.horario_agendado || undefined,
      duracao_estimada: p.duracao_estimada || 30
    }));
    
    await atualizarRota.mutateAsync({
      id: rotaParaEditar.id,
      titulo: tituloEdicao,
      data_programada: format(dataEdicao, 'yyyy-MM-dd'),
      observacoes: observacoesEdicao,
      pontos: pontosParaSalvar
    });
    setRotaParaEditar(null);
  };

  // Abrir no Google Maps
  const abrirGoogleMaps = (rota: Rota) => {
    if (!rota.rota_pontos || rota.rota_pontos.length === 0) {
      toast.error('Esta rota não possui pontos');
      return;
    }

    const pontos = rota.rota_pontos.sort((a, b) => a.ordem - b.ordem);
    const waypoints = pontos.map(p => `${p.latitude},${p.longitude}`).join('/');
    
    // Formato: origin/destination ou origin/waypoint1/waypoint2/.../destination
    const origem = rota.origem_lat && rota.origem_lng 
      ? `${rota.origem_lat},${rota.origem_lng}` 
      : `${pontos[0].latitude},${pontos[0].longitude}`;
    
    const destino = rota.destino_lat && rota.destino_lng
      ? `${rota.destino_lat},${rota.destino_lng}`
      : `${pontos[pontos.length - 1].latitude},${pontos[pontos.length - 1].longitude}`;

    let url = `https://www.google.com/maps/dir/${origem}`;
    
    // Adicionar waypoints intermediários
    if (pontos.length > 1) {
      pontos.forEach(p => {
        url += `/${p.latitude},${p.longitude}`;
      });
    }
    
    if (destino !== `${pontos[pontos.length - 1].latitude},${pontos[pontos.length - 1].longitude}`) {
      url += `/${destino}`;
    }

    window.open(url, '_blank');
  };

  // Formatar data
  const formatarData = (dataStr: string) => {
    try {
      const data = new Date(dataStr + 'T00:00:00');
      return format(data, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  // Formatar data relativa
  const formatarDataRelativa = (dataStr: string) => {
    try {
      const data = new Date(dataStr + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffDias = Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias === 0) return 'Hoje';
      if (diffDias === 1) return 'Amanhã';
      if (diffDias === -1) return 'Ontem';
      if (diffDias > 0 && diffDias <= 7) return `Em ${diffDias} dias`;
      if (diffDias < 0 && diffDias >= -7) return `Há ${Math.abs(diffDias)} dias`;
      
      return format(data, "dd 'de' MMMM", { locale: ptBR });
    } catch {
      return dataStr;
    }
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
              Visualize, edite e gerencie suas rotas de visitas
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="flex flex-col gap-3 pb-4 border-b">
            {/* Busca e Filtros */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar rotas..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex items-center gap-2 px-3 border rounded-md bg-muted/30">
                <Checkbox
                  id="apenas-minhas"
                  checked={apenasMinhas}
                  onCheckedChange={(checked) => setApenasMinhas(!!checked)}
                />
                <label htmlFor="apenas-minhas" className="text-sm whitespace-nowrap cursor-pointer">
                  Apenas minhas
                </label>
              </div>

              {!apenasMinhas && (
                <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todos">Todos os usuários</SelectItem>
                    {usuarios.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>

            {/* Filtros de Status */}
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const count = contagemStatus[key] || 0;
                const isSelected = statusFiltro.includes(key);
                return (
                  <Button
                    key={key}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "gap-1.5",
                      isSelected && config.bgClass
                    )}
                    onClick={() => toggleStatus(key)}
                  >
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      !isSelected && "opacity-60"
                    )} style={{ backgroundColor: config.cor }} />
                    {config.label}
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </Button>
                );
              })}
              
              {statusFiltro.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFiltro([])}
                  className="text-muted-foreground"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>

          {/* Lista de Rotas */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rotasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma rota encontrada</p>
                <p className="text-sm">Tente ajustar os filtros</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {rotasFiltradas.map((rota) => {
                  const statusConfig = STATUS_CONFIG[rota.status as keyof typeof STATUS_CONFIG];
                  const transicoesPossiveis = STATUS_TRANSITIONS[rota.status as keyof typeof STATUS_TRANSITIONS] || [];
                  const temHorarios = rota.rota_pontos?.some(p => p.horario_agendado);
                  
                  return (
                    <Card key={rota.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{rota.titulo}</h3>
                              <Badge variant="outline" className={cn("text-xs shrink-0", statusConfig?.bgClass)}>
                                {statusConfig?.label}
                              </Badge>
                              {temHorarios && (
                                <Badge variant="secondary" className="text-xs shrink-0 bg-blue-100 text-blue-700">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Agendada
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {formatarDataRelativa(rota.data_programada)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {rota.rota_pontos?.length || 0} pontos
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {rota.usuario_nome}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Botões de ação rápida baseados no status */}
                            {rota.status === 'pendente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => handleMudarStatus(rota, 'em_andamento')}
                              >
                                <Play className="h-3.5 w-3.5" />
                                Iniciar
                              </Button>
                            )}
                            
                            {rota.status === 'em_andamento' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1 bg-green-600 hover:bg-green-700"
                                onClick={() => onConcluirRota?.(rota)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Concluir
                              </Button>
                            )}

                            {/* Menu de mais opções */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setRotaDetalhes(rota)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => abrirGoogleMaps(rota)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir no Google Maps
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                
                                {rota.status !== 'concluida' && (
                                  <DropdownMenuItem onClick={() => setRotaParaEditar(rota)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuItem onClick={() => setRotaParaCopiar(rota)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copiar / Refazer
                                </DropdownMenuItem>

                                {transicoesPossiveis.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {transicoesPossiveis.map(status => (
                                      <DropdownMenuItem 
                                        key={status}
                                        onClick={() => handleMudarStatus(rota, status)}
                                      >
                                        {status === 'cancelada' && <XCircle className="h-4 w-4 mr-2" />}
                                        {status === 'pendente' && <RotateCcw className="h-4 w-4 mr-2" />}
                                        {status === 'em_andamento' && <Play className="h-4 w-4 mr-2" />}
                                        {status === 'concluida' && <CheckCircle className="h-4 w-4 mr-2" />}
                                        {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}

                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem 
                                  onClick={() => setRotaParaExcluir(rota)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Rota */}
      <Dialog open={!!rotaDetalhes} onOpenChange={() => setRotaDetalhes(null)}>
        <DialogContent className="max-w-lg">
          {rotaDetalhes && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  {rotaDetalhes.titulo}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3 pt-1">
                  <Badge variant="outline" className={STATUS_CONFIG[rotaDetalhes.status as keyof typeof STATUS_CONFIG]?.bgClass}>
                    {STATUS_CONFIG[rotaDetalhes.status as keyof typeof STATUS_CONFIG]?.label}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatarData(rotaDetalhes.data_programada)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold">{rotaDetalhes.rota_pontos?.length || 0}</span>
                    <span className="text-xs text-muted-foreground block">Total de Paradas</span>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-red-700">
                        {rotaDetalhes.rota_pontos?.filter(p => p.tipo === 'demanda').length || 0}
                    </span>
                    <span className="text-xs text-red-600/80 uppercase font-medium">Demandas</span>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-purple-700">
                        {rotaDetalhes.rota_pontos?.filter(p => p.tipo === 'municipe').length || 0}
                    </span>
                    <span className="text-xs text-purple-600/80 uppercase font-medium">Munícipes</span>
                </div>
              </div>

              {/* Lista de Pontos */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Roteiro de Visitas
                </h5>
                <ScrollArea className="h-[250px] pr-4 -mr-4">
                  <div className="space-y-3 pl-1 pr-3">
                    {rotaDetalhes.rota_pontos?.map((ponto, index) => (
                      <div key={ponto.id} className="relative flex gap-3 group">
                        {/* Linha conectora (exceto no último) */}
                        {index !== (rotaDetalhes.rota_pontos?.length || 0) - 1 && (
                            <div className="absolute left-[11px] top-8 bottom-[-12px] w-[2px] bg-border group-hover:bg-primary/20 transition-colors" />
                        )}
                        
                        {/* Marcador */}
                        <div className="flex-shrink-0 mt-1">
                            <Badge 
                                variant="outline" 
                                className={cn(
                                    "w-6 h-6 p-0 flex items-center justify-center text-xs rounded-full border-2 bg-background z-10 relative",
                                    ponto.tipo === 'demanda' ? "border-red-200 text-red-700" : "border-purple-200 text-purple-700"
                                )}
                            >
                                {index + 1}
                            </Badge>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">{ponto.nome}</span>
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                            {ponto.tipo === 'demanda' ? 'Demanda' : 'Munícipe'}
                                        </Badge>
                                        {/* Mostrar horário agendado */}
                                        {ponto.horario_agendado && (
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 border-blue-200 text-blue-700">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {ponto.horario_agendado}
                                          </Badge>
                                        )}
                                    </div>
                                    {ponto.endereco && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {ponto.endereco}
                                        </p>
                                    )}
                                    {/* Mostrar duração estimada */}
                                    {ponto.duracao_estimada && ponto.duracao_estimada !== 30 && (
                                      <p className="text-xs text-muted-foreground">
                                        Duração: {ponto.duracao_estimada} min
                                      </p>
                                    )}
                                </div>
                                {ponto.tipo === 'demanda' ? (
                                    <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
                                ) : (
                                    <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                                )}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {rotaDetalhes.observacoes && (
                <div className="bg-muted/30 p-3 rounded-lg border text-sm">
                  <h5 className="font-medium mb-1 text-xs uppercase text-muted-foreground">Observações</h5>
                  <p className="text-muted-foreground italic">"{rotaDetalhes.observacoes}"</p>
                </div>
              )}

              <DialogFooter className="sm:justify-between gap-2 border-t pt-4">
                <Button 
                    variant="ghost" 
                    onClick={() => setRotaDetalhes(null)}
                >
                    Fechar
                </Button>
                <Button 
                    onClick={() => abrirGoogleMaps(rotaDetalhes)}
                    className="flex-1 sm:flex-none"
                >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir no Google Maps
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!rotaParaEditar} onOpenChange={() => setRotaParaEditar(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Rota
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
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

              {/* Horários dos Pontos */}
              {pontosEdicao.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Horários das Visitas ({pontosEdicao.length} pontos)
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHorariosExpandidosEdicao(!horariosExpandidosEdicao)}
                    >
                      {horariosExpandidosEdicao ? (
                        <><ChevronUp className="h-4 w-4 mr-1" /> Ocultar</>
                      ) : (
                        <><ChevronDown className="h-4 w-4 mr-1" /> Expandir</>
                      )}
                    </Button>
                  </div>

                  {horariosExpandidosEdicao && (
                    <ScrollArea className="h-48 rounded-md border p-2">
                      <div className="space-y-2">
                        {pontosEdicao.map((ponto, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                            <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs shrink-0">
                              {index + 1}
                            </Badge>
                            {ponto.tipo === 'demanda' ? (
                              <FileText className="h-3 w-3 text-red-500 shrink-0" />
                            ) : (
                              <Users className="h-3 w-3 text-purple-500 shrink-0" />
                            )}
                            <span className="truncate flex-1">{ponto.nome}</span>
                            <Input
                              type="time"
                              value={ponto.horario_agendado || ''}
                              onChange={(e) => atualizarHorarioPontoEdicao(index, e.target.value)}
                              className="w-24 h-7 text-xs"
                            />
                            <Input
                              type="number"
                              min={5}
                              max={180}
                              value={ponto.duracao_estimada || 30}
                              onChange={(e) => atualizarDuracaoPontoEdicao(index, Number(e.target.value))}
                              className="w-16 h-7 text-xs"
                              title="Duração em minutos"
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

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
          </ScrollArea>

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
        setPontosCopiados([]);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Copiar / Refazer Rota
            </DialogTitle>
            <DialogDescription>
              Crie uma cópia desta rota com um novo título, data e horários.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
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

              {/* Toggle Agendar Horários */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Agendar horários</Label>
                    <p className="text-xs text-muted-foreground">
                      Defina novos horários para cada visita
                    </p>
                  </div>
                </div>
                <Switch
                  checked={agendarHorariosCopia}
                  onCheckedChange={setAgendarHorariosCopia}
                />
              </div>

              {/* Configurações de Horário */}
              {agendarHorariosCopia && (
                <div className="space-y-4 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Horário Inicial</Label>
                      <Input
                        type="time"
                        value={horarioInicialCopia}
                        onChange={(e) => setHorarioInicialCopia(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Deslocamento (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={tempoDeslocamentoCopia}
                        onChange={(e) => setTempoDeslocamentoCopia(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={recalcularHorariosCopia}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recalcular Horários
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setHorariosExpandidosCopia(!horariosExpandidosCopia)}
                  >
                    {horariosExpandidosCopia ? (
                      <><ChevronUp className="h-4 w-4 mr-2" /> Ocultar horários</>
                    ) : (
                      <><ChevronDown className="h-4 w-4 mr-2" /> Ajustar horários individuais</>
                    )}
                  </Button>

                  {horariosExpandidosCopia && (
                    <ScrollArea className="h-48 rounded-md border bg-background p-2">
                      <div className="space-y-2">
                        {pontosCopiados.map((ponto, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                            <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs shrink-0">
                              {index + 1}
                            </Badge>
                            {ponto.tipo === 'demanda' ? (
                              <FileText className="h-3 w-3 text-red-500 shrink-0" />
                            ) : (
                              <Users className="h-3 w-3 text-purple-500 shrink-0" />
                            )}
                            <span className="truncate flex-1">{ponto.nome}</span>
                            <Input
                              type="time"
                              value={ponto.horario_agendado || ''}
                              onChange={(e) => atualizarHorarioPontoCopia(index, e.target.value)}
                              className="w-24 h-7 text-xs"
                            />
                            <Input
                              type="number"
                              min={5}
                              max={180}
                              value={ponto.duracao_estimada || 30}
                              onChange={(e) => atualizarDuracaoPontoCopia(index, Number(e.target.value))}
                              className="w-16 h-7 text-xs"
                              title="Duração em minutos"
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              <div className="p-3 bg-muted rounded text-sm">
                <p className="font-medium mb-1">Será copiado:</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>• {pontosCopiados.length} pontos de parada</li>
                  <li>• Configurações de origem e destino</li>
                  <li>• Observações originais</li>
                  {agendarHorariosCopia && <li>• Novos horários definidos</li>}
                </ul>
              </div>
            </div>
          </ScrollArea>

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
