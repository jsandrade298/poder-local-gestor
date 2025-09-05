import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OverdueDemanda {
  id: string;
  titulo: string;
  protocolo: string;
  area?: string;
  cidade?: string;
  bairro?: string;
  data_prazo: string;
  diasAtraso: number;
  status: string;
}

interface OverdueListProps {
  title: string;
  demandas: OverdueDemanda[];
}

export function OverdueList({ title, demandas }: OverdueListProps) {
  const navigate = useNavigate();

  const handleDemandaClick = () => {
    navigate('/demandas?atraso=overdue');
  };

  const handleCardClick = () => {
    navigate('/demandas?atraso=overdue');
  };

  const handleSpecificDemandaClick = (demandaId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/demandas?id=${demandaId}`);
  };

  return (
    <Card 
      className="backdrop-blur-sm bg-card/95 border-destructive/20 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{title}</span>
          </div>
          <Badge variant="destructive" className="text-xs">
            {demandas.length} {demandas.length === 1 ? 'demanda' : 'demandas'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {demandas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma demanda em atraso
          </p>
        ) : (
          <>
            {demandas.slice(0, 3).map((demanda) => (
              <div
                key={demanda.id}
                className="p-3 rounded-lg bg-muted/50 border border-destructive/10 hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={(e) => handleSpecificDemandaClick(demanda.id, e)}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-1">
                      {demanda.titulo}
                    </h4>
                    <Badge variant="outline" className="text-xs shrink-0">
                      #{demanda.protocolo}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{demanda.diasAtraso} dias em atraso</span>
                    </div>
                    {demanda.area && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{demanda.area}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {demandas.length > 3 && (
              <div className="text-center pt-2">
                <button 
                  onClick={handleDemandaClick}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Ver todas as {demandas.length} demandas em atraso
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}