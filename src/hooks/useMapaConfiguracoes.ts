import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MapaConfiguracoes {
  mapa_latitude_centro: string;
  mapa_longitude_centro: string;
  mapa_zoom_padrao: string;
  mapa_cidade: string;
  mapa_estado: string;
  mapa_pais: string;
}

const DEFAULT_MAPA_CONFIG: MapaConfiguracoes = {
  mapa_latitude_centro: '-23.6639',
  mapa_longitude_centro: '-46.5310',
  mapa_zoom_padrao: '13',
  mapa_cidade: 'Santo André',
  mapa_estado: 'SP',
  mapa_pais: 'Brasil'
};

export const useMapaConfiguracoes = () => {
  return useQuery({
    queryKey: ['mapa-configuracoes'],
    queryFn: async (): Promise<MapaConfiguracoes> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'mapa_latitude_centro',
          'mapa_longitude_centro',
          'mapa_zoom_padrao',
          'mapa_cidade',
          'mapa_estado',
          'mapa_pais'
        ]);
      
      if (error) throw error;

      const config: MapaConfiguracoes = { ...DEFAULT_MAPA_CONFIG };

      data?.forEach((item) => {
        if (item.chave in config) {
          config[item.chave as keyof MapaConfiguracoes] = item.valor || DEFAULT_MAPA_CONFIG[item.chave as keyof MapaConfiguracoes];
        }
      });

      return config;
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const useMapConfig = () => {
  const { data, isLoading, error } = useMapaConfiguracoes();

  return {
    configuracoes: data,
    loading: isLoading,
    error,
    center: data ? {
      lat: parseFloat(data.mapa_latitude_centro),
      lng: parseFloat(data.mapa_longitude_centro)
    } : { lat: -23.6639, lng: -46.5310 },
    zoom: data ? parseInt(data.mapa_zoom_padrao, 10) : 13,
    cidade: data?.mapa_cidade || 'Santo André',
    estado: data?.mapa_estado || 'SP'
  };
};
