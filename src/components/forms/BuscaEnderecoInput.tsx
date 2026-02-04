import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Navigation, MapPin, Loader2, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnderecoResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface BuscaEnderecoInputProps {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  showGeolocation?: boolean;
  label?: string;
}

export function BuscaEnderecoInput({
  value,
  onChange,
  placeholder = "Digite um endereço...",
  showGeolocation = true,
  label
}: BuscaEnderecoInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<EnderecoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  // Atualizar display text quando value mudar externamente
  useEffect(() => {
    if (value && !displayText) {
      setDisplayText(`${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`);
    }
  }, [value]);

  // Buscar endereços usando Nominatim (OpenStreetMap)
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Usando Nominatim API (gratuita, sem necessidade de chave)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` + 
        new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '5',
          countrycodes: 'br' // Limitar ao Brasil
        }),
        {
          headers: {
            'Accept-Language': 'pt-BR'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce para busca
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setDisplayText(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddress(value);
    }, 500);
  };

  // Selecionar endereço
  const handleSelectAddress = (result: EnderecoResult) => {
    const coords = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    };
    onChange(coords);
    setDisplayText(result.display_name);
    setInputValue('');
    setResults([]);
    setOpen(false);
  };

  // Obter geolocalização
  const handleGeolocation = () => {
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
        setDisplayText(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        setIsGeolocating(false);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        alert('Erro ao obter localização: ' + error.message);
        setIsGeolocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Limpar
  const handleClear = () => {
    onChange(null);
    setDisplayText('');
    setInputValue('');
    setResults([]);
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={open ? inputValue : displayText}
                onChange={(e) => {
                  if (!open) setOpen(true);
                  handleInputChange(e.target.value);
                }}
                onFocus={() => setOpen(true)}
                className={cn(
                  "pl-8 pr-8 text-sm",
                  value && "border-primary"
                )}
              />
              {(value || displayText) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="start">
            <Command>
              <CommandList>
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Buscando...</span>
                  </div>
                ) : results.length === 0 ? (
                  <CommandEmpty>
                    {inputValue.length < 3 
                      ? "Digite ao menos 3 caracteres..." 
                      : "Nenhum endereço encontrado"
                    }
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {results.map((result, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleSelectAddress(result)}
                        className="cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm line-clamp-2">{result.display_name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {showGeolocation && (
          <Button
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
        <p className="text-xs text-muted-foreground">
          📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
