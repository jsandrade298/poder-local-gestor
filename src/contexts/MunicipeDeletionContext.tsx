import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MunicipeDeletionProgress {
  id: string;
  nome: string;
  status: 'pending' | 'deleting' | 'deleted' | 'error';
  error?: string;
}

interface MunicipeDeletionState {
  isActive: boolean;
  isMinimized: boolean;
  isCancelled: boolean;
  totalMunicipes: number;
  processedMunicipes: number;
  currentMunicipe?: MunicipeDeletionProgress;
  municipes: MunicipeDeletionProgress[];
}

interface MunicipeDeletionContextType {
  state: MunicipeDeletionState;
  startDeletion: (data: {
    municipes: { id: string; nome: string }[];
  }) => void;
  updateMunicipeStatus: (id: string, status: MunicipeDeletionProgress['status'], error?: string) => void;
  setMinimized: (minimized: boolean) => void;
  finishDeletion: () => void;
  resetDeletion: () => void;
  cancelDeletion: () => void;
}

const MunicipeDeletionContext = createContext<MunicipeDeletionContextType | undefined>(undefined);

const initialState: MunicipeDeletionState = {
  isActive: false,
  isMinimized: false,
  isCancelled: false,
  totalMunicipes: 0,
  processedMunicipes: 0,
  municipes: [],
};

export function MunicipeDeletionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MunicipeDeletionState>(initialState);

  const startDeletion = (data: { municipes: { id: string; nome: string }[] }) => {
    const municipesList = data.municipes.map(m => ({
      id: m.id,
      nome: m.nome,
      status: 'pending' as const
    }));

    setState({
      isActive: true,
      isMinimized: false,
      isCancelled: false,
      totalMunicipes: data.municipes.length,
      processedMunicipes: 0,
      municipes: municipesList,
    });
  };

  const updateMunicipeStatus = (id: string, status: MunicipeDeletionProgress['status'], error?: string) => {
    setState(prev => {
      const updatedMunicipes = prev.municipes.map(m => 
        m.id === id ? { ...m, status, error } : m
      );
      
      const processedCount = updatedMunicipes.filter(m => 
        m.status === 'deleted' || m.status === 'error'
      ).length;

      const currentMunicipe = updatedMunicipes.find(m => m.status === 'deleting');

      return {
        ...prev,
        municipes: updatedMunicipes,
        processedMunicipes: processedCount,
        currentMunicipe,
      };
    });
  };

  const setMinimized = (minimized: boolean) => {
    setState(prev => ({ ...prev, isMinimized: minimized }));
  };

  const finishDeletion = () => {
    setState(prev => ({ ...prev, isActive: false }));
  };

  const resetDeletion = () => {
    setState(initialState);
  };

  const cancelDeletion = () => {
    setState(prev => ({
      ...prev,
      isCancelled: true,
      municipes: prev.municipes.map(m => 
        m.status === 'pending' || m.status === 'deleting'
          ? { ...m, status: 'error', error: 'Exclusão cancelada pelo usuário' }
          : m
      )
    }));
  };

  return (
    <MunicipeDeletionContext.Provider
      value={{
        state,
        startDeletion,
        updateMunicipeStatus,
        setMinimized,
        finishDeletion,
        resetDeletion,
        cancelDeletion,
      }}
    >
      {children}
    </MunicipeDeletionContext.Provider>
  );
}

export function useMunicipeDeletion() {
  const context = useContext(MunicipeDeletionContext);
  if (context === undefined) {
    throw new Error('useMunicipeDeletion must be used within a MunicipeDeletionProvider');
  }
  return context;
}