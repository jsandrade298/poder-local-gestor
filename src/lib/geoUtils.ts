import * as turf from '@turf/turf';

/**
 * Verifica se um ponto está dentro de um polígono
 */
export function pontoNaRegiao(
  latitude: number,
  longitude: number,
  feature: any
): boolean {
  try {
    const ponto = turf.point([longitude, latitude]);
    return turf.booleanPointInPolygon(ponto, feature);
  } catch (error) {
    console.error('Erro ao verificar ponto na região:', error);
    return false;
  }
}

/**
 * Obtém o nome da feature das propriedades
 */
export function getFeatureName(properties: any): string {
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
}

/**
 * Calcula estatísticas de demandas e munícipes por região
 */
export function calcularEstatisticasPorRegiao(
  geojson: any,
  demandas: Array<{ latitude?: number | null; longitude?: number | null }>,
  municipes: Array<{ latitude?: number | null; longitude?: number | null }>
): Map<string, { demandas: number; municipes: number }> {
  const estatisticas = new Map<string, { demandas: number; municipes: number }>();

  if (!geojson?.features) return estatisticas;

  // Inicializar estatísticas para cada feature
  for (const feature of geojson.features) {
    const nome = getFeatureName(feature.properties);
    estatisticas.set(nome, { demandas: 0, municipes: 0 });
  }

  // Contar demandas por região
  for (const demanda of demandas) {
    if (!demanda.latitude || !demanda.longitude) continue;

    for (const feature of geojson.features) {
      if (pontoNaRegiao(demanda.latitude, demanda.longitude, feature)) {
        const nome = getFeatureName(feature.properties);
        const stats = estatisticas.get(nome);
        if (stats) {
          stats.demandas++;
        }
        break; // Ponto só pode estar em uma região
      }
    }
  }

  // Contar munícipes por região
  for (const municipe of municipes) {
    if (!municipe.latitude || !municipe.longitude) continue;

    for (const feature of geojson.features) {
      if (pontoNaRegiao(municipe.latitude, municipe.longitude, feature)) {
        const nome = getFeatureName(feature.properties);
        const stats = estatisticas.get(nome);
        if (stats) {
          stats.municipes++;
        }
        break; // Ponto só pode estar em uma região
      }
    }
  }

  return estatisticas;
}

/**
 * Filtra demandas/munícipes que estão dentro de uma região específica
 */
export function filtrarPorRegiao<T extends { latitude?: number | null; longitude?: number | null }>(
  items: T[],
  feature: any
): T[] {
  return items.filter(item => {
    if (!item.latitude || !item.longitude) return false;
    return pontoNaRegiao(item.latitude, item.longitude, feature);
  });
}

/**
 * Calcula o centro de um polígono/feature
 */
export function getCentroRegiao(feature: any): [number, number] | null {
  try {
    const centroid = turf.centroid(feature);
    const coords = centroid.geometry.coordinates;
    return [coords[1], coords[0]]; // [lat, lng] para Leaflet
  } catch (error) {
    console.error('Erro ao calcular centro da região:', error);
    return null;
  }
}

/**
 * Calcula a área de uma região em km²
 */
export function getAreaRegiao(feature: any): number {
  try {
    const area = turf.area(feature);
    return area / 1000000; // Converter m² para km²
  } catch (error) {
    console.error('Erro ao calcular área da região:', error);
    return 0;
  }
}

/**
 * Obtém o bounding box de um GeoJSON
 */
export function getBoundingBox(geojson: any): [[number, number], [number, number]] | null {
  try {
    const bbox = turf.bbox(geojson);
    // bbox retorna [minX, minY, maxX, maxY] = [minLng, minLat, maxLng, maxLat]
    return [
      [bbox[1], bbox[0]], // [minLat, minLng]
      [bbox[3], bbox[2]]  // [maxLat, maxLng]
    ];
  } catch (error) {
    console.error('Erro ao calcular bounding box:', error);
    return null;
  }
}
