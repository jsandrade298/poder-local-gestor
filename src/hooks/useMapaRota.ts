import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface PontoRota {
  id: string;
  tipo: 'demanda' | 'municipe' | 'custom';
  nome: string;
  latitude: number;
  longitude: number;
  endereco?: string;
}

export interface RotaCalculada {
  distancia: number; // em metros
  duracao: number; // em segundos
  polyline: [number, number][]; // coordenadas da rota
  instrucoes?: string[];
}

// Formata distância para exibição
export function formatarDistancia(metros: number): string {
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }
  return `${(metros / 1000).toFixed(1)} km`;
}

// Formata duração para exibição
export function formatarDuracao(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  
  if (horas > 0) {
    return `${horas}h ${minutos}min`;
  }
  return `${minutos} min`;
}

export function useMapaRota() {
  const [pontosRota, setPontosRota] = useState<PontoRota[]>([]);
  const [rotaCalculada, setRotaCalculada] = useState<RotaCalculada | null>(null);
  const [modoRota, setModoRota] = useState(false);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const { toast } = useToast();

  // Adicionar ponto à rota
  const adicionarPonto = useCallback((ponto: PontoRota) => {
    setPontosRota(prev => {
      // Evitar duplicatas
      if (prev.some(p => p.id === ponto.id)) {
        toast({
          title: "Ponto já adicionado",
          description: `${ponto.nome} já está na rota`,
          variant: "destructive"
        });
        return prev;
      }
      
      toast({
        title: "Ponto adicionado à rota",
        description: ponto.nome
      });
      
      return [...prev, ponto];
    });
    // Limpar rota calculada ao modificar pontos
    setRotaCalculada(null);
  }, [toast]);

  // Remover ponto da rota
  const removerPonto = useCallback((id: string) => {
    setPontosRota(prev => prev.filter(p => p.id !== id));
    setRotaCalculada(null);
  }, []);

  // Reordenar pontos (mover para cima/baixo)
  const moverPonto = useCallback((index: number, direcao: 'up' | 'down') => {
    setPontosRota(prev => {
      const newPontos = [...prev];
      const newIndex = direcao === 'up' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newPontos.length) return prev;
      
      [newPontos[index], newPontos[newIndex]] = [newPontos[newIndex], newPontos[index]];
      return newPontos;
    });
    setRotaCalculada(null);
  }, []);

  // Limpar todos os pontos
  const limparRota = useCallback(() => {
    setPontosRota([]);
    setRotaCalculada(null);
  }, []);

  // Calcular rota usando OSRM (Open Source Routing Machine) - gratuito
  const calcularRota = useCallback(async (profile: 'driving' | 'walking' = 'driving') => {
    if (pontosRota.length < 2) {
      toast({
        title: "Pontos insuficientes",
        description: "Adicione pelo menos 2 pontos para calcular a rota",
        variant: "destructive"
      });
      return null;
    }

    setCalculandoRota(true);

    try {
      // Montar coordenadas no formato lng,lat
      const coordinates = pontosRota
        .map(p => `${p.longitude},${p.latitude}`)
        .join(';');

      // Usar OSRM Demo Server (gratuito para uso não comercial)
      // Para produção, considere hospedar seu próprio servidor OSRM
      const osrmProfile = profile === 'walking' ? 'foot' : 'car';
      const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinates}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Erro ao calcular rota');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('Não foi possível calcular a rota');
      }

      const route = data.routes[0];
      
      // Extrair polyline (GeoJSON coordinates são [lng, lat], precisamos [lat, lng] para Leaflet)
      const polyline: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      // Extrair instruções dos steps
      const instrucoes: string[] = [];
      route.legs.forEach((leg: any) => {
        leg.steps.forEach((step: any) => {
          if (step.maneuver && step.maneuver.instruction) {
            instrucoes.push(step.maneuver.instruction);
          }
        });
      });

      const rotaResult: RotaCalculada = {
        distancia: route.distance,
        duracao: route.duration,
        polyline,
        instrucoes
      };

      setRotaCalculada(rotaResult);

      toast({
        title: "Rota calculada!",
        description: `${formatarDistancia(route.distance)} - ${formatarDuracao(route.duration)}`
      });

      return rotaResult;

    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      toast({
        title: "Erro ao calcular rota",
        description: "Verifique sua conexão e tente novamente",
        variant: "destructive"
      });
      return null;
    } finally {
      setCalculandoRota(false);
    }
  }, [pontosRota, toast]);

  // Gerar link para Google Maps
  const gerarLinkGoogleMaps = useCallback(() => {
    if (pontosRota.length === 0) return null;

    const waypoints = pontosRota.map(p => `${p.latitude},${p.longitude}`);
    
    if (waypoints.length === 1) {
      // Apenas destino
      return `https://www.google.com/maps/dir/?api=1&destination=${waypoints[0]}`;
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const waypointsStr = waypoints.slice(1, -1).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    
    if (waypointsStr) {
      url += `&waypoints=${waypointsStr}`;
    }

    return url;
  }, [pontosRota]);

  // Abrir rota no Google Maps
  const abrirNoGoogleMaps = useCallback(() => {
    const url = gerarLinkGoogleMaps();
    if (url) {
      window.open(url, '_blank');
    }
  }, [gerarLinkGoogleMaps]);

  // Toggle modo rota
  const toggleModoRota = useCallback(() => {
    setModoRota(prev => !prev);
  }, []);

  return {
    // Estado
    pontosRota,
    rotaCalculada,
    modoRota,
    calculandoRota,
    
    // Ações
    adicionarPonto,
    removerPonto,
    moverPonto,
    limparRota,
    calcularRota,
    abrirNoGoogleMaps,
    gerarLinkGoogleMaps,
    toggleModoRota,
    setModoRota,
    
    // Helpers
    formatarDistancia,
    formatarDuracao
  };
}
