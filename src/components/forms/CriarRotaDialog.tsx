import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { 
  CalendarIcon, 
  MapPin, 
  FileText, 
  User, 
  Route, 
  Loader2, 
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIconOutline
} from 'lucide-react';
import { format, addMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useRotas, RotaPonto } from '@/hooks/useRotas';

interface PontoComHorario {
  ponto: DemandaMapa | MunicipeMapa;
  horario: string; // HH:MM
  duracao: number; // minutos
}

interface CriarRotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pontosRota: Array<DemandaMapa | MunicipeMapa>;
  origemRota: { lat: number; lng: number } | null;
  destinoRota: { lat: number; lng: number } | null;
  otimizarRota: boolean;
  onSuccess?: () => void;
}

export function CriarRotaDialog({
  open,
  onOpenChange,
  pontosRota,
  origemRota,
  destinoRota,
  otimizarRota,
  onSuccess
}: CriarRotaDialogProps) {
  const { criarRota } = useRotas();
  const [titulo, setTitulo] = useState('');
  const [dataProgramada, setDataProgramada] = useState<Date | undefined>(undefined);
  const [observacoes, setObservacoes] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Estados para agendamento de horários
  const [agendarHorarios, setAgendarHorarios] = useState(false);
  const [horarioInicial, setHorarioInicial] = useState('09:00');
  const [duracaoPadrao, setDuracaoPadrao] = useState(30); // minutos
  const [tempoDeslocamento, setTempoDeslocamento] = useState(15); // minutos entre pontos
  const [pontosComHorario, setPontosComHorario] = useState<PontoComHorario[]>([]);
  const [horariosExpandidos, setHorariosExpandidos] = useState(false);

  // Inicializar pontos com horários quando pontosRota mudar ou agendamento for ativado
  useEffect(() => {
    if (pontosRota.length > 0) {
      const novosPontos = pontosRota.map((ponto, index) => ({
        ponto,
        horario: calcularHorario(index),
        duracao: duracaoPadrao
      }));
      setPontosComHorario(novosPontos);
    }
  }, [pontosRota]);

  // Recalcular horários quando configurações mudarem
  useEffect(() => {
    if (agendarHorarios && pontosComHorario.length > 0) {
      recalcularHorarios();
    }
  }, [horarioInicial, tempoDeslocamento, agendarHorarios]);

  // Função para calcular horário de um ponto baseado no índice
  const calcularHorario = (index: number): string => {
    try {
      const horaBase = parse(horarioInicial, 'HH:mm', new Date());
      let minutosAcumulados = 0;
      
      for (let i = 0; i < index; i++) {
        const duracaoAnterior = pontosComHorario[i]?.duracao || duracaoPadrao;
        minutosAcumulados += duracaoAnterior + tempoDeslocamento;
      }
      
      const novaHora = addMinutes(horaBase, minutosAcumulados);
      return format(novaHora, 'HH:mm');
    } catch {
      return '09:00';
    }
  };

  // Recalcular todos os horários
  const recalcularHorarios = () => {
    const novosHorarios = pontosComHorario.map((item, index) => {
      let minutosAcumulados = 0;
      
      for (let i = 0; i < index; i++) {
        minutosAcumulados += pontosComHorario[i].duracao + tempoDeslocamento;
      }
      
      try {
        const horaBase = parse(horarioInicial, 'HH:mm', new Date());
        const novaHora = addMinutes(horaBase, minutosAcumulados);
        return {
          ...item,
          horario: format(novaHora, 'HH:mm')
        };
      } catch {
        return item;
      }
    });
    
    setPontosComHorario(novosHorarios);
  };

  // Atualizar duração de um ponto específico
  const atualizarDuracaoPonto = (index: number, novaDuracao: number) => {
    const novosPontos = [...pontosComHorario];
    novosPontos[index] = { ...novosPontos[index], duracao: novaDuracao };
    
    // Recalcular horários dos pontos seguintes
    for (let i = index + 1; i < novosPontos.length; i++) {
      let minutosAcumulados = 0;
      for (let j = 0; j < i; j++) {
        minutosAcumulados += novosPontos[j].duracao + tempoDeslocamento;
      }
      
      try {
        const horaBase = parse(horarioInicial, 'HH:mm', new Date());
        const novaHora = addMinutes(horaBase, minutosAcumulados);
        novosPontos[i] = { ...novosPontos[i], horario: format(novaHora, 'HH:mm') };
      } catch {
        // Manter horário atual
      }
    }
    
    setPontosComHorario(novosPontos);
  };

  // Atualizar horário de um ponto específico (manual)
  const atualizarHorarioPonto = (index: number, novoHorario: string) => {
    const novosPontos = [...pontosComHorario];
    novosPontos[index] = { ...novosPontos[index], horario: novoHorario };
    setPontosComHorario(novosPontos);
  };

  // Calcular horário de término estimado
  const horarioTermino = useMemo(() => {
    if (pontosComHorario.length === 0) return null;
    
    const ultimoPonto = pontosComHorario[pontosComHorario.length - 1];
    try {
      const horaUltimo = parse(ultimoPonto.horario, 'HH:mm', new Date());
      const horaFim = addMinutes(horaUltimo, ultimoPonto.duracao);
      return format(horaFim, 'HH:mm');
    } catch {
      return null;
    }
  }, [pontosComHorario]);

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      return;
    }
    if (!dataProgramada) {
      return;
    }
    if (pontosRota.length === 0) {
      return;
    }

    // Converter pontos para o formato esperado
    const pontos: Omit<RotaPonto, 'id' | 'rota_id'>[] = pontosComHorario.map((item, index) => {
      const ponto = item.ponto;
      const isDemanda = 'titulo' in ponto;
      return {
        ordem: index + 1,
        tipo: isDemanda ? 'demanda' : 'municipe',
        referencia_id: ponto.id,
        nome: isDemanda ? ponto.titulo : ponto.nome,
        endereco: ponto.bairro ? `${ponto.bairro}${ponto.cidade ? ', ' + ponto.cidade : ''}` : undefined,
        latitude: ponto.latitude!,
        longitude: ponto.longitude!,
        horario_agendado: agendarHorarios ? item.horario : undefined,
        duracao_estimada: item.duracao
      };
    });

    await criarRota.mutateAsync({
      titulo,
      data_programada: format(dataProgramada, 'yyyy-MM-dd'),
      origem_lat: origemRota?.lat,
      origem_lng: origemRota?.lng,
      destino_lat: destinoRota?.lat,
      destino_lng: destinoRota?.lng,
      otimizar: otimizarRota,
      observacoes: observacoes || undefined,
      pontos
    });

    // Limpar formulário
    setTitulo('');
    setDataProgramada(undefined);
    setObservacoes('');
    setAgendarHorarios(false);
    setHorarioInicial('09:00');
    
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setTitulo('');
    setDataProgramada(undefined);
    setObservacoes('');
    setAgendarHorarios(false);
    setHorarioInicial('09:00');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Criar Rota de Visitas
          </DialogTitle>
          <DialogDescription>
            Salve esta rota para acompanhamento e histórico. Você pode agendar horários para cada visita.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="titulo">Título da Rota *</Label>
              <Input
                id="titulo"
                placeholder="Ex: Visitas Centro - Manhã"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            {/* Data Programada */}
            <div className="space-y-2">
              <Label>Data Programada *</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataProgramada && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataProgramada 
                      ? format(dataProgramada, "PPP", { locale: ptBR })
                      : "Selecione a data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataProgramada}
                    onSelect={(date) => {
                      setDataProgramada(date);
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
                    Defina horários para cada visita (para integração com Google Calendar)
                  </p>
                </div>
              </div>
              <Switch
                checked={agendarHorarios}
                onCheckedChange={setAgendarHorarios}
              />
            </div>

            {/* Configurações de Horário */}
            {agendarHorarios && (
              <div className="space-y-4 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                <div className="grid grid-cols-3 gap-3">
                  {/* Horário Inicial */}
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="time"
                      value={horarioInicial}
                      onChange={(e) => setHorarioInicial(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Duração Padrão */}
                  <div className="space-y-1">
                    <Label className="text-xs">Duração (min)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={180}
                      value={duracaoPadrao}
                      onChange={(e) => setDuracaoPadrao(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>

                  {/* Tempo de Deslocamento */}
                  <div className="space-y-1">
                    <Label className="text-xs">Deslocamento (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={tempoDeslocamento}
                      onChange={(e) => setTempoDeslocamento(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Resumo */}
                {horarioTermino && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Término estimado:</span>
                    <Badge variant="secondary" className="font-mono">
                      {horarioTermino}
                    </Badge>
                  </div>
                )}

                {/* Botão para expandir/recolher horários */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setHorariosExpandidos(!horariosExpandidos)}
                >
                  {horariosExpandidos ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Ocultar horários individuais
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Ajustar horários individuais
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Pontos da Rota */}
            <div className="space-y-2">
              <Label>Pontos da Rota ({pontosRota.length})</Label>
              <ScrollArea className={cn(
                "rounded-md border",
                agendarHorarios && horariosExpandidos ? "h-64" : "h-32"
              )}>
                <div className="p-2 space-y-2">
                  {pontosComHorario.map((item, index) => {
                    const ponto = item.ponto;
                    const isDemanda = 'titulo' in ponto;
                    return (
                      <div 
                        key={ponto.id} 
                        className={cn(
                          "flex items-center gap-2 text-sm p-2 rounded",
                          agendarHorarios && horariosExpandidos && "bg-muted/50"
                        )}
                      >
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs shrink-0">
                          {index + 1}
                        </Badge>
                        
                        {isDemanda ? (
                          <FileText className="h-3 w-3 text-red-500 shrink-0" />
                        ) : (
                          <User className="h-3 w-3 text-purple-500 shrink-0" />
                        )}
                        
                        <span className="truncate flex-1">
                          {isDemanda ? ponto.titulo : ponto.nome}
                        </span>

                        {/* Horário e duração (apenas se expandido) */}
                        {agendarHorarios && horariosExpandidos && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="time"
                              value={item.horario}
                              onChange={(e) => atualizarHorarioPonto(index, e.target.value)}
                              className="w-24 h-7 text-xs"
                            />
                            <Input
                              type="number"
                              min={5}
                              max={180}
                              value={item.duracao}
                              onChange={(e) => atualizarDuracaoPonto(index, Number(e.target.value))}
                              className="w-16 h-7 text-xs"
                              title="Duração em minutos"
                            />
                          </div>
                        )}

                        {/* Badge de horário (quando não expandido) */}
                        {agendarHorarios && !horariosExpandidos && (
                          <Badge variant="secondary" className="font-mono text-xs shrink-0">
                            {item.horario}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Informações adicionais */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {origemRota && (
                <Badge variant="secondary" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Origem definida
                </Badge>
              )}
              {destinoRota && (
                <Badge variant="secondary" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Destino definido
                </Badge>
              )}
              {otimizarRota && (
                <Badge variant="secondary" className="text-xs">
                  ⚡ Otimização ativa
                </Badge>
              )}
              {agendarHorarios && (
                <Badge variant="default" className="text-xs bg-blue-600">
                  <CalendarIconOutline className="h-3 w-3 mr-1" />
                  Com agendamento
                </Badge>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Adicione observações sobre esta rota..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!titulo.trim() || !dataProgramada || pontosRota.length === 0 || criarRota.isPending}
          >
            {criarRota.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Criar Rota'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
