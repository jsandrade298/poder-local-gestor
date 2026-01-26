import { useState, useCallback } from 'react';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  confidence: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
}

interface UseGeocodingReturn {
  geocode: (address: string) => Promise<GeocodingResult | null>;
  reverseGeocode: (lat: number, lon: number) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export function useGeocoding(): UseGeocodingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

  const geocode = useCallback(async (address: string): Promise<GeocodingResult | null> => {
    if (!address || address.trim().length < 5) {
      setError('Endereço muito curto para geocodificação');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PoderLocalGestor/1.0 (Sistema de Gestão de Gabinete)'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data: NominatimResponse[] = await response.json();

      if (data.length === 0) {
        setError('Endereço não encontrado');
        return null;
      }

      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        confidence: result.importance
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido na geocodificação';
      setError(message);
      console.error('Erro na geocodificação:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PoderLocalGestor/1.0 (Sistema de Gestão de Gabinete)'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return null;
      }

      return data.display_name || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido na geocodificação reversa';
      setError(message);
      console.error('Erro na geocodificação reversa:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    geocode,
    reverseGeocode,
    isLoading,
    error
  };
}

export function buildFullAddress(
  logradouro?: string | null,
  numero?: string | null,
  bairro?: string | null,
  cidade?: string | null,
  estado?: string | null,
  cep?: string | null
): string {
  const parts: string[] = [];

  if (logradouro) {
    parts.push(logradouro);
    if (numero) {
      parts[parts.length - 1] += `, ${numero}`;
    }
  }

  if (bairro) parts.push(bairro);
  if (cidade) {
    let cidadeEstado = cidade;
    if (estado) cidadeEstado += ` - ${estado}`;
    parts.push(cidadeEstado);
  }
  if (cep) parts.push(cep);

  return parts.join(', ');
}

export function isValidBrazilCoordinates(lat: number, lon: number): boolean {
  const BRAZIL_BOUNDS = {
    minLat: -33.75,
    maxLat: 5.27,
    minLon: -73.99,
    maxLon: -34.79
  };

  return (
    lat >= BRAZIL_BOUNDS.minLat &&
    lat <= BRAZIL_BOUNDS.maxLat &&
    lon >= BRAZIL_BOUNDS.minLon &&
    lon <= BRAZIL_BOUNDS.maxLon
  );
}
