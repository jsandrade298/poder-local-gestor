import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

interface AgingListProps {
  title: string;
  days: number;
  demandas: Array<{
    id: string;
    titulo: string;
    area: string;
    responsavel: string;
    diasVencido: number;
  }>;
}

export function AgingList({ title, days, demandas }: AgingListProps) {
  const getIcon = () => {
    if (days >= 90) return AlertCircle;
    if (days >= 60) return AlertTriangle;
    return Clock;
  };

  const getVariant = () => {
    if (days >= 90) return "destructive";
    if (days >= 60) return "warning";
    return "secondary";
  };

  const Icon = getIcon();

  return (
    <Card className="shadow-sm border-0 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
          <Badge variant={getVariant()} className="ml-auto">
            {demandas.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {demandas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma demanda nesta faixa
          </p>
        ) : (
          demandas.map((demanda) => (
            <div 
              key={demanda.id}
              className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {demanda.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {demanda.area} • {demanda.responsavel}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {demanda.diasVencido}d
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}