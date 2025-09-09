import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Edit, Palette } from "lucide-react";
import { formatDateTime } from '@/lib/dateUtils';

interface ViewTarefaDialogProps {
  tarefa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (tarefa: any) => void;
}

export function ViewTarefaDialog({ tarefa, open, onOpenChange, onEdit }: ViewTarefaDialogProps) {
  if (!tarefa) return null;

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))';
      case 'media': return 'hsl(var(--chart-2))';
      case 'alta': return 'hsl(var(--chart-1))';
      case 'urgente': return 'hsl(var(--chart-5))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return prioridade;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: tarefa.cor || '#3B82F6' }}
              />
              Visualizar Tarefa
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(tarefa)}
              className="flex items-center gap-1"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cabeçalho da tarefa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tarefa.titulo}</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Tarefa
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">#{tarefa.protocolo}</p>
          </div>

          {/* Descrição */}
          {tarefa.descricao && (
            <div className="space-y-2">
              <h3 className="font-medium">Descrição</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {tarefa.descricao}
              </p>
            </div>
          )}

          {/* Informações principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Prioridade</h3>
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: getPrioridadeColor(tarefa.prioridade),
                  color: getPrioridadeColor(tarefa.prioridade)
                }}
              >
                {getPrioridadeLabel(tarefa.prioridade)}
              </Badge>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Status</h3>
              <Badge variant={tarefa.completed ? "default" : "secondary"}>
                {tarefa.completed ? "Concluída" : "Em andamento"}
              </Badge>
            </div>
          </div>

          {/* Colaboradores */}
          {tarefa.colaboradores && tarefa.colaboradores.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Colaboradores
              </h3>
              <div className="flex flex-wrap gap-2">
                {tarefa.colaboradores.map((colaborador: any, index: number) => (
                  <Badge key={index} variant="outline">
                    {colaborador.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Cor */}
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Cor do Card
            </h3>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: tarefa.cor || '#3B82F6' }}
              />
              <span className="text-sm text-muted-foreground">
                {tarefa.cor || '#3B82F6'}
              </span>
            </div>
          </div>

          {/* Data de criação */}
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Criado em
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(tarefa.created_at)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}