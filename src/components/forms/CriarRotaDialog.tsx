import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, MapPin, FileText, User, Route, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { useRotas, RotaPonto } from '@/hooks/useRotas';

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
    const pontos: Omit<RotaPonto, 'id' | 'rota_id'>[] = pontosRota.map((ponto, index) => {
      const isDemanda = 'titulo' in ponto;
      return {
        ordem: index + 1,
        tipo: isDemanda ? 'demanda' : 'municipe',
        referencia_id: ponto.id,
        nome: isDemanda ? ponto.titulo : ponto.nome,
        endereco: ponto.bairro ? `${ponto.bairro}${ponto.cidade ? ', ' + ponto.cidade : ''}` : undefined,
        latitude: ponto.latitude!,
        longitude: ponto.longitude!
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
    
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setTitulo('');
    setDataProgramada(undefined);
    setObservacoes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Criar Rota de Visitas
          </DialogTitle>
          <DialogDescription>
            Salve esta rota para acompanhamento e histórico.
          </DialogDescription>
        </DialogHeader>

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

          {/* Resumo dos Pontos */}
          <div className="space-y-2">
            <Label>Pontos da Rota ({pontosRota.length})</Label>
            <ScrollArea className="h-32 rounded-md border p-2">
              <div className="space-y-2">
                {pontosRota.map((ponto, index) => {
                  const isDemanda = 'titulo' in ponto;
                  return (
                    <div key={ponto.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      {isDemanda ? (
                        <FileText className="h-3 w-3 text-red-500" />
                      ) : (
                        <User className="h-3 w-3 text-purple-500" />
                      )}
                      <span className="truncate flex-1">
                        {isDemanda ? ponto.titulo : ponto.nome}
                      </span>
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
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Adicione observações sobre esta rota..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

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
