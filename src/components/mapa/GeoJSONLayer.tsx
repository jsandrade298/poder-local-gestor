import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// =============================================
// TIPOS
// =============================================

export type ModoVisualizacao = 
  | 'padrao'           // Cor sólida sem densidade
  | 'atendimento'      // Demandas + Munícipes
  | 'votos'            // Apenas votos
  | 'comparativo';     // Votos vs Atendimento

interface GeoJSONLayerProps {
  data: any;
  cor?: string;
  opacidade?: number;
  nome?: string;
  mostrarLabels?: boolean;
  onFeatureClick?: (feature: any, nome: string) => void;
  onFeatureHover?: (feature: any | null, nome: string | null) => void;
  
  // Estatísticas de atendimento (demandas + munícipes)
  estatisticas?: Map<string, { demandas: number; municipes: number }>;
  
  // Dados de votação
  votosPorRegiao?: Map<string, number>;
  
  // Total de eleitores por região
  totalEleitoresPorRegiao?: Map<string, number>;
  
  // Modo de visualização
  modoVisualizacao?: ModoVisualizacao;
  
  // Filtro de tipo (para considerar só demandas, só munícipes ou ambos)
  tipoFiltro?: 'todos' | 'demandas' | 'municipes';
  
  // Legacy: para compatibilidade com código existente
  colorirPorDensidade?: boolean;
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

/**
 * Obtém o nome da feature das propriedades
 */
const getFeatureName = (properties: any): string => {
  const campos = [
    'NOME', 'nome', 'NAME', 'name', 
    'NM_BAIRRO', 'nm_bairro', 'NM_MUNICIP', 'nm_municip',
    'NOME_BAIRR', 'nome_bairr', 'BAIRRO', 'bairro',
    'NM_ZONA', 'nm_zona', 'ZONA', 'zona',
    'NM_DISTRIT', 'nm_distrit', 'DISTRITO', 'distrito',
    'LABEL', 'label', 'DESCRICAO', 'descricao'
  ];
  
  for (const campo of campos) {
    if (properties?.[campo]) {
      return String(properties[campo]);
    }
  }
  
  return 'Sem nome';
};

/**
 * Gera cor para modo de atendimento (verde → vermelho)
 */
function getCorAtendimento(valor: number, maxValor: number, corBase: string): string {
  if (maxValor === 0 || valor === 0) return corBase;
  
  const intensidade = valor / maxValor;
  
  if (intensidade < 0.25) return '#22c55e'; // Verde
  if (intensidade < 0.5) return '#eab308';  // Amarelo
  if (intensidade < 0.75) return '#f97316'; // Laranja
  return '#ef4444'; // Vermelho
}

/**
 * Gera cor para modo de votos (azul claro → azul escuro)
 */
function getCorVotos(valor: number, maxValor: number): string {
  if (maxValor === 0 || valor === 0) return '#e0e7ff'; // Azul muito claro (sem dados)
  
  const intensidade = valor / maxValor;
  
  if (intensidade < 0.2) return '#c7d2fe';  // Azul bem claro
  if (intensidade < 0.4) return '#a5b4fc';  // Azul claro
  if (intensidade < 0.6) return '#818cf8';  // Azul médio
  if (intensidade < 0.8) return '#6366f1';  // Azul
  return '#4f46e5'; // Azul escuro
}

/**
 * Gera cor para modo comparativo (votos vs atendimento)
 * - Verde: Mais atendimento que votos (proporcionalmente)
 * - Amarelo: Equilibrado
 * - Vermelho: Mais votos que atendimento (oportunidade)
 */
function getCorComparativo(
  votos: number, 
  atendimento: number, 
  maxVotos: number, 
  maxAtendimento: number
): string {
  if (maxVotos === 0 || maxAtendimento === 0) return '#94a3b8'; // Cinza
  if (votos === 0 && atendimento === 0) return '#e2e8f0'; // Cinza claro
  
  // Normalizar valores
  const votosNorm = votos / maxVotos;
  const atendNorm = atendimento / maxAtendimento;
  
  // Calcular diferença
  const diff = votosNorm - atendNorm;
  
  if (diff > 0.3) return '#ef4444';   // Vermelho: muito mais votos que atendimento
  if (diff > 0.1) return '#f97316';   // Laranja: mais votos que atendimento
  if (diff > -0.1) return '#eab308';  // Amarelo: equilibrado
  if (diff > -0.3) return '#84cc16';  // Verde claro: mais atendimento que votos
  return '#22c55e';                    // Verde: muito mais atendimento que votos
}

// =============================================
// COMPONENTE
// =============================================

export function GeoJSONLayer({ 
  data, 
  cor = '#3B82F6', 
  opacidade = 0.3,
  nome,
  mostrarLabels = false,
  onFeatureClick,
  onFeatureHover,
  estatisticas,
  votosPorRegiao,
  totalEleitoresPorRegiao,
  modoVisualizacao = 'padrao',
  tipoFiltro = 'todos',
  colorirPorDensidade = false // Legacy support
}: GeoJSONLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const hasZoomedRef = useRef<boolean>(false);

  // Determinar modo efetivo (legacy support)
  const modoEfetivo: ModoVisualizacao = colorirPorDensidade && modoVisualizacao === 'padrao' 
    ? 'atendimento' 
    : modoVisualizacao;

  useEffect(() => {
    if (!data || !data.features || data.features.length === 0) return;

    // Função auxiliar para calcular atendimento baseado no tipoFiltro
    const calcularAtendimento = (stats: { demandas: number; municipes: number } | undefined): number => {
      if (!stats) return 0;
      switch (tipoFiltro) {
        case 'demandas':
          return stats.demandas;
        case 'municipes':
          return stats.municipes;
        default:
          return stats.demandas + stats.municipes;
      }
    };

    // Calcular valores máximos para cada modo
    let maxAtendimento = 0;
    let maxVotos = 0;

    if (estatisticas) {
      estatisticas.forEach((stats) => {
        const total = calcularAtendimento(stats);
        if (total > maxAtendimento) maxAtendimento = total;
      });
    }

    if (votosPorRegiao) {
      votosPorRegiao.forEach((votos) => {
        if (votos > maxVotos) maxVotos = votos;
      });
    }

    // =============================================
    // CÁLCULOS PARA O TOOLTIP AVANÇADO
    // =============================================
    
    // Total geral de votos do candidato
    let totalVotosCandidato = 0;
    if (votosPorRegiao) {
      votosPorRegiao.forEach((votos) => {
        totalVotosCandidato += votos;
      });
    }

    // Total geral de eleitores (todas as regiões)
    let totalEleitoresGeral = 0;
    if (totalEleitoresPorRegiao) {
      totalEleitoresPorRegiao.forEach((eleitores) => {
        totalEleitoresGeral += eleitores;
      });
    }

    // Preparar dados para rankings
    interface DadosRegiao {
      nome: string;
      votos: number;
      eleitores: number;
      percentualSobreTotalEleitores: number;  // votos / total eleitores geral
      percentualSobreEleitoresRegiao: number; // votos / eleitores da região
      percentualSobreTotalVotos: number;      // votos / total votos candidato
    }

    const dadosRegioes: DadosRegiao[] = [];

    // Coletar dados de todas as features
    data.features.forEach((feature: any) => {
      const featureName = getFeatureName(feature.properties);
      const votos = votosPorRegiao?.get(featureName) || 0;
      const eleitores = totalEleitoresPorRegiao?.get(featureName) || 0;

      const percentualSobreTotalEleitores = totalEleitoresGeral > 0 
        ? (votos / totalEleitoresGeral) * 100 
        : 0;
      
      const percentualSobreEleitoresRegiao = eleitores > 0 
        ? (votos / eleitores) * 100 
        : 0;
      
      const percentualSobreTotalVotos = totalVotosCandidato > 0 
        ? (votos / totalVotosCandidato) * 100 
        : 0;

      dadosRegioes.push({
        nome: featureName,
        votos,
        eleitores,
        percentualSobreTotalEleitores,
        percentualSobreEleitoresRegiao,
        percentualSobreTotalVotos
      });
    });

    // Calcular rankings (ordenar do maior para menor)
    const rankingSobreTotalEleitores = [...dadosRegioes]
      .sort((a, b) => b.percentualSobreTotalEleitores - a.percentualSobreTotalEleitores)
      .map((d, i) => ({ nome: d.nome, ranking: i + 1 }));

    const rankingSobreEleitoresRegiao = [...dadosRegioes]
      .sort((a, b) => b.percentualSobreEleitoresRegiao - a.percentualSobreEleitoresRegiao)
      .map((d, i) => ({ nome: d.nome, ranking: i + 1 }));

    const rankingSobreTotalVotos = [...dadosRegioes]
      .sort((a, b) => b.percentualSobreTotalVotos - a.percentualSobreTotalVotos)
      .map((d, i) => ({ nome: d.nome, ranking: i + 1 }));

    // Função para obter ranking de uma região
    const getRanking = (nome: string, rankingList: { nome: string; ranking: number }[]): number => {
      const found = rankingList.find(r => r.nome === nome);
      return found ? found.ranking : 0;
    };

    // Função para formatar posição do ranking
    const formatarRanking = (posicao: number): string => {
      return `${posicao}º`;
    };

    // Criar camada GeoJSON
    const layer = L.geoJSON(data, {
      style: (feature) => {
        const featureName = getFeatureName(feature?.properties);
        let fillColor = cor;
        
        // Obter dados para esta feature
        const stats = estatisticas?.get(featureName);
        const votos = votosPorRegiao?.get(featureName) || 0;
        const atendimento = calcularAtendimento(stats);
        
        // Determinar cor baseada no modo
        switch (modoEfetivo) {
          case 'atendimento':
            fillColor = getCorAtendimento(atendimento, maxAtendimento, cor);
            break;
            
          case 'votos':
            fillColor = getCorVotos(votos, maxVotos);
            break;
            
          case 'comparativo':
            fillColor = getCorComparativo(votos, atendimento, maxVotos, maxAtendimento);
            break;
            
          default:
            fillColor = cor;
        }
        
        return {
          color: cor,
          weight: 2,
          fillColor: fillColor,
          fillOpacity: opacidade,
          opacity: 0.8
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const featureName = getFeatureName(feature.properties);
        
        // Obter dados para tooltip
        const stats = estatisticas?.get(featureName);
        const votos = votosPorRegiao?.get(featureName) || 0;
        const eleitores = totalEleitoresPorRegiao?.get(featureName) || 0;
        const atendimento = calcularAtendimento(stats);
        
        // Obter dados calculados da região
        const dadosRegiao = dadosRegioes.find(d => d.nome === featureName);
        
        // Construir conteúdo do tooltip
        let tooltipContent = `<div style="min-width: 220px;">`;
        tooltipContent += `<strong style="font-size: 14px; border-bottom: 1px solid #ddd; display: block; padding-bottom: 4px; margin-bottom: 6px;">${featureName}</strong>`;
        
        // Seção: Atendimento
        tooltipContent += `<div style="margin-bottom: 6px;">`;
        tooltipContent += `<span style="color: #666; font-size: 10px; text-transform: uppercase;">Atendimento</span><br/>`;
        tooltipContent += `👥 Munícipes: <strong>${stats?.municipes || 0}</strong><br/>`;
        tooltipContent += `📋 Demandas: <strong>${stats?.demandas || 0}</strong>`;
        tooltipContent += `</div>`;
        
        // Seção: Dados Eleitorais
        tooltipContent += `<div style="margin-bottom: 6px; padding-top: 6px; border-top: 1px solid #eee;">`;
        tooltipContent += `<span style="color: #666; font-size: 10px; text-transform: uppercase;">Dados Eleitorais</span><br/>`;
        tooltipContent += `🗳️ Votos: <strong>${votos.toLocaleString('pt-BR')}</strong><br/>`;
        tooltipContent += `👤 Eleitores: <strong>${eleitores.toLocaleString('pt-BR')}</strong>`;
        tooltipContent += `</div>`;
        
        // Seção: Percentuais e Rankings (apenas se houver votos)
        if (dadosRegiao && (totalVotosCandidato > 0 || totalEleitoresGeral > 0)) {
          tooltipContent += `<div style="padding-top: 6px; border-top: 1px solid #eee;">`;
          tooltipContent += `<span style="color: #666; font-size: 10px; text-transform: uppercase;">Análise</span><br/>`;
          
          // % sobre total de eleitores (geral)
          if (totalEleitoresGeral > 0) {
            const pctTotalEleitores = dadosRegiao.percentualSobreTotalEleitores;
            const rankTotalEleitores = getRanking(featureName, rankingSobreTotalEleitores);
            tooltipContent += `<span title="Votos / Total de Eleitores (todas regiões)">`;
            tooltipContent += `📊 % Eleitorado: <strong>${pctTotalEleitores.toFixed(2)}%</strong> `;
            tooltipContent += `<span style="background: #e0e7ff; color: #4f46e5; padding: 1px 4px; border-radius: 3px; font-size: 10px;">${formatarRanking(rankTotalEleitores)}</span>`;
            tooltipContent += `</span><br/>`;
          }
          
          // % sobre eleitores da região
          if (eleitores > 0) {
            const pctEleitoresRegiao = dadosRegiao.percentualSobreEleitoresRegiao;
            const rankEleitoresRegiao = getRanking(featureName, rankingSobreEleitoresRegiao);
            tooltipContent += `<span title="Votos / Eleitores desta região">`;
            tooltipContent += `🎯 % na Região: <strong>${pctEleitoresRegiao.toFixed(2)}%</strong> `;
            tooltipContent += `<span style="background: #dcfce7; color: #166534; padding: 1px 4px; border-radius: 3px; font-size: 10px;">${formatarRanking(rankEleitoresRegiao)}</span>`;
            tooltipContent += `</span><br/>`;
          }
          
          // % sobre total de votos do candidato
          if (totalVotosCandidato > 0) {
            const pctTotalVotos = dadosRegiao.percentualSobreTotalVotos;
            const rankTotalVotos = getRanking(featureName, rankingSobreTotalVotos);
            tooltipContent += `<span title="Votos da região / Total de votos do candidato">`;
            tooltipContent += `🏆 % Votação: <strong>${pctTotalVotos.toFixed(2)}%</strong> `;
            tooltipContent += `<span style="background: #fef3c7; color: #92400e; padding: 1px 4px; border-radius: 3px; font-size: 10px;">${formatarRanking(rankTotalVotos)}</span>`;
            tooltipContent += `</span>`;
          }
          
          tooltipContent += `</div>`;
        }
        
        // Indicador de oportunidade no modo comparativo
        if (modoEfetivo === 'comparativo' && votos > 0) {
          tooltipContent += `<div style="padding-top: 6px; border-top: 1px solid #eee;">`;
          if (atendimento === 0) {
            tooltipContent += `<span style="color: #ef4444; font-weight: bold;">⚠️ Sem atendimentos - Oportunidade!</span>`;
          } else {
            const ratio = votos / atendimento;
            if (ratio > 10) {
              tooltipContent += `<span style="color: #f97316;">💡 ${Math.round(ratio)}x mais votos que atendimentos</span>`;
            } else if (ratio > 5) {
              tooltipContent += `<span style="color: #eab308;">📈 ${Math.round(ratio)}x mais votos que atendimentos</span>`;
            }
          }
          tooltipContent += `</div>`;
        }
        
        tooltipContent += `</div>`;
        
        // Adicionar tooltip
        featureLayer.bindTooltip(tooltipContent, {
          permanent: mostrarLabels,
          direction: 'auto',
          className: 'leaflet-tooltip-custom',
          sticky: true
        });

        // Evento de clique
        featureLayer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (onFeatureClick) {
            onFeatureClick(feature, featureName);
          }
        });

        // Hover effects
        featureLayer.on('mouseover', () => {
          (featureLayer as any).setStyle({
            weight: 3,
            fillOpacity: Math.min(opacidade + 0.2, 0.8)
          });
          
          if (onFeatureHover) {
            onFeatureHover(feature, featureName);
          }
        });

        featureLayer.on('mouseout', () => {
          (featureLayer as any).setStyle({
            weight: 2,
            fillOpacity: opacidade
          });
          
          if (onFeatureHover) {
            onFeatureHover(null, null);
          }
        });
      }
    });

    layer.addTo(map);
    layerRef.current = layer;

    // Fazer zoom para a camada na primeira vez
    if (!hasZoomedRef.current) {
      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
          hasZoomedRef.current = true;
        }
      } catch (e) {
        console.warn('Não foi possível fazer zoom para a camada:', e);
      }
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [data, cor, opacidade, map, mostrarLabels, onFeatureClick, onFeatureHover, estatisticas, votosPorRegiao, totalEleitoresPorRegiao, modoEfetivo, tipoFiltro]);

  return null;
}

// Exportar função auxiliar para uso externo
export { getFeatureName };
