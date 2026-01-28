import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface PontoRota {
  id: string;
  tipo: 'demanda' | 'municipe' | 'origem';
  nome: string;
  latitude: number;
  longitude: number;
  endereco?: string;
}

export interface RotaCalculada {
  distancia: number; // em metros
  duracao: number; // em segundos
  polyline: [number, number][]; // coordenadas da rota
  pontosOrdenados: PontoRota[]; // pontos na ordem otimizada
}

// Formata distância
export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

// Formata duração
export function formatarDuracao(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos} min`;
}

// Calcula distância entre dois pontos (Haversine)
function calcularDistanciaHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Algoritmo Nearest Neighbor para TSP (Problema do Caixeiro Viajante)
function otimizarOrdemPontos(origem: PontoRota, pontos: PontoRota[]): PontoRota[] {
  if (pontos.length <= 1) return pontos;
  
  const naoVisitados = [...pontos];
  const rotaOtimizada: PontoRota[] = [];
  let pontoAtual = origem;
  
  while (naoVisitados.length > 0) {
    let menorDistancia = Infinity;
    let indiceMaisProximo = 0;
    
    // Encontrar o ponto mais próximo do atual
    naoVisitados.forEach((ponto, index) => {
      const distancia = calcularDistanciaHaversine(
        pontoAtual.latitude, pontoAtual.longitude,
        ponto.latitude, ponto.longitude
      );
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        indiceMaisProximo = index;
      }
    });
    
    // Adicionar o mais próximo à rota e remover dos não visitados
    const proximoPonto = naoVisitados.splice(indiceMaisProximo, 1)[0];
    rotaOtimizada.push(proximoPonto);
    pontoAtual = proximoPonto;
  }
  
  return rotaOtimizada;
}

// Melhoria 2-opt para refinar a rota
function melhorarRota2Opt(pontos: PontoRota[]): PontoRota[] {
  if (pontos.length < 4) return pontos;
  
  let melhorada = [...pontos];
  let melhorou = true;
  let iteracoes = 0;
  const maxIteracoes = 100;
  
  while (melhorou && iteracoes < maxIteracoes) {
    melhorou = false;
    iteracoes++;
    
    for (let i = 0; i < melhorada.length - 2; i++) {
      for (let j = i + 2; j < melhorada.length; j++) {
        const d1 = calcularDistanciaHaversine(
          melhorada[i].latitude, melhorada[i].longitude,
          melhorada[i + 1].latitude, melhorada[i + 1].longitude
        );
        
        const nextJ = (j + 1) % melhorada.length;
        const d2 = j < melhorada.length - 1 ? calcularDistanciaHaversine(
          melhorada[j].latitude, melhorada[j].longitude,
          melhorada[nextJ].latitude, melhorada[nextJ].longitude
        ) : 0;
        
        const d3 = calcularDistanciaHaversine(
          melhorada[i].latitude, melhorada[i].longitude,
          melhorada[j].latitude, melhorada[j].longitude
        );
        
        const d4 = j < melhorada.length - 1 ? calcularDistanciaHaversine(
          melhorada[i + 1].latitude, melhorada[i + 1].longitude,
          melhorada[nextJ].latitude, melhorada[nextJ].longitude
        ) : 0;
        
        if (d3 + d4 < d1 + d2 - 1) { // -1 para evitar trocas insignificantes
          const segmento = melhorada.slice(i + 1, j + 1).reverse();
          melhorada = [...melhorada.slice(0, i + 1), ...segmento, ...melhorada.slice(j + 1)];
          melhorou = true;
        }
      }
    }
  }
  
  return melhorada;
}

export function useMapaRota() {
  const [pontosRota, setPontosRota] = useState<PontoRota[]>([]);
  const [pontoOrigem, setPontoOrigem] = useState<PontoRota | null>(null);
  const [rotaCalculada, setRotaCalculada] = useState<RotaCalculada | null>(null);
  const [modoRota, setModoRota] = useState(false);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const { toast } = useToast();

  // Adicionar ponto à rota
  const adicionarPonto = useCallback((ponto: PontoRota) => {
    setPontosRota(prev => {
      if (prev.some(p => p.id === ponto.id)) {
        toast({ title: "Ponto já na rota", description: ponto.nome, variant: "destructive" });
        return prev;
      }
      toast({ title: "Adicionado à rota", description: ponto.nome });
      return [...prev, ponto];
    });
    setRotaCalculada(null);
  }, [toast]);

  // Remover ponto
  const removerPonto = useCallback((id: string) => {
    setPontosRota(prev => prev.filter(p => p.id !== id));
    setRotaCalculada(null);
  }, []);

  // Mover ponto manualmente
  const moverPonto = useCallback((index: number, direcao: 'up' | 'down') => {
    setPontosRota(prev => {
      const novos = [...prev];
      const novoIndex = direcao === 'up' ? index - 1 : index + 1;
      if (novoIndex < 0 || novoIndex >= novos.length) return prev;
      [novos[index], novos[novoIndex]] = [novos[novoIndex], novos[index]];
      return novos;
    });
    setRotaCalculada(null);
  }, []);

  // Limpar rota
  const limparRota = useCallback(() => {
    setPontosRota([]);
    setPontoOrigem(null);
    setRotaCalculada(null);
  }, []);

  // Definir origem manualmente
  const definirOrigem = useCallback((ponto: PontoRota) => {
    setPontoOrigem(ponto);
    setRotaCalculada(null);
    toast({ title: "Origem definida", description: ponto.nome });
  }, [toast]);

  // Usar localização atual como origem
  const usarLocalizacaoAtual = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocalização não suportada", variant: "destructive" });
      return false;
    }

    setBuscandoLocalizacao(true);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      const origem: PontoRota = {
        id: 'origem-atual',
        tipo: 'origem',
        nome: 'Minha Localização',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        endereco: 'Localização atual'
      };

      setPontoOrigem(origem);
      setRotaCalculada(null);
      toast({ title: "Localização obtida!", description: "Origem definida com sucesso" });
      return true;
    } catch (error: any) {
      console.error('Erro geolocalização:', error);
      let msg = "Verifique as permissões do navegador";
      if (error.code === 1) msg = "Permissão de localização negada";
      if (error.code === 2) msg = "Localização indisponível";
      if (error.code === 3) msg = "Tempo esgotado";
      toast({ title: "Erro ao obter localização", description: msg, variant: "destructive" });
      return false;
    } finally {
      setBuscandoLocalizacao(false);
    }
  }, [toast]);

  // Limpar origem
  const limparOrigem = useCallback(() => {
    setPontoOrigem(null);
    setRotaCalculada(null);
  }, []);

  // Calcular rota otimizada via OSRM
  const calcularRotaOtimizada = useCallback(async (otimizar: boolean = true): Promise<RotaCalculada | null> => {
    if (!pontoOrigem) {
      toast({ title: "Defina o ponto de origem", description: "Use sua localização ou informe um endereço", variant: "destructive" });
      return null;
    }

    if (pontosRota.length === 0) {
      toast({ title: "Adicione pontos à rota", variant: "destructive" });
      return null;
    }

    setCalculandoRota(true);

    try {
      // Otimizar ordem se solicitado
      let pontosOrdenados = pontosRota;
      if (otimizar && pontosRota.length > 1) {
        pontosOrdenados = otimizarOrdemPontos(pontoOrigem, pontosRota);
        if (pontosOrdenados.length > 3) {
          pontosOrdenados = melhorarRota2Opt(pontosOrdenados);
        }
        setPontosRota(pontosOrdenados);
      }

      // Montar coordenadas: origem + pontos
      const todosOsPontos = [pontoOrigem, ...pontosOrdenados];
      const coordinates = todosOsPontos.map(p => `${p.longitude},${p.latitude}`).join(';');

      // Chamar OSRM
      const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Erro na API de rotas');

      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('Rota não encontrada');

      const route = data.routes[0];
      
      // Converter polyline
      const polyline: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      const resultado: RotaCalculada = {
        distancia: route.distance,
        duracao: route.duration,
        polyline,
        pontosOrdenados
      };

      setRotaCalculada(resultado);
      
      toast({ 
        title: "Rota otimizada!", 
        description: `${formatarDistancia(route.distance)} - ${formatarDuracao(route.duration)}` 
      });

      return resultado;
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      toast({ title: "Erro ao calcular rota", description: "Tente novamente", variant: "destructive" });
      return null;
    } finally {
      setCalculandoRota(false);
    }
  }, [pontoOrigem, pontosRota, toast]);

  // Gerar URL Google Maps com waypoints
  const gerarUrlGoogleMaps = useCallback((): string | null => {
    if (!pontoOrigem || pontosRota.length === 0) return null;

    const pontos = rotaCalculada?.pontosOrdenados || pontosRota;
    const origem = `${pontoOrigem.latitude},${pontoOrigem.longitude}`;
    const destino = `${pontos[pontos.length - 1].latitude},${pontos[pontos.length - 1].longitude}`;
    
    // Waypoints intermediários (Google Maps suporta até 25)
    const waypoints = pontos.slice(0, -1).slice(0, 23).map(p => `${p.latitude},${p.longitude}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

    return url;
  }, [pontoOrigem, pontosRota, rotaCalculada]);

  // Gerar URL Waze (navegação ponto a ponto)
  const gerarUrlWaze = useCallback((): string | null => {
    if (!pontoOrigem || pontosRota.length === 0) return null;

    const pontos = rotaCalculada?.pontosOrdenados || pontosRota;
    const primeiroPonto = pontos[0];
    
    // Waze não suporta múltiplos waypoints, navega até o primeiro ponto
    return `https://waze.com/ul?ll=${primeiroPonto.latitude},${primeiroPonto.longitude}&navigate=yes`;
  }, [pontoOrigem, pontosRota, rotaCalculada]);

  // Abrir no Google Maps
  const abrirNoGoogleMaps = useCallback(() => {
    const url = gerarUrlGoogleMaps();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({ title: "Configure a rota primeiro", variant: "destructive" });
    }
  }, [gerarUrlGoogleMaps, toast]);

  // Abrir no Waze
  const abrirNoWaze = useCallback(() => {
    const url = gerarUrlWaze();
    if (url) {
      window.open(url, '_blank');
      if (pontosRota.length > 1) {
        toast({ 
          title: "Navegando até o primeiro ponto", 
          description: "Ao chegar, abra novamente para ir ao próximo" 
        });
      }
    } else {
      toast({ title: "Configure a rota primeiro", variant: "destructive" });
    }
  }, [gerarUrlWaze, pontosRota.length, toast]);

  // Copiar lista de endereços
  const copiarEnderecos = useCallback(() => {
    if (!pontoOrigem || pontosRota.length === 0) {
      toast({ title: "Configure a rota primeiro", variant: "destructive" });
      return;
    }

    const pontos = rotaCalculada?.pontosOrdenados || pontosRota;
    const linhas = [
      `🚗 ROTEIRO DE VISITAS`,
      ``,
      `📍 ORIGEM: ${pontoOrigem.nome}`,
      pontoOrigem.endereco ? `   ${pontoOrigem.endereco}` : `   ${pontoOrigem.latitude.toFixed(6)}, ${pontoOrigem.longitude.toFixed(6)}`,
      ``,
      `📋 PARADAS:`,
      ...pontos.map((p, i) => [
        ``,
        `${i + 1}. ${p.nome} ${p.tipo === 'demanda' ? '📄' : '👤'}`,
        p.endereco ? `   ${p.endereco}` : `   ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`
      ]).flat(),
    ];

    if (rotaCalculada) {
      linhas.push(``, `📊 TOTAL: ${formatarDistancia(rotaCalculada.distancia)} - ${formatarDuracao(rotaCalculada.duracao)}`);
    }

    navigator.clipboard.writeText(linhas.join('\n'));
    toast({ title: "Roteiro copiado!", description: "Cole onde precisar" });
  }, [pontoOrigem, pontosRota, rotaCalculada, toast]);

  // Distância estimada
  const distanciaEstimada = useCallback((): number => {
    if (!pontoOrigem || pontosRota.length === 0) return 0;
    
    let total = 0;
    let atual = pontoOrigem;
    
    pontosRota.forEach(p => {
      total += calcularDistanciaHaversine(atual.latitude, atual.longitude, p.latitude, p.longitude);
      atual = p;
    });
    
    return total;
  }, [pontoOrigem, pontosRota]);

  // Toggle modo rota
  const toggleModoRota = useCallback(() => setModoRota(prev => !prev), []);

  return {
    pontosRota,
    pontoOrigem,
    rotaCalculada,
    modoRota,
    calculandoRota,
    buscandoLocalizacao,
    
    adicionarPonto,
    removerPonto,
    moverPonto,
    limparRota,
    
    definirOrigem,
    usarLocalizacaoAtual,
    limparOrigem,
    
    calcularRotaOtimizada,
    distanciaEstimada,
    
    abrirNoGoogleMaps,
    abrirNoWaze,
    gerarUrlGoogleMaps,
    gerarUrlWaze,
    copiarEnderecos,
    
    toggleModoRota,
    setModoRota,
  };
}
