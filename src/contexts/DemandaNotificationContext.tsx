import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DemandaNotificationProgress {
  id: string;
  demanda_id: string;
  municipe_nome: string;
  telefone: string;
  status: 'pending' | 'sending' | 'sent' | 'error';
  countdown?: number;
  error?: string;
  sentAt?: Date;
  demanda_titulo?: string;
  novo_status?: string;
}

interface DemandaNotificationState {
  isActive: boolean;
  isMinimized: boolean;
  isCancelled: boolean;
  totalNotifications: number;
  processedNotifications: number;
  currentNotification?: DemandaNotificationProgress;
  notifications: DemandaNotificationProgress[];
  instanceName: string;
}

interface DemandaNotificationContextType {
  state: DemandaNotificationState;
  addNotification: (data: {
    demanda_id: string;
    demanda_titulo: string;
    municipe_nome: string;
    telefone: string;
    novo_status: string;
    instanceName: string;
  }) => void;
  updateNotificationStatus: (id: string, status: DemandaNotificationProgress['status'], error?: string) => void;
  updateCountdown: (id: string, countdown: number) => void;
  setMinimized: (minimized: boolean) => void;
  finishNotifications: () => void;
  resetNotifications: () => void;
  cancelNotifications: () => void;
}

const DemandaNotificationContext = createContext<DemandaNotificationContextType | undefined>(undefined);

const initialState: DemandaNotificationState = {
  isActive: false,
  isMinimized: false,
  isCancelled: false,
  totalNotifications: 0,
  processedNotifications: 0,
  notifications: [],
  instanceName: '',
};

export function DemandaNotificationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemandaNotificationState>(initialState);

  const addNotification = (data: {
    demanda_id: string;
    demanda_titulo: string;
    municipe_nome: string;
    telefone: string;
    novo_status: string;
    instanceName: string;
  }) => {
    const notification: DemandaNotificationProgress = {
      id: `${data.demanda_id}-${Date.now()}`,
      demanda_id: data.demanda_id,
      municipe_nome: data.municipe_nome,
      telefone: data.telefone,
      status: 'pending',
      demanda_titulo: data.demanda_titulo,
      novo_status: data.novo_status,
    };

    setState(prev => {
      const newNotifications = [...prev.notifications, notification];
      return {
        ...prev,
        isActive: true,
        isMinimized: false,
        isCancelled: false,
        totalNotifications: newNotifications.length,
        notifications: newNotifications,
        instanceName: data.instanceName,
      };
    });
  };

  const updateNotificationStatus = (id: string, status: DemandaNotificationProgress['status'], error?: string) => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notification =>
        notification.id === id 
          ? { 
              ...notification, 
              status, 
              error,
              sentAt: status === 'sent' ? new Date() : notification.sentAt,
              countdown: status === 'sent' || status === 'error' ? undefined : notification.countdown
            }
          : notification
      );

      const processedCount = updatedNotifications.filter(n => n.status === 'sent' || n.status === 'error').length;
      const currentNotification = updatedNotifications.find(n => n.status === 'sending');

      return {
        ...prev,
        notifications: updatedNotifications,
        processedNotifications: processedCount,
        currentNotification,
      };
    });
  };

  const updateCountdown = (id: string, countdown: number) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(notification =>
        notification.id === id ? { ...notification, countdown } : notification
      )
    }));
  };

  const setMinimized = (minimized: boolean) => {
    setState(prev => ({ ...prev, isMinimized: minimized }));
  };

  const finishNotifications = () => {
    setState(prev => ({ ...prev, isActive: false }));
  };

  const resetNotifications = () => {
    setState(initialState);
  };

  const cancelNotifications = () => {
    setState(prev => ({
      ...prev,
      isCancelled: true,
      notifications: prev.notifications.map(notification => 
        notification.status === 'pending' || notification.status === 'sending'
          ? { ...notification, status: 'error', error: 'Envio cancelado pelo usuário' }
          : notification
      )
    }));
  };

  return (
    <DemandaNotificationContext.Provider
      value={{
        state,
        addNotification,
        updateNotificationStatus,
        updateCountdown,
        setMinimized,
        finishNotifications,
        resetNotifications,
        cancelNotifications,
      }}
    >
      {children}
    </DemandaNotificationContext.Provider>
  );
}

export function useDemandaNotification() {
  const context = useContext(DemandaNotificationContext);
  if (context === undefined) {
    throw new Error('useDemandaNotification must be used within a DemandaNotificationProvider');
  }
  return context;
}