import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Users, 
  FileText, 
  TrendingUp, 
  Target,
  AlertCircle,
  CheckCircle,
  Download
} from 'lucide-react';

interface InsightsPanelProps {
  dados: {
    estatisticas: {
      totalDemandas: number;
      totalMunicipes: number;
      areas: any[];
      tags: any[];
      combinacaoPrincipal: any;
    };
    markers: any[];
  };
}

export function InsightsPanel({ dados }: InsightsPanelProps) {
  const { estatisticas, markers } = dados;

  // Encontrar insights interessantes
  const insights = [
    ...(estatisticas.combinacaoPrincipal ? [{
      tipo: 'correlacao',
      titulo: 'Correlação Forte Encontrada',
      descricao: `${estatisticas.combinacaoPrincipal.tag} → ${estatisticas.combinacaoPrincipal.area}`,
      porcentagem: estatisticas.combinacaoPrincipal.percentual.toFixed(1),
      cor: estatisticas.combinacaoPrincipal.corTag,
      icone: TrendingUp
    }] : []),
    
    ...(estatisticas.areas.length > 0 ? [{
      tipo: 'area_mais',
      titulo: 'Área Mais Demandada',
      descricao: estatisticas.areas[0]?.nome,
      porcentagem: ((estatisticas.areas[0]?.count / estatisticas.totalDemandas) * 100).toFixed(1),
      cor: estatisticas.areas[0]?.cor,
      icone: Target
    }] : []),
    
    ...(estatisticas.tags.length > 0 ? [{
      tipo: 'grupo_mais',
      titulo: 'Grupo Mais Ativo',
      descricao: estatisticas.tags[0]?.nome,
      porcentagem: ((estatisticas.tags[0]?.count / estatisticas.totalMunicipes) * 100).toFixed(1),
      cor: estatisticas.tags[0]?.cor,
      icone: Users
    }] : []),
  ];

  // Gerar recomendações
  const recomendacoes = [
    ...(estatisticas.combinacaoPrincipal && estatisticas.combinacaoPrincipal.percentual > 30 ? [{
      nivel: 'alta',
      titulo: 'Oportunidade Estratégica',
      descricao: `Foque em ações para ${estatisticas.combinacaoPrincipal.area} para o grupo ${estatisticas.combinacaoPrincipal.tag}`,
      acao: 'Criar plano de ação específico'
    }] : []),
    
    ...(estatisticas.areas.length > 0 && estatisticas.areas[0]?.count > 5 ? [{
      nivel: 'media',
      titulo: 'Alta Demanda Local',
      descricao: `Muitas demandas de ${estatisticas.areas[0]?.nome} nesta região`,
      acao: 'Priorizar recursos para esta área'
    }] : []),
  ];

  const exportarDados = () => {
    const dadosExportacao = {
      estatisticas,
      marcadores: markers.length,
      timestamp: new Date().toISOString(),
      insights
    };
    
    const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-auto pr-2">
      <div className="space-y-4">
        {/* Resumo Geral */}
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Demandas</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {estatisticas.totalDemandas}
              </div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Munícipes</span>
              </div>
              <div className="text-2xl font-bold text-green-700">
                {estatisticas.totalMunicipes}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Análise baseada em {markers.length} elementos no mapa
          </div>
        </Card>

        {/* Insights Principais */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Insights Principais
          </h4>
          <div className="space-y-2">
            {insights.map((insight, idx) => {
              const Icon = insight.icone;
              return (
                <Card key={idx} className="p-3 border-l-4" style={{ borderLeftColor: insight.cor }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3 w-3" />
                        <span className="text-sm font-medium">{insight.titulo}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.descricao}</p>
                    </div>
                    <Badge 
                      variant="outline"
                      className="text-xs"
                      style={{ color: insight.cor, borderColor: insight.cor }}
                    >
                      {insight.porcentagem}%
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Áreas e Tags */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2 text-sm">Áreas Presentes</h4>
            <div className="space-y-1">
              {estatisticas.areas.slice(0, 3).map((area, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: area.cor }}
                    />
                    <span className="truncate">{area.nome}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {area.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2 text-sm">Grupos Presentes</h4>
            <div className="space-y-1">
              {estatisticas.tags.slice(0, 3).map((tag, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.cor }}
                    />
                    <span className="truncate">{tag.nome}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {tag.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recomendações */}
        {recomendacoes.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Recomendações
            </h4>
            <div className="space-y-2">
              {recomendacoes.map((rec, idx) => (
                <Card key={idx} className="p-3 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-amber-900">{rec.titulo}</div>
                      <p className="text-xs text-amber-700 mt-1">{rec.descricao}</p>
                      <div className="text-xs font-medium text-amber-800 mt-2">
                        {rec.acao}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Exportação */}
        <Card className="p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Exportar Análise</div>
              <p className="text-xs text-muted-foreground">Baixe os dados para relatórios</p>
            </div>
            <Button size="sm" variant="outline" onClick={exportarDados}>
              <Download className="h-3 w-3 mr-1" />
              Exportar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
