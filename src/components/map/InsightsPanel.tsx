import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  Users, 
  FileText, 
  TrendingUp, 
  Target,
  AlertCircle,
  Lightbulb,
  Download
} from 'lucide-react';

interface Insight {
  tipo: 'correlacao' | 'concentracao' | 'oportunidade';
  titulo: string;
  descricao: string;
  valor?: number;
  cor?: string;
}

interface InsightsPanelProps {
  insights: Insight[];
  isLoading: boolean;
}

export function InsightsPanel({ insights, isLoading }: InsightsPanelProps) {
  
  const getInsightIcon = (tipo: string) => {
    switch (tipo) {
      case 'correlacao':
        return TrendingUp;
      case 'concentracao':
        return Target;
      case 'oportunidade':
        return Lightbulb;
      default:
        return BarChart3;
    }
  };

  const getInsightColor = (tipo: string, cor?: string) => {
    if (cor) return cor;
    switch (tipo) {
      case 'correlacao':
        return '#8b5cf6'; // purple
      case 'concentracao':
        return '#f59e0b'; // amber
      case 'oportunidade':
        return '#10b981'; // green
      default:
        return '#6b7280';
    }
  };

  const exportarInsights = () => {
    const dadosExportacao = {
      insights,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhum insight disponível</h3>
        <p className="text-sm text-muted-foreground">
          Aplique filtros e aguarde o carregamento dos dados para visualizar insights sobre correlações entre grupos de munícipes e áreas de demanda.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights Gerados
          </h3>
          <p className="text-sm text-muted-foreground">
            {insights.length} insight{insights.length !== 1 ? 's' : ''} identificado{insights.length !== 1 ? 's' : ''} nos dados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarInsights}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Lista de Insights */}
      <div className="space-y-4">
        {insights.map((insight, idx) => {
          const Icon = getInsightIcon(insight.tipo);
          const cor = getInsightColor(insight.tipo, insight.cor);
          
          return (
            <Card 
              key={idx} 
              className="p-4 border-l-4 hover:shadow-md transition-shadow"
              style={{ borderLeftColor: cor }}
            >
              <div className="flex items-start gap-4">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${cor}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: cor }} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{insight.titulo}</h4>
                    {insight.valor !== undefined && (
                      <Badge 
                        variant="outline"
                        className="ml-2"
                        style={{ color: cor, borderColor: cor }}
                      >
                        {typeof insight.valor === 'number' && insight.valor < 100 
                          ? `${insight.valor.toFixed(1)}%` 
                          : insight.valor}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {insight.descricao}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dica de uso */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 text-sm">Como usar estes insights</h4>
            <p className="text-xs text-blue-700 mt-1">
              Estes insights são gerados automaticamente com base nos cruzamentos entre tags de munícipes e áreas de demandas. 
              Use-os para identificar padrões, priorizar ações e planejar intervenções no território.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
