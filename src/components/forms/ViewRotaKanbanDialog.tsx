import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Route,
  Calendar,
  User,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  FileText,
} from "lucide-react";
import { formatDateOnly, formatDateTime } from "@/lib/dateUtils";
import { logError } from "@/lib/errorUtils";

interface ViewRotaKanbanDialogProps {
  rota: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewRotaKanbanDialog({
  rota,
  open,
  onOpenChange,
}: ViewRotaKanbanDialogProps) {
  // Buscar pontos da rota (se rota veio sem pontos detalhados)
  const { data: pontosData = [] } = useQuery({
    queryKey: ["rota-pontos-kanban", rota?.id],
    queryFn: async () => {
      if (!rota?.id) return [];
      const { data, error } = await supabase
        .from("rota_pontos")
        .select("*")
        .eq("rota_id", rota.id)
        .order("ordem", { ascending: true });
      if (error) {
        logError("Erro ao buscar pontos da rota:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!rota?.id && open,
  });

  if (!rota) return null;

  const pontos = rota.rota_pontos || pontosData;
  const pontosVisitados = pontos.filter((p: any) => p.visitado).length;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "em_andamento":
        return "Em Andamento";
      case "concluida":
        return "Concluída";
      case "cancelada":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pendente":
        return "secondary";
      case "em_andamento":
        return "default";
      case "concluida":
        return "outline";
      case "cancelada":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Construir link do Google Maps
  const buildGoogleMapsUrl = () => {
    if (pontos.length === 0) return null;
    const waypoints = pontos
      .map((p: any) => `${p.latitude},${p.longitude}`)
      .join("/");
    return `https://www.google.com/maps/dir/${waypoints}`;
  };

  const googleMapsUrl = buildGoogleMapsUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-emerald-600" />
            Detalhes da Rota
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <h2 className="text-lg font-semibold">{rota.titulo}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getStatusVariant(rota.rota_status || rota.status)}>
                  {getStatusLabel(rota.rota_status || rota.status)}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                >
                  Rota
                </Badge>
              </div>
            </div>
            {googleMapsUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="flex-shrink-0"
              >
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Google Maps
                </a>
              </Button>
            )}
          </div>

          {/* Informações principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data Programada
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatDateOnly(rota.data_programada)}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </h3>
              <p className="text-sm text-muted-foreground">
                {rota.usuario_nome || "—"}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pontos
              </h3>
              <p className="text-sm text-muted-foreground">
                {pontos.length} ponto(s)
                {pontosVisitados > 0 && (
                  <span className="text-emerald-600 ml-1">
                    ({pontosVisitados} visitado{pontosVisitados !== 1 ? "s" : ""})
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Criada em
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(rota.created_at)}
              </p>
            </div>
          </div>

          {/* Observações */}
          {rota.observacoes && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                {rota.observacoes}
              </p>
            </div>
          )}

          {/* Observações de conclusão */}
          {rota.observacoes_conclusao && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Observações de Conclusão
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
                {rota.observacoes_conclusao}
              </p>
            </div>
          )}

          {/* Lista de pontos */}
          {pontos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Pontos da Rota</h3>
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                {pontos.map((ponto: any, index: number) => (
                  <div
                    key={ponto.id || index}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
                      ponto.visitado
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/50"
                        : "bg-card border-border"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        ponto.visitado
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ponto.visitado ? "✓" : ponto.ordem || index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ponto.nome}</p>
                      {ponto.endereco && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ponto.endereco}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
                      {ponto.horario_agendado && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ponto.horario_agendado}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {ponto.tipo === "demanda" ? "Demanda" : "Munícipe"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
