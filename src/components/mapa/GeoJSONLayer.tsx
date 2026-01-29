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
        const atendimento = calcularAtendimento(stats);
        
        // Construir conteúdo do tooltip
        let tooltipContent = `<strong>${featureName}</strong>`;
        
        if (votos > 0) {
          tooltipContent += `<br/>🗳️ ${votos.toLocaleString('pt-BR')} votos`;
        }
        
        if (stats) {
          // Mostrar apenas os dados relevantes ao filtro
          if (tipoFiltro === 'todos' || tipoFiltro === 'demandas') {
            tooltipContent += `<br/>📋 ${stats.demandas} demanda(s)`;
          }
          if (tipoFiltro === 'todos' || tipoFiltro === 'municipes') {
            tooltipContent += `<br/>👥 ${stats.municipes} munícipe(s)`;
          }
        }
        
        // Adicionar indicador de oportunidade no modo comparativo
        if (modoEfetivo === 'comparativo' && votos > 0) {
          if (votos > 0 && atendimento === 0) {
            tooltipContent += `<br/><span style="color: #ef4444">⚠️ Sem atendimentos</span>`;
          } else if (atendimento > 0) {
            const ratio = votos / atendimento;
            if (ratio > 10) {
              tooltipContent += `<br/><span style="color: #f97316">💡 ${Math.round(ratio)}x mais votos</span>`;
            }
          }
        }
        
        // Adicionar tooltip
        featureLayer.bindTooltip(tooltipContent, {
          permanent: mostrarLabels,
          direction: 'center',
          className: 'leaflet-tooltip-custom'
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
  }, [data, cor, opacidade, map, mostrarLabels, onFeatureClick, onFeatureHover, estatisticas, votosPorRegiao, modoEfetivo, tipoFiltro]);

  return null;
}

// Exportar função auxiliar para uso externo
export { getFeatureName };
