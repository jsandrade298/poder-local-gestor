import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { DemandaMapa, AreaMapa } from '@/hooks/useMapaUnificado';

// =============================================
// TIPOS E INTERFACES
// =============================================

export type ModoVisualizacao = 
  | 'padrao'           // Cor sólida
  | 'resolutividade'   // Taxa de sucesso (Atendidas / Total)
  | 'votos'            // Densidade de votos
  | 'comparativo'      // Votos vs Demandas
  | 'predominancia';   // Cor da área com mais demandas

interface GeoJSONLayerProps {
  data: any;
  cor?: string;
  opacidade?: number;
  nome?: string;
  mostrarLabels?: boolean;
  onFeatureClick?: (feature: any, nome: string) => void;
  onFeatureHover?: (feature: any | null, nome: string | null) => void;
  
  // DADOS NECESSÁRIOS PARA OS CÁLCULOS
  demandas: DemandaMapa[]; // Necessário para calcular predominância e resolutividade localmente
  areas: AreaMapa[];       // Necessário para buscar as cores das áreas
  
  // Estatísticas pré-calculadas (mantido para compatibilidade/performance em modos simples)
  estatisticas?: Map<string, { demandas: number; municipes: number }>;
  
  // Dados de votação
  votosPorRegiao?: Map<string, number>;
  totalEleitoresPorRegiao?: Map<string, number>;
  
  // Configuração
  modoVisualizacao?: ModoVisualizacao;
  tipoFiltro?: 'todos' | 'demandas' | 'municipes' | 'nenhum';
  colorirPorDensidade?: boolean; // Legacy
}

// =============================================
// FUNÇÕES AUXILIARES DE CORES E LÓGICA
// =============================================

/**
 * Obtém o nome da feature (bairro/região) das propriedades do GeoJSON
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
      return String(properties[campo]).trim();
    }
  }
  
  return 'Sem nome';
};

/**
 * Calcula cor baseada na Taxa de Resolutividade (Semáforo)
 */
function getCorResolutividade(demandasDaRegiao: DemandaMapa[]): string {
  if (!demandasDaRegiao || demandasDaRegiao.length === 0) return '#94a3b8'; // Cinza (sem dados)

  // Consideramos o total de demandas existentes na região
  const totalConsiderado = demandasDaRegiao.length;
  if (totalConsiderado === 0) return '#94a3b8';

  const atendidas = demandasDaRegiao.filter(d => d.status === 'atendido').length;
  const taxa = atendidas / totalConsiderado;

  if (taxa >= 0.8) return '#22c55e'; // Verde (> 80%)
  if (taxa >= 0.5) return '#eab308'; // Amarelo (50-80%)
  return '#ef4444'; // Vermelho (< 50%)
}

/**
 * Calcula cor baseada na Predominância Temática (Área com mais demandas)
 */
function getCorPredominancia(demandasDaRegiao: DemandaMapa[], areas: AreaMapa[]): string {
  if (!demandasDaRegiao || demandasDaRegiao.length === 0) return '#e2e8f0'; // Cinza claro

  // Contar demandas por área
  const contagem: Record<string, number> = {};
  
  demandasDaRegiao.forEach(d => {
    if (d.area_id) {
      contagem[d.area_id] = (contagem[d.area_id] || 0) + 1;
    }
  });

  // Encontrar o ID da área com maior contagem
  let maxAreaId = null;
  let maxCount = 0;

  for (const [areaId, count] of Object.entries(contagem)) {
    if (count > maxCount) {
      maxCount = count;
      maxAreaId = areaId;
    }
  }

  if (!maxAreaId) return '#e2e8f0';

  // Buscar a cor dessa área
  const areaVencedora = areas.find(a => a.id === maxAreaId);
  return areaVencedora?.cor || '#6b7280';
}

/**
 * Calcula cor baseada na densidade de Votos (Escala de Azul)
 */
function getCorVotos(valor: number, maxValor: number): string {
  if (maxValor === 0 || valor === 0) return '#e0e7ff'; // Azul muito claro (sem dados)
  
  const intensidade = valor / maxValor;
  
  if (intensidade < 0.2) return '#c7d2fe';
  if (intensidade < 0.4) return '#a5b4fc';
  if (intensidade < 0.6) return '#818cf8';
  if (intensidade < 0.8) return '#6366f1';
  return '#4f46e5'; // Azul escuro
}

/**
 * Calcula cor Comparativa (Votos x Atendimento)
 */
function getCorComparativo(
  votos: number, 
  atendimento: number, 
  maxVotos: number, 
  maxAtendimento: number
): string {
  if (maxVotos === 0 || maxAtendimento === 0) return '#94a3b8'; // Cinza
  if (votos === 0 && atendimento === 0) return '#e2e8f0'; // Cinza claro
  
  // Normalizar valores (0 a 1)
  const votosNorm = votos / maxVotos;
  const atendNorm = atendimento / maxAtendimento;
  
  // Calcular diferença
  const diff = votosNorm - atendNorm;
  
  if (diff > 0.3) return '#ef4444';   // Vermelho: Muito mais votos que atendimento (Risco)
  if (diff > 0.1) return '#f97316';   // Laranja: Mais votos
  if (diff > -0.1) return '#eab308';  // Amarelo: Equilibrado
  if (diff > -0.3) return '#84cc16';  // Verde claro: Mais atendimento
  return '#22c55e';                    // Verde: Muito mais atendimento (Confortável)
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================

export function GeoJSONLayer({ 
  data, 
  cor = '#3B82F6', 
  opacidade = 0.3,
  mostrarLabels = false,
  onFeatureClick,
  onFeatureHover,
  estatisticas,
  votosPorRegiao,
  totalEleitoresPorRegiao,
  modoVisualizacao = 'padrao',
  tipoFiltro = 'todos',
  colorirPorDensidade = false,
  demandas,
  areas
}: GeoJSONLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const hasZoomedRef = useRef<boolean>(false);

  // Lógica de compatibilidade para o toggle antigo de "Densidade"
  // Se o usuário ativar "colorirPorDensidade" mas estiver no modo "padrao", forçamos "resolutividade"
  const modoEfetivo: ModoVisualizacao = colorirPorDensidade && modoVisualizacao === 'padrao' 
    ? 'resolutividade' 
    : modoVisualizacao;

  useEffect(() => {
    if (!data || !data.features || data.features.length === 0) return;

    // Calcular máximos globais para normalização (Votos e Comparativo)
    let maxVotos = 0;
    let maxAtendimento = 0;

    if (votosPorRegiao) {
      votosPorRegiao.forEach(v => { if (v > maxVotos) maxVotos = v; });
    }
    if (estatisticas) {
      estatisticas.forEach(s => { 
        const total = s.demandas + s.municipes;
        if (total > maxAtendimento) maxAtendimento = total; 
      });
    }

    // Criar camada GeoJSON
    const layer = L.geoJSON(data, {
      style: (feature) => {
        const featureName = getFeatureName(feature?.properties);
        let fillColor = cor;
        
        // Dados gerais da região
        const votos = votosPorRegiao?.get(featureName) || 0;
        const stats = estatisticas?.get(featureName);
        const totalAtendimentos = (stats?.demandas || 0) + (stats?.municipes || 0);

        // Filtrar demandas desta região específica (para cálculos de Resolutividade e Predominância)
        // O filtro é feito comparando o nome do bairro/região normalizado
        const demandasRegiao = (modoEfetivo === 'resolutividade' || modoEfetivo === 'predominancia')
          ? demandas.filter(d => 
              d.bairro && d.bairro.toLowerCase().trim() === featureName.toLowerCase().trim()
            )
          : [];

        // Aplicar a lógica de cor baseada no modo selecionado
        switch (modoEfetivo) {
          case 'resolutividade':
            fillColor = getCorResolutividade(demandasRegiao);
            break;
            
          case 'predominancia':
            fillColor = getCorPredominancia(demandasRegiao, areas);
            break;
            
          case 'votos':
            fillColor = getCorVotos(votos, maxVotos);
            break;
            
          case 'comparativo':
            fillColor = getCorComparativo(votos, totalAtendimentos, maxVotos, maxAtendimento);
            break;
            
          default:
            fillColor = cor;
        }
        
        return {
          color: '#334155', // Cor da borda (Slate-700)
          weight: 1,        // Espessura da borda
          fillColor: fillColor,
          fillOpacity: modoEfetivo === 'padrao' ? opacidade : 0.6, // Mais opaco nos modos coloridos para melhor visibilidade
          opacity: 1
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const featureName = getFeatureName(feature.properties);
        
        // Preparar conteúdo do Tooltip (hover)
        const stats = estatisticas?.get(featureName);
        const votos = votosPorRegiao?.get(featureName) || 0;
        
        let tooltipContent = `<div class="font-sans text-xs">`;
        tooltipContent += `<strong class="block mb-1 text-sm">${featureName}</strong>`;
        
        if (modoEfetivo === 'resolutividade') {
           // Calcular dados específicos para o tooltip
           const demandasRegiao = demandas.filter(d => 
              d.bairro && d.bairro.toLowerCase().trim() === featureName.toLowerCase().trim()
           );
           const resolvidas = demandasRegiao.filter(d => d.status === 'atendido').length;
           const total = demandasRegiao.length;
           const pct = total > 0 ? Math.round((resolvidas/total)*100) : 0;
           
           tooltipContent += `<div>Eficiência: <strong>${pct}%</strong></div>`;
           tooltipContent += `<div class="text-[10px] text-gray-600">Resolvidas: ${resolvidas}/${total}</div>`;
        
        } else if (modoEfetivo === 'predominancia') {
           const demandasRegiao = demandas.filter(d => 
              d.bairro && d.bairro.toLowerCase().trim() === featureName.toLowerCase().trim()
           );
           
           // Encontrar área predominante para exibir o nome
           const contagem: Record<string, number> = {};
           demandasRegiao.forEach(d => { 
             if(d.area_nome) contagem[d.area_nome] = (contagem[d.area_nome] || 0) + 1; 
           });
           
           const sortedAreas = Object.entries(contagem).sort((a,b) => b[1] - a[1]);
           const topAreaNome = sortedAreas.length > 0 ? sortedAreas[0][0] : 'N/A';
           const topAreaCount = sortedAreas.length > 0 ? sortedAreas[0][1] : 0;
           
           tooltipContent += `<div>Dominante: <strong>${topAreaNome}</strong></div>`;
           tooltipContent += `<div class="text-[10px] text-gray-600">${topAreaCount} demandas</div>`;
           
        } else {
           // Modos numéricos padrão (Votos ou Padrão)
           tooltipContent += `<div>Demandas: <strong>${stats?.demandas || 0}</strong></div>`;
           if (votos > 0) {
             tooltipContent += `<div>Votos: <strong>${votos.toLocaleString('pt-BR')}</strong></div>`;
           }
        }
        
        tooltipContent += `<div class="mt-1 text-[10px] text-gray-500 italic border-t pt-1">Clique para detalhes</div>`;
        tooltipContent += `</div>`;

        // Vincular tooltip
        featureLayer.bindTooltip(tooltipContent, {
          permanent: mostrarLabels,
          direction: 'auto',
          className: 'custom-leaflet-tooltip bg-white border border-gray-200 shadow-md rounded px-2 py-1',
          sticky: true
        });

        // Eventos de mouse
        featureLayer.on('click', (e) => {
          L.DomEvent.stopPropagation(e); // Evita clique no mapa abaixo
          if (onFeatureClick) onFeatureClick(feature, featureName);
        });

        featureLayer.on('mouseover', () => {
          // Destacar ao passar o mouse
          (featureLayer as any).setStyle({ 
            weight: 3, 
            fillOpacity: 0.8 
          });
          if (onFeatureHover) onFeatureHover(feature, featureName);
        });

        featureLayer.on('mouseout', () => {
          // Restaurar estilo original
          (featureLayer as any).setStyle({ 
            weight: 1, 
            fillOpacity: modoEfetivo === 'padrao' ? opacidade : 0.6 
          });
          if (onFeatureHover) onFeatureHover(null, null);
        });
      }
    });

    layer.addTo(map);
    layerRef.current = layer;

    // Zoom automático na primeira carga (se houver dados válidos)
    if (!hasZoomedRef.current) {
      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
          hasZoomedRef.current = true;
        }
      } catch (e) {
        console.warn('Erro ao ajustar zoom da camada:', e);
      }
    }

    // Cleanup: remover camada ao desmontar ou atualizar dados
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [data, cor, opacidade, map, mostrarLabels, onFeatureClick, onFeatureHover, estatisticas, votosPorRegiao, totalEleitoresPorRegiao, modoEfetivo, tipoFiltro, demandas, areas]);

  return null;
}

// Exportar função auxiliar para uso externo em outros componentes
export { getFeatureName };
