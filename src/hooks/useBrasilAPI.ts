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
 * 
 * Estratégias de busca (em ordem):
 * 1. Endereço completo com número
 * 2. Endereço completo sem número
 * 3. Bairro + Cidade
 */
async function geocodificarComMapbox(
  logradouro: string,
  numero: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // ESTRATÉGIA 1: Endereço completo COM número (mais preciso)
    if (numero && numero.trim()) {
      const partesComNumero = [
        `${logradouro}, ${numero}`,
        bairro,
        cidade,
        estado,
        'Brasil'
      ].filter(Boolean);
      
      const enderecoComNumero = partesComNumero.join(', ');
      console.log('Mapbox tentativa 1 (com número):', enderecoComNumero);
      
      const encodedAddress = encodeURIComponent(enderecoComNumero);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=br&limit=1&types=address,poi`;

      const response = await fetch(url);

      if (response.ok) {
        const data: MapboxResponse = await response.json();
        if (data.features && data.features.length > 0) {
          const [longitude, latitude] = data.features[0].center;
          console.log('✅ Mapbox encontrou (com número):', latitude, longitude, '| Local:', data.features[0].place_name);
          return { latitude, longitude };
        }
      }
    }

    // ESTRATÉGIA 2: Endereço completo SEM número
    const partesSemNumero = [
      logradouro,
      bairro,
      cidade,
      estado,
      'Brasil'
    ].filter(Boolean);
    
    const enderecoSemNumero = partesSemNumero.join(', ');
    console.log('Mapbox tentativa 2 (sem número):', enderecoSemNumero);
    
    const encodedAddress2 = encodeURIComponent(enderecoSemNumero);
    const url2 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress2}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=br&limit=1&types=address,place,neighborhood`;

    const response2 = await fetch(url2);

    if (response2.ok) {
      const data2: MapboxResponse = await response2.json();
      if (data2.features && data2.features.length > 0) {
        const [longitude, latitude] = data2.features[0].center;
        console.log('✅ Mapbox encontrou (sem número):', latitude, longitude);
        return { latitude, longitude };
      }
    }

    // ESTRATÉGIA 3: Apenas Bairro + Cidade (fallback)
    console.log('Mapbox tentativa 3 (bairro + cidade)...');
    const buscaSimples = `${bairro}, ${cidade}, ${estado}, Brasil`;
    const encodedSimples = encodeURIComponent(buscaSimples);
    const url3 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedSimples}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=br&limit=1`;

    const response3 = await fetch(url3);
    if (response3.ok) {
      const data3: MapboxResponse = await response3.json();
      if (data3.features && data3.features.length > 0) {
        const [longitude, latitude] = data3.features[0].center;
        console.log('✅ Mapbox encontrou (bairro + cidade):', latitude, longitude);
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
 * Agora inclui o número para maior precisão
 */
async function geocodificarComNominatim(
  logradouro: string,
  numero: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Primeira tentativa: endereço completo com número
    const partesCompletas = [
      numero ? `${logradouro}, ${numero}` : logradouro,
      bairro,
      cidade,
      estado,
      'Brasil'
    ].filter(Boolean);
    
    const enderecoCompleto = partesCompletas.join(', ');
    console.log('Nominatim tentativa 1 (completo):', enderecoCompleto);
    
    const encodedAddress = encodeURIComponent(enderecoCompleto);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PoderLocalGestor/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.log('Nominatim encontrou (completo):', lat, lon);
          return { latitude: lat, longitude: lon };
        }
      }
    }

    // Segunda tentativa: busca estruturada (mais precisa para endereços)
    console.log('Nominatim tentativa 2 (estruturada)...');
    await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit

    const urlEstruturada = `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(numero ? `${numero} ${logradouro}` : logradouro)}&city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(estado)}&country=Brazil&limit=1`;

    const response2 = await fetch(urlEstruturada, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PoderLocalGestor/1.0'
      }
    });

    if (response2.ok) {
      const data2 = await response2.json();
      if (data2.length > 0) {
        const lat = parseFloat(data2[0].lat);
        const lon = parseFloat(data2[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.log('Nominatim encontrou (estruturada):', lat, lon);
          return { latitude: lat, longitude: lon };
        }
      }
    }

    // Terceira tentativa: só logradouro + cidade (fallback)
    console.log('Nominatim tentativa 3 (simplificada)...');
    await new Promise(resolve => setTimeout(resolve, 300));

    const partesSemNumero = [logradouro, cidade, estado, 'Brasil'].filter(Boolean);
    const enderecoSimples = partesSemNumero.join(', ');
    const urlSimples = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoSimples)}&limit=1&countrycodes=br`;

    const response3 = await fetch(urlSimples, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PoderLocalGestor/1.0'
      }
    });

    if (response3.ok) {
      const data3 = await response3.json();
      if (data3.length > 0) {
        const lat = parseFloat(data3[0].lat);
        const lon = parseFloat(data3[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.log('Nominatim encontrou (simplificada):', lat, lon);
          return { latitude: lat, longitude: lon };
        }
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
        numero || '',
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

/**
 * Geocodifica um endereço completo (sem precisar de CEP)
 * Útil para regeocoding de registros existentes
 * 
 * Fluxo:
 * 1. Mapbox (PRINCIPAL) - mais preciso
 * 2. Nominatim (FALLBACK)
 * 
 * @param logradouro - Nome da rua/avenida
 * @param numero - Número do endereço (importante para precisão!)
 * @param bairro - Nome do bairro
 * @param cidade - Nome da cidade
 * @param estado - Sigla do estado (SP, RJ, etc)
 * @returns Coordenadas { latitude, longitude, fonte } ou null
 */
export async function geocodificarEndereco(
  logradouro: string,
  numero: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number; fonte: 'mapbox' | 'nominatim' } | null> {
  // Validar entrada
  if (!cidade && !bairro && !logradouro) {
    console.log('❌ Endereço muito incompleto para geocodificar');
    return null;
  }

  // Tentar Mapbox primeiro (mais preciso)
  const coordMapbox = await geocodificarComMapbox(
    logradouro || '',
    numero || '',
    bairro || '',
    cidade || '',
    estado || ''
  );

  if (coordMapbox) {
    return {
      latitude: coordMapbox.latitude,
      longitude: coordMapbox.longitude,
      fonte: 'mapbox'
    };
  }

  // Fallback para Nominatim
  await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit

  const coordNominatim = await geocodificarComNominatim(
    logradouro || '',
    numero || '',
    bairro || '',
    cidade || '',
    estado || ''
  );

  if (coordNominatim) {
    return {
      latitude: coordNominatim.latitude,
      longitude: coordNominatim.longitude,
      fonte: 'nominatim'
    };
  }

  return null;
}

/**
 * Verifica se as coordenadas são válidas (dentro dos limites do Brasil)
 */
export function validarCoordenadasBrasil(lat: number, lon: number): boolean {
  const BRASIL_BOUNDS = {
    minLat: -33.75,
    maxLat: 5.27,
    minLon: -73.99,
    maxLon: -34.79
  };

  return (
    !isNaN(lat) && !isNaN(lon) &&
    lat >= BRASIL_BOUNDS.minLat &&
    lat <= BRASIL_BOUNDS.maxLat &&
    lon >= BRASIL_BOUNDS.minLon &&
    lon <= BRASIL_BOUNDS.maxLon
  );
}
