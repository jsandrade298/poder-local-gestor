import { useEffect } from 'react';
import { useDemandaNotification } from '@/contexts/DemandaNotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/errorUtils';

export function useDemandaStatusMonitor() {
  const { user } = useAuth();
  const { addNotification } = useDemandaNotification();

  useEffect(() => {
    // Só ativa o monitor se o usuário estiver autenticado
    if (!user) return;

    // Escutar mudanças de status nas demandas
    const channel = supabase
      .channel('demanda-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'demandas',
          filter: 'status=neq.null'
        },
        async (payload) => {
          const newDemanda = payload.new as any;
          const oldDemanda = payload.old as any;

          // Só processa se o status realmente mudou
          if (newDemanda.status === oldDemanda.status) {
            return;
          }

          console.log('Status de demanda alterado:', {
            id: newDemanda.id,
            old_status: oldDemanda.status,
            new_status: newDemanda.status
          });

          try {
            // Buscar configurações para verificar se está ativo
            const { data: configs } = await supabase
              .from('configuracoes')
              .select('chave, valor')
              .in('chave', ['whatsapp_instancia_demandas', 'whatsapp_mensagem_demandas', 'whatsapp_demandas_ativo']);

            if (!configs) return;

            const configMap = configs.reduce((acc: any, item: any) => {
              acc[item.chave] = item.valor;
              return acc;
            }, {});

            const isActive = configMap.whatsapp_demandas_ativo === 'true';
            const instanceName = configMap.whatsapp_instancia_demandas;
            const messageTemplate = configMap.whatsapp_mensagem_demandas;

            if (!isActive || !instanceName || !messageTemplate) {
              console.log('Notificações de demanda não estão configuradas ou ativas');
              return;
            }

            // Buscar dados do munícipe
            const { data: municipe } = await supabase
              .from('municipes')
              .select('nome, telefone')
              .eq('id', newDemanda.municipe_id)
              .single();

            if (!municipe || !municipe.telefone) {
              console.log('Munícipe não encontrado ou sem telefone');
              return;
            }

            // Converter status para texto amigável
            let statusTexto = newDemanda.status;
            switch (newDemanda.status) {
              case 'aberta':
                statusTexto = 'Aberta';
                break;
              case 'em_andamento':
                statusTexto = 'Em Andamento';
                break;
              case 'resolvida':
                statusTexto = 'Resolvida';
                break;
              case 'cancelada':
                statusTexto = 'Cancelada';
                break;
            }

            // Adicionar notificação à fila
            addNotification({
              demanda_id: newDemanda.id,
              demanda_titulo: newDemanda.titulo,
              municipe_nome: municipe.nome,
              telefone: municipe.telefone,
              novo_status: statusTexto,
              instanceName: instanceName
            });

          } catch (error) {
            logError('Erro ao processar mudança de status da demanda:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);
}