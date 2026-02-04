import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle, 
  FileText, 
  User, 
  Loader2, 
  MapPin,
  ExternalLink,
  ClipboardList
} from 'lucide-react';
import { Rota, RotaPonto, useRotas } from '@/hooks/useRotas';

interface ConcluirRotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota: Rota | null;
  onAbrirDemanda?: (demandaId: string) => void;
  onAbrirMunicipe?: (municipeId: string) => void;
}

export function ConcluirRotaDialog({
  open,
  onOpenChange,
  rota,
  onAbrirDemanda,
  onAbrirMunicipe
}: ConcluirRotaDialogProps) {
  const { concluirRota, marcarPontoVisitado } = useRotas();
  const [observacoesConclusao, setObservacoesConclusao] = useState('');
  const [pontosVisitados, setPontosVisitados] = useState<Record<string, boolean>>({});

  if (!rota) return null;

  const handleTogglePontoVisitado = async (ponto: RotaPonto) => {
    if (!ponto.id) return;
    
    const novoEstado = !pontosVisitados[ponto.id];
    setPontosVisitados(prev => ({
      ...prev,
      [ponto.id!]: novoEstado
    }));

    await marcarPontoVisitado.mutateAsync({
      pontoId: ponto.id,
      visitado: novoEstado
    });
  };

  const handleAbrirRegistro = (ponto: RotaPonto) => {
    if (ponto.tipo === 'demanda' && onAbrirDemanda) {
      onAbrirDemanda(ponto.referencia_id);
    } else if (ponto.tipo === 'municipe' && onAbrirMunicipe) {
      onAbrirMunicipe(ponto.referencia_id);
    }
  };

  const handleConcluir = async () => {
    await concluirRota.mutateAsync({
      id: rota.id,
      observacoes_conclusao: observacoesConclusao || undefined
    });

    setObservacoesConclusao('');
    setPontosVisitados({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setObservacoesConclusao('');
    setPontosVisitados({});
    onOpenChange(false);
  };

  const pontosTotal = rota.rota_pontos?.length || 0;
  const pontosVisitadosCount = Object.values(pontosVisitados).filter(Boolean).length + 
    (rota.rota_pontos?.filter(p => p.visitado).length || 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Concluir Rota
          </DialogTitle>
          <DialogDescription>
            Revise os pontos visitados e registre observações antes de concluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info da Rota */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{rota.titulo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rota.data_programada).toLocaleDateString('pt-BR', { 
                      weekday: 'long', 
                      day: '2-digit', 
                      month: 'long' 
                    })}
                  </p>
                </div>
                <Badge variant="outline">
                  {pontosVisitadosCount}/{pontosTotal} visitados
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Pontos para Revisão */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Revise cada ponto e registre atividades
            </Label>
            <ScrollArea className="h-[250px] rounded-md border">
              <div className="p-3 space-y-2">
                {rota.rota_pontos?.map((ponto) => {
                  const isVisitado = pontosVisitados[ponto.id!] ?? ponto.visitado;
                  const isDemanda = ponto.tipo === 'demanda';
                  
                  return (
                    <Card key={ponto.id} className={`transition-colors ${isVisitado ? 'bg-green-50 border-green-200' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Checkbox de visitado */}
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isVisitado}
                              onCheckedChange={() => handleTogglePontoVisitado(ponto)}
                            />
                          </div>

                          {/* Info do ponto */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isDemanda ? (
                                <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                              ) : (
                                <User className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">
                                {ponto.nome}
                              </span>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {isDemanda ? 'Demanda' : 'Munícipe'}
                              </Badge>
                            </div>
                            {ponto.endereco && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {ponto.endereco}
                              </p>
                            )}
                          </div>

                          {/* Botão para abrir registro */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => handleAbrirRegistro(ponto)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {isDemanda ? 'Atualizar Atividade' : 'Registrar Prontuário'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Observações da Conclusão */}
          <div className="space-y-2">
            <Label htmlFor="observacoes-conclusao">Observações da Conclusão (opcional)</Label>
            <Textarea
              id="observacoes-conclusao"
              placeholder="Adicione observações sobre a realização desta rota..."
              value={observacoesConclusao}
              onChange={(e) => setObservacoesConclusao(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Ex: "Não consegui visitar o ponto 3, morador ausente" ou "Todas as visitas realizadas com sucesso"
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Voltar
          </Button>
          <Button 
            onClick={handleConcluir}
            disabled={concluirRota.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {concluirRota.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Concluindo...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir Rota
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
