/**
 * Utilitários geoespaciais sem dependências externas
 * Implementa algoritmo de ray-casting para verificar ponto em polígono
 */

/**
 * Verifica se um ponto está dentro de um polígono usando ray-casting
 */
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Extrai coordenadas de uma feature GeoJSON
 */
function getPolygonCoordinates(feature: any): number[][][] {
  if (!feature?.geometry) return [];
  
  const { type, coordinates } = feature.geometry;
  
  if (type === 'Polygon') {
    return coordinates;
  } else if (type === 'MultiPolygon') {
    // Flatten MultiPolygon para array de polígonos
    return coordinates.flat();
  }
  
  return [];
}

/**
 * Verifica se um ponto está dentro de um polígono/feature GeoJSON
 */
export function pontoNaRegiao(
  latitude: number,
  longitude: number,
  feature: any
): boolean {
  try {
    const polygons = getPolygonCoordinates(feature);
    const point: [number, number] = [longitude, latitude];
    
    for (const polygon of polygons) {
      if (pointInPolygon(point, polygon)) {
        return true;
      }
    }
    
    return false;
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
 * Calcula o centro (centróide) de um polígono
 */
export function getCentroRegiao(feature: any): [number, number] | null {
  try {
    const polygons = getPolygonCoordinates(feature);
    if (polygons.length === 0) return null;
    
    const polygon = polygons[0]; // Usar primeiro polígono
    let sumX = 0;
    let sumY = 0;
    const n = polygon.length;
    
    for (const coord of polygon) {
      sumX += coord[0];
      sumY += coord[1];
    }
    
    return [sumY / n, sumX / n]; // [lat, lng] para Leaflet
  } catch (error) {
    console.error('Erro ao calcular centro da região:', error);
    return null;
  }
}

/**
 * Obtém o bounding box de um GeoJSON
 */
export function getBoundingBox(geojson: any): [[number, number], [number, number]] | null {
  try {
    if (!geojson?.features) return null;
    
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    
    for (const feature of geojson.features) {
      const polygons = getPolygonCoordinates(feature);
      
      for (const polygon of polygons) {
        for (const coord of polygon) {
          const lng = coord[0];
          const lat = coord[1];
          
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }
    }
    
    if (minLat === Infinity) return null;
    
    return [
      [minLat, minLng],
      [maxLat, maxLng]
    ];
  } catch (error) {
    console.error('Erro ao calcular bounding box:', error);
    return null;
  }
}
