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

  const getColorClasses = () => {
    if (days >= 90) return "text-destructive border-destructive/30";
    if (days >= 60) return "text-warning border-warning/30";
    return "text-info border-info/30";
  };

  const getBgClasses = () => {
    if (days >= 90) return "bg-destructive/5";
    if (days >= 60) return "bg-warning/5";
    return "bg-info/5";
  };

  const Icon = getIcon();
  const colorClasses = getColorClasses();
  const bgClasses = getBgClasses();

  return (
    <Card className={`backdrop-blur-sm bg-card/95 border shadow-lg ${colorClasses} ${bgClasses}`}>
      <CardHeader className="pb-4">
        <CardTitle className={`text-lg font-semibold flex items-center gap-3`}>
          <div className={`p-2 rounded-lg ${bgClasses}`}>
            <Icon className={`h-5 w-5 ${colorClasses.split(' ')[0]}`} />
          </div>
          {title}
          <Badge variant={getVariant()} className="ml-auto">
            {demandas.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {demandas.length === 0 ? (
          <div className="text-center py-8">
            <Icon className={`h-8 w-8 mx-auto ${colorClasses.split(' ')[0]} opacity-50 mb-2`} />
            <p className="text-sm text-muted-foreground">
              Nenhuma demanda nesta faixa
            </p>
          </div>
        ) : (
          demandas.map((demanda) => (
            <div 
              key={demanda.id}
              className="group p-4 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 hover:border-border transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {demanda.titulo}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                      {demanda.area}
                    </span>
                    <span>•</span>
                    <span>{demanda.responsavel}</span>
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs ml-3 ${colorClasses.split(' ')[0]} border-current`}>
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