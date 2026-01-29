import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface GeoJSONLayerProps {
  data: any;
  cor?: string;
  opacidade?: number;
  nome?: string;
  mostrarLabels?: boolean;
  onFeatureClick?: (feature: any, nome: string) => void;
  onFeatureHover?: (feature: any | null, nome: string | null) => void;
  estatisticas?: Map<string, { demandas: number; municipes: number }>;
  colorirPorDensidade?: boolean;
}

// Função para obter o nome da feature das propriedades
const getFeatureName = (properties: any): string => {
  // Tentar diferentes campos comuns para nome
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

// Função para calcular cor baseada na densidade
const getCorPorDensidade = (
  valor: number, 
  maxValor: number, 
  corBase: string
): string => {
  if (maxValor === 0) return corBase;
  
  const intensidade = valor / maxValor;
  
  // Gradiente de verde (pouco) para vermelho (muito)
  if (intensidade < 0.25) return '#22c55e'; // Verde
  if (intensidade < 0.5) return '#eab308';  // Amarelo
  if (intensidade < 0.75) return '#f97316'; // Laranja
  return '#ef4444'; // Vermelho
};

export function GeoJSONLayer({ 
  data, 
  cor = '#3B82F6', 
  opacidade = 0.3,
  nome,
  mostrarLabels = false,
  onFeatureClick,
  onFeatureHover,
  estatisticas,
  colorirPorDensidade = false
}: GeoJSONLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data || !data.features) return;

    // Calcular valor máximo para colorir por densidade
    let maxValor = 0;
    if (colorirPorDensidade && estatisticas) {
      estatisticas.forEach((stats) => {
        const total = stats.demandas + stats.municipes;
        if (total > maxValor) maxValor = total;
      });
    }

    // Criar camada GeoJSON
    const layer = L.geoJSON(data, {
      style: (feature) => {
        const featureName = getFeatureName(feature?.properties);
        let fillColor = cor;
        
        // Colorir por densidade se habilitado
        if (colorirPorDensidade && estatisticas) {
          const stats = estatisticas.get(featureName);
          if (stats) {
            const total = stats.demandas + stats.municipes;
            fillColor = getCorPorDensidade(total, maxValor, cor);
          }
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
        
        // Construir conteúdo do tooltip
        let tooltipContent = `<strong>${featureName}</strong>`;
        
        if (estatisticas) {
          const stats = estatisticas.get(featureName);
          if (stats) {
            tooltipContent += `<br/>📋 ${stats.demandas} demanda(s)`;
            tooltipContent += `<br/>👥 ${stats.municipes} munícipe(s)`;
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

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [data, cor, opacidade, map, mostrarLabels, onFeatureClick, onFeatureHover, estatisticas, colorirPorDensidade]);

  return null;
}

// Exportar função auxiliar para uso externo
export { getFeatureName };
