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

export interface EnderecoCompleto {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
}

interface UseBrasilAPIReturn {
  buscarCep: (cep: string) => Promise<EnderecoCompleto | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para consultar CEP usando a BrasilAPI
 * 
 * Usa a versão V2 que retorna coordenadas geográficas quando disponíveis
 * Documentação: https://brasilapi.com.br/docs#tag/CEP-V2
 */
export function useBrasilAPI(): UseBrasilAPIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCep = useCallback(async (cep: string): Promise<EnderecoCompleto | null> => {
    // Limpar CEP (remover caracteres não numéricos)
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Usar a versão V2 que retorna coordenadas
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('CEP não encontrado');
          return null;
        }
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data: BrasilAPICepResponse = await response.json();

      // Extrair coordenadas se disponíveis
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (data.location?.coordinates) {
        const lat = parseFloat(data.location.coordinates.latitude);
        const lng = parseFloat(data.location.coordinates.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat;
          longitude = lng;
        }
      }

      return {
        cep: data.cep,
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || '',
        latitude,
        longitude
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar CEP';
      setError(message);
      console.error('Erro na BrasilAPI:', err);
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
