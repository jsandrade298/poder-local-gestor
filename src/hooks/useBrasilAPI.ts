import { useState, useCallback } from 'react';

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

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export interface EnderecoCompleto {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
  fonteGeo: 'brasilapi' | 'nominatim' | null;
}

interface UseBrasilAPIReturn {
  buscarCep: (cep: string) => Promise<EnderecoCompleto | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap)
 */
async function geocodificarComNominatim(
  logradouro: string,
  bairro: string,
  cidade: string,
  estado: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Montar endereço completo para busca
    const partes = [logradouro, bairro, cidade, estado, 'Brasil'].filter(Boolean);
    const enderecoCompleto = partes.join(', ');
    
    console.log('Geocodificando com Nominatim:', enderecoCompleto);
    
    const encodedAddress = encodeURIComponent(enderecoCompleto);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PoderLocalGestor/1.0 (Sistema de Gestão de Gabinete)'
      }
    });

    if (!response.ok) {
      console.error('Erro na requisição Nominatim:', response.status);
      return null;
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      console.log('Nominatim não encontrou resultados');
      
      // Tentar busca mais simples (só cidade e estado)
      const buscaSimples = `${cidade}, ${estado}, Brasil`;
      console.log('Tentando busca simplificada:', buscaSimples);
      
      const response2 = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(buscaSimples)}&limit=1&countrycodes=br`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PoderLocalGestor/1.0 (Sistema de Gestão de Gabinete)'
          }
        }
      );
      
      if (response2.ok) {
        const data2: NominatimResponse[] = await response2.json();
        if (data2.length > 0) {
          const lat = parseFloat(data2[0].lat);
          const lon = parseFloat(data2[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            console.log('Nominatim (busca simples) encontrou:', lat, lon);
            return { latitude: lat, longitude: lon };
          }
        }
      }
      
      return null;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    
    if (!isNaN(lat) && !isNaN(lon)) {
      console.log('Nominatim encontrou:', lat, lon);
      return { latitude: lat, longitude: lon };
    }

    return null;
  } catch (err) {
    console.error('Erro no Nominatim:', err);
    return null;
  }
}

/**
 * Hook para consultar CEP usando BrasilAPI + fallback Nominatim
 * 
 * Fluxo:
 * 1. Busca CEP na BrasilAPI (preenche endereço)
 * 2. Se BrasilAPI tiver coordenadas, usa elas
 * 3. Se não tiver, chama Nominatim com o endereço completo
 */
export function useBrasilAPI(): UseBrasilAPIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCep = useCallback(async (cep: string): Promise<EnderecoCompleto | null> => {
    // Limpar CEP
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

      // Dados do endereço
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

      // ========== PASSO 2: Verificar se BrasilAPI retornou coordenadas ==========
      if (data.location?.coordinates) {
        const lat = parseFloat(data.location.coordinates.latitude);
        const lng = parseFloat(data.location.coordinates.longitude);
        
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          endereco.latitude = lat;
          endereco.longitude = lng;
          endereco.fonteGeo = 'brasilapi';
          console.log('Coordenadas obtidas da BrasilAPI:', lat, lng);
          return endereco;
        }
      }

      // ========== PASSO 3: Fallback para Nominatim ==========
      console.log('BrasilAPI não retornou coordenadas, tentando Nominatim...');
      
      // Pequena pausa para respeitar rate limit do Nominatim
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
