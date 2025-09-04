import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RecipientProgress {
  id: string;
  nome: string;
  telefone: string;
  status: 'pending' | 'sending' | 'sent' | 'error';
  countdown?: number;
  error?: string;
  sentAt?: Date;
}

interface WhatsAppSendingState {
  isActive: boolean;
  isMinimized: boolean;
  totalRecipients: number;
  processedRecipients: number;
  currentRecipient?: RecipientProgress;
  recipients: RecipientProgress[];
  message: string;
  instanceName: string;
  tempoMinimo: number;
  tempoMaximo: number;
}

interface WhatsAppSendingContextType {
  state: WhatsAppSendingState;
  startSending: (data: {
    recipients: { id: string; nome: string; telefone: string }[];
    message: string;
    instanceName: string;
    tempoMinimo: number;
    tempoMaximo: number;
  }) => void;
  updateRecipientStatus: (id: string, status: RecipientProgress['status'], error?: string) => void;
  updateCountdown: (id: string, countdown: number) => void;
  setMinimized: (minimized: boolean) => void;
  finishSending: () => void;
  resetSending: () => void;
}

const WhatsAppSendingContext = createContext<WhatsAppSendingContextType | undefined>(undefined);

const initialState: WhatsAppSendingState = {
  isActive: false,
  isMinimized: false,
  totalRecipients: 0,
  processedRecipients: 0,
  recipients: [],
  message: '',
  instanceName: '',
  tempoMinimo: 1,
  tempoMaximo: 3,
};

export function WhatsAppSendingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WhatsAppSendingState>(initialState);

  const startSending = (data: {
    recipients: { id: string; nome: string; telefone: string }[];
    message: string;
    instanceName: string;
    tempoMinimo: number;
    tempoMaximo: number;
  }) => {
    const recipients: RecipientProgress[] = data.recipients.map(recipient => ({
      ...recipient,
      status: 'pending'
    }));

    setState({
      isActive: true,
      isMinimized: false,
      totalRecipients: recipients.length,
      processedRecipients: 0,
      recipients,
      message: data.message,
      instanceName: data.instanceName,
      tempoMinimo: data.tempoMinimo,
      tempoMaximo: data.tempoMaximo,
    });
  };

  const updateRecipientStatus = (id: string, status: RecipientProgress['status'], error?: string) => {
    setState(prev => {
      const updatedRecipients = prev.recipients.map(recipient =>
        recipient.id === id 
          ? { 
              ...recipient, 
              status, 
              error,
              sentAt: status === 'sent' ? new Date() : recipient.sentAt,
              countdown: status === 'sent' || status === 'error' ? undefined : recipient.countdown
            }
          : recipient
      );

      const processedCount = updatedRecipients.filter(r => r.status === 'sent' || r.status === 'error').length;
      const currentRecipient = updatedRecipients.find(r => r.status === 'sending');

      return {
        ...prev,
        recipients: updatedRecipients,
        processedRecipients: processedCount,
        currentRecipient,
      };
    });
  };

  const updateCountdown = (id: string, countdown: number) => {
    setState(prev => ({
      ...prev,
      recipients: prev.recipients.map(recipient =>
        recipient.id === id ? { ...recipient, countdown } : recipient
      )
    }));
  };

  const setMinimized = (minimized: boolean) => {
    setState(prev => ({ ...prev, isMinimized: minimized }));
  };

  const finishSending = () => {
    setState(prev => ({ ...prev, isActive: false }));
  };

  const resetSending = () => {
    setState(initialState);
  };

  return (
    <WhatsAppSendingContext.Provider
      value={{
        state,
        startSending,
        updateRecipientStatus,
        updateCountdown,
        setMinimized,
        finishSending,
        resetSending,
      }}
    >
      {children}
    </WhatsAppSendingContext.Provider>
  );
}

export function useWhatsAppSending() {
  const context = useContext(WhatsAppSendingContext);
  if (context === undefined) {
    throw new Error('useWhatsAppSending must be used within a WhatsAppSendingProvider');
  }
  return context;
}