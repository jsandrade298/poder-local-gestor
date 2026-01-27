import { useState, useCallback } from 'react';

// Token do Mapbox
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoianNhbmRyYWRlMjk4IiwiYSI6ImNta3drZXJ4NDAwMnQzZG9oOXFlY2RwNnEifQ.bTCMd8ALMou7GbqApG_ipg';

interface BrasilAPICoordinates {
  longitude: string;
  latitude: string;
}

interface BrasilAPILocation {
  type: string;
  coordinates: BrasilAPICoordinates;
}

interface BrasilAPICepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
  location?: BrasilAPILocation;
}

interface MapboxFeature {
  center: [number, number]; // [longitude, latitude]
  place_name: string;
  relevance: number;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

export interface EnderecoCompleto {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
  fonteGeo: 'brasilapi' | 'mapbox' | 'nominatim' | null;
}

interface UseBrasilAPIReturn {
  buscarCep: (cep: string) => Promise<EnderecoCompleto | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Geocodifica um endereço usando Mapbox (PRINCIPAL)
 * Muito mais preciso que Nominatim para endereços brasileiros
 */
async function geocodificarComMapbox(
  logradouro: string,
  numero: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Montar endereço completo para busca
    const partes = [
      logradouro,
      numero,
      bairro,
      cidade,
      estado,
      'Brasil'
    ].filter(Boolean);
    
    const enderecoCompleto = partes.join(', ');
    console.log('Geocodificando com Mapbox:', enderecoCompleto);
    
    const encodedAddress = encodeURIComponent(enderecoCompleto);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=br&limit=1&types=address,poi,place,neighborhood`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Erro na requisição Mapbox:', response.status);
      return null;
    }

    const data: MapboxResponse = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log('Mapbox encontrou:', latitude, longitude, '| Local:', data.features[0].place_name);
      return { latitude, longitude };
    }

    // Se não encontrou com endereço completo, tenta só com cidade + bairro
    console.log('Mapbox não encontrou endereço completo, tentando cidade + bairro...');
    const buscaSimples = `${bairro}, ${cidade}, ${estado}, Brasil`;
    const encodedSimples = encodeURIComponent(buscaSimples);
    const url2 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedSimples}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=br&limit=1`;

    const response2 = await fetch(url2);
    if (response2.ok) {
      const data2: MapboxResponse = await response2.json();
      if (data2.features && data2.features.length > 0) {
        const [longitude, latitude] = data2.features[0].center;
        console.log('Mapbox (busca simples) encontrou:', latitude, longitude);
        return { latitude, longitude };
      }
    }

    return null;
  } catch (err) {
    console.error('Erro no Mapbox:', err);
    return null;
  }
}

/**
 * Geocodifica um endereço usando Nominatim (FALLBACK)
 */
async function geocodificarComNominatim(
  logradouro: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const partes = [logradouro, bairro, cidade, estado, 'Brasil'].filter(Boolean);
    const enderecoCompleto = partes.join(', ');
    
    console.log('Fallback Nominatim:', enderecoCompleto);
    
    const encodedAddress = encodeURIComponent(enderecoCompleto);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PoderLocalGestor/1.0'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        console.log('Nominatim encontrou:', lat, lon);
        return { latitude: lat, longitude: lon };
      }
    }

    return null;
  } catch (err) {
    console.error('Erro no Nominatim:', err);
    return null;
  }
}

/**
 * Hook para consultar CEP e obter coordenadas
 * 
 * Fluxo:
 * 1. BrasilAPI → preenche endereço + tenta coordenadas
 * 2. Mapbox → geocodificação precisa (PRINCIPAL)
 * 3. Nominatim → fallback se Mapbox falhar
 */
export function useBrasilAPI(): UseBrasilAPIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCep = useCallback(async (cep: string, numero?: string): Promise<EnderecoCompleto | null> => {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ========== PASSO 1: Buscar na BrasilAPI ==========
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('CEP não encontrado');
          return null;
        }
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data: BrasilAPICepResponse = await response.json();

      const endereco: EnderecoCompleto = {
        cep: data.cep,
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || '',
        latitude: null,
        longitude: null,
        fonteGeo: null
      };

      // ========== PASSO 2: Verificar coordenadas da BrasilAPI ==========
      if (data.location?.coordinates) {
        const lat = parseFloat(data.location.coordinates.latitude);
        const lng = parseFloat(data.location.coordinates.longitude);
        
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          endereco.latitude = lat;
          endereco.longitude = lng;
          endereco.fonteGeo = 'brasilapi';
          console.log('✅ Coordenadas da BrasilAPI:', lat, lng);
          return endereco;
        }
      }

      // ========== PASSO 3: Geocodificar com Mapbox (PRINCIPAL) ==========
      console.log('BrasilAPI sem coordenadas, usando Mapbox...');
      
      const coordMapbox = await geocodificarComMapbox(
        endereco.logradouro,
        numero || '',
        endereco.bairro,
        endereco.cidade,
        endereco.estado
      );

      if (coordMapbox) {
        endereco.latitude = coordMapbox.latitude;
        endereco.longitude = coordMapbox.longitude;
        endereco.fonteGeo = 'mapbox';
        console.log('✅ Coordenadas do Mapbox:', coordMapbox.latitude, coordMapbox.longitude);
        return endereco;
      }

      // ========== PASSO 4: Fallback Nominatim ==========
      console.log('Mapbox falhou, tentando Nominatim como fallback...');
      
      await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
      
      const coordNominatim = await geocodificarComNominatim(
        endereco.logradouro,
        endereco.bairro,
        endereco.cidade,
        endereco.estado
      );

      if (coordNominatim) {
        endereco.latitude = coordNominatim.latitude;
        endereco.longitude = coordNominatim.longitude;
        endereco.fonteGeo = 'nominatim';
        console.log('✅ Coordenadas do Nominatim:', coordNominatim.latitude, coordNominatim.longitude);
      } else {
        console.log('❌ Nenhum serviço conseguiu geocodificar');
      }

      return endereco;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar CEP';
      setError(message);
      console.error('Erro na busca de CEP:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    buscarCep,
    isLoading,
    error
  };
}

/**
 * Formata CEP para exibição (00000-000)
 */
export function formatarCep(cep: string): string {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length <= 5) return cepLimpo;
  return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5, 8)}`;
}

/**
 * Valida formato do CEP
 */
export function validarCep(cep: string): boolean {
  const cepLimpo = cep.replace(/\D/g, '');
  return cepLimpo.length === 8;
}
