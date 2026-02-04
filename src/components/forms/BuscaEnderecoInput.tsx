import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Navigation, MapPin, Loader2, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnderecoResult {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface BuscaEnderecoInputProps {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  showGeolocation?: boolean;
  label?: string;
  /** Coordenadas para priorizar resultados próximos (opcional) */
  proximity?: { lat: number; lng: number } | null;
}

// Token do Mapbox (mesmo usado em useBrasilAPI.ts)
const MAPBOX_TOKEN = 'pk.eyJ1IjoianNhbmRyYWRlMjk4IiwiYSI6ImNta3drZXJ4NDAwMnQzZG9oOXFlY2RwNnEifQ.bTCMd8ALMou7GbqApG_ipg';

export function BuscaEnderecoInput({
  value,
  onChange,
  placeholder = "Digite um endereço...",
  showGeolocation = true,
  label,
  proximity
}: BuscaEnderecoInputProps) {
  // Estados locais para controle do input
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<EnderecoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar endereços usando Mapbox Geocoding API
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params: Record<string, string> = {
        access_token: MAPBOX_TOKEN,
        country: 'br',
        language: 'pt-BR',
        limit: '8',
        types: 'poi,address,place,locality,neighborhood'
      };
      
      // Adicionar proximidade se fornecida (prioriza resultados próximos)
      if (proximity) {
        params.proximity = `${proximity.lng},${proximity.lat}`;
      }
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` + 
        new URLSearchParams(params)
      );
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.features || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [proximity]);

  // Handler de mudança do input com debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedAddress('');
    
    // Limpar timeout anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Se limpar o campo, limpar o valor
    if (!newValue.trim()) {
      setResults([]);
      setShowResults(false);
      onChange(null);
      return;
    }
    
    // Debounce de 400ms para buscar
    debounceRef.current = setTimeout(() => {
      searchAddress(newValue);
    }, 400);
  }, [searchAddress, onChange]);

  // Selecionar endereço
  const handleSelectAddress = useCallback((result: EnderecoResult) => {
    const coords = {
      lat: result.center[1],
      lng: result.center[0]
    };
    onChange(coords);
    setSelectedAddress(result.place_name);
    setInputValue('');
    setResults([]);
    setShowResults(false);
  }, [onChange]);

  // Obter geolocalização
  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada pelo navegador');
      return;
    }

    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        onChange(coords);
        setSelectedAddress(`📍 Localização atual`);
        setInputValue('');
        setResults([]);
        setShowResults(false);
        setIsGeolocating(false);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        alert('Erro ao obter localização. Verifique as permissões do navegador.');
        setIsGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onChange]);

  // Limpar
  const handleClear = useCallback(() => {
    onChange(null);
    setSelectedAddress('');
    setInputValue('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Fechar dropdown ao clicar fora
  const handleBlur = useCallback(() => {
    // Delay para permitir clique nos resultados
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  }, []);

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder={selectedAddress || placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue.length >= 3 && setShowResults(true)}
            onBlur={handleBlur}
            className={cn(
              "pl-9 pr-8 text-sm",
              value && "border-green-500",
              selectedAddress && !inputValue && "placeholder:text-foreground placeholder:font-medium"
            )}
          />
          {(value || inputValue) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          
          {/* Dropdown de resultados */}
          {showResults && (inputValue.length >= 3 || results.length > 0) && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
              {isSearching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Buscando...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {inputValue.length < 3 
                    ? "Digite ao menos 3 caracteres" 
                    : "Nenhum endereço encontrado"
                  }
                </div>
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  <div className="p-1">
                    {results.map((result, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full flex items-start gap-2 p-2 hover:bg-muted rounded text-left transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Previne blur
                          handleSelectAddress(result);
                        }}
                      >
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm line-clamp-2">{result.place_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showGeolocation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGeolocation}
            disabled={isGeolocating}
            title="Usar minha localização"
            className="flex-shrink-0"
          >
            {isGeolocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      {value && (
        <p className="text-xs text-green-600">
          ✓ {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
