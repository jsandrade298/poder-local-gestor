import { useCallback, useEffect } from 'react';
import { useDemandaNotification } from '@/contexts/DemandaNotificationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/errorUtils';

export function useDemandaNotificationSender() {
  const { state, updateNotificationStatus, updateCountdown, finishNotifications } = useDemandaNotification();
  const { toast } = useToast();

  const processNotifications = useCallback(async () => {
    if (!state.isActive || state.notifications.length === 0) return;

    // Buscar configurações (incluindo tempos de intervalo)
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'whatsapp_instancia_demandas',
        'whatsapp_mensagem_demandas',
        'whatsapp_demandas_ativo',
        'whatsapp_tempo_minimo_demandas',
        'whatsapp_tempo_maximo_demandas',
      ]);

    if (!configs) return;

    const configMap = configs.reduce((acc: any, item: any) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {});

    const isActive = configMap.whatsapp_demandas_ativo === 'true';
    const instanceName = configMap.whatsapp_instancia_demandas;
    const messageTemplate = configMap.whatsapp_mensagem_demandas;
    const tempoMinimo = parseInt(configMap.whatsapp_tempo_minimo_demandas) || 1;
    const tempoMaximo = parseInt(configMap.whatsapp_tempo_maximo_demandas) || 3;

    if (!isActive || !instanceName || !messageTemplate) {
      toast({
        title: "Configuração incompleta",
        description: "Configure as notificações de demanda no WhatsApp",
        variant: "destructive",
      });
      return;
    }

    const pendingNotifications = state.notifications.filter(n => n.status === 'pending');
    
    for (const notification of pendingNotifications) {
      if (state.isCancelled) break;

      try {
        // Atualizar status para enviando
        updateNotificationStatus(notification.id, 'sending');

        // Preparar mensagem personalizada
        const mensagemPersonalizada = messageTemplate
          .replace('{nome}', notification.municipe_nome)
          .replace('{status}', notification.novo_status || '');

        // Chamar função de notificação de demanda
        const { data, error } = await supabase.functions.invoke('notificar-demanda', {
          body: {
            demanda_id: notification.demanda_id,
            municipe_nome: notification.municipe_nome,
            municipe_telefone: notification.telefone,
            municipe_bairro: notification.municipe_bairro || '',
            status: notification.novo_status,
            titulo_demanda: notification.demanda_titulo || '',
            protocolo: notification.demanda_protocolo || '',
            instancia: instanceName,
            mensagem: messageTemplate
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        // Sucesso
        updateNotificationStatus(notification.id, 'sent');

        // Aguardar intervalo configurado entre envios
        if (pendingNotifications.indexOf(notification) < pendingNotifications.length - 1) {
          // Usar tempos configurados na página WhatsApp (em segundos)
          const delaySeconds = tempoMinimo + Math.random() * (tempoMaximo - tempoMinimo);
          let countdown = Math.ceil(delaySeconds);
          
          while (countdown > 0 && !state.isCancelled) {
            updateCountdown(notification.id, countdown);
            await new Promise(resolve => setTimeout(resolve, 1000));
            countdown--;
          }
          
          updateCountdown(notification.id, 0);
        }

      } catch (error: any) {
        logError('Erro ao enviar notificação:', error);
        updateNotificationStatus(notification.id, 'error', error.message);
      }
    }

    // Finalizar processo se não foi cancelado
    if (!state.isCancelled) {
      setTimeout(() => {
        finishNotifications();
      }, 2000);
    }
  }, [state, updateNotificationStatus, updateCountdown, finishNotifications, toast]);

  // Auto-processar notificações quando há notificações pendentes
  useEffect(() => {
    const pendingNotifications = state.notifications.filter(n => n.status === 'pending');
    if (pendingNotifications.length > 0 && state.isActive && !state.isCancelled) {
      const timeout = setTimeout(() => {
        processNotifications();
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [state.notifications, state.isActive, state.isCancelled, processNotifications]);

  return { processNotifications };
}
