import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemStatus {
  sistema: 'online' | 'offline';
  banco_dados: 'conectado' | 'desconectado' | 'erro';
  ultima_atualizacao: string;
}

export const useSystemStatus = () => {
  const [status, setStatus] = useState<SystemStatus>({
    sistema: 'online',
    banco_dados: 'conectado',
    ultima_atualizacao: new Date().toLocaleString('pt-BR')
  });

  // Verificar conexão com banco de dados
  const { data: dbStatus, isError } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      try {
        // Fazer uma query simples para testar conectividade
        const { data, error } = await supabase
          .from('configuracoes')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        return {
          connected: true,
          lastUpdate: data?.[0]?.updated_at
        };
      } catch (error) {
        throw error;
      }
    },
    refetchInterval: 30000, // Verificar a cada 30 segundos
    retry: 3
  });

  useEffect(() => {
    setStatus(prev => ({
      ...prev,
      banco_dados: isError ? 'erro' : (dbStatus?.connected ? 'conectado' : 'desconectado'),
      ultima_atualizacao: dbStatus?.lastUpdate 
        ? new Date(dbStatus.lastUpdate).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric', 
            hour: '2-digit',
            minute: '2-digit'
          })
    }));
  }, [dbStatus, isError]);

  return status;
};