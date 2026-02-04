import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Tipos
export interface RotaPonto {
  id?: string;
  rota_id?: string;
  ordem: number;
  tipo: 'demanda' | 'municipe';
  referencia_id: string;
  nome: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  visitado?: boolean;
  observacao_visita?: string;
}

export interface Rota {
  id: string;
  titulo: string;
  usuario_id: string;
  data_programada: string;
  origem_lat?: number;
  origem_lng?: number;
  destino_lat?: number;
  destino_lng?: number;
  otimizar: boolean;
  observacoes?: string;
  observacoes_conclusao?: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  concluida_em?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  rota_pontos?: RotaPonto[];
  usuario_nome?: string;
}

export interface CriarRotaInput {
  titulo: string;
  data_programada: string;
  origem_lat?: number;
  origem_lng?: number;
  destino_lat?: number;
  destino_lng?: number;
  otimizar?: boolean;
  observacoes?: string;
  pontos: Omit<RotaPonto, 'id' | 'rota_id'>[];
}

export interface AtualizarRotaInput {
  id: string;
  titulo?: string;
  data_programada?: string;
  origem_lat?: number;
  origem_lng?: number;
  destino_lat?: number;
  destino_lng?: number;
  otimizar?: boolean;
  observacoes?: string;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  observacoes_conclusao?: string;
  pontos?: Omit<RotaPonto, 'id' | 'rota_id'>[];
}

export function useRotas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todas as rotas
  const {
    data: rotas = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['rotas'],
    queryFn: async () => {
      console.log('🔍 Buscando rotas...');
      
      // Primeiro buscar as rotas
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select(`
          *,
          rota_pontos (
            id,
            ordem,
            tipo,
            referencia_id,
            nome,
            endereco,
            latitude,
            longitude,
            visitado,
            observacao_visita
          )
        `)
        .order('data_programada', { ascending: true });

      if (rotasError) {
        console.error('❌ Erro ao buscar rotas:', rotasError);
        throw rotasError;
      }

      console.log('✅ Rotas encontradas:', rotasData?.length || 0);

      if (!rotasData || rotasData.length === 0) {
        return [];
      }

      // Buscar os nomes dos usuários
      const usuarioIds = [...new Set(rotasData.map(r => r.usuario_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', usuarioIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.nome]) || []);

      // Combinar dados
      const rotasComUsuarios = rotasData.map(rota => ({
        ...rota,
        usuario_nome: profilesMap.get(rota.usuario_id) || 'Usuário',
        rota_pontos: (rota.rota_pontos || []).sort((a: RotaPonto, b: RotaPonto) => a.ordem - b.ordem)
      }));

      return rotasComUsuarios as Rota[];
    },
    enabled: !!user,
    staleTime: 30000, // Cache por 30 segundos
    refetchOnWindowFocus: false
  });

  // Buscar uma rota específica
  const buscarRota = async (id: string): Promise<Rota | null> => {
    const { data, error } = await supabase
      .from('rotas')
      .select(`
        *,
        rota_pontos (
          id,
          ordem,
          tipo,
          referencia_id,
          nome,
          endereco,
          latitude,
          longitude,
          visitado,
          observacao_visita
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar rota:', error);
      return null;
    }

    // Buscar nome do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', data.usuario_id)
      .single();

    return {
      ...data,
      usuario_nome: profile?.nome || 'Usuário',
      rota_pontos: (data.rota_pontos || []).sort((a: RotaPonto, b: RotaPonto) => a.ordem - b.ordem)
    } as Rota;
  };

  // Criar rota
  const criarRota = useMutation({
    mutationFn: async (input: CriarRotaInput) => {
      if (!user) throw new Error('Usuário não autenticado');

      console.log('📝 Criando rota:', input.titulo);

      // 1. Criar a rota
      const { data: rota, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          titulo: input.titulo,
          usuario_id: user.id,
          data_programada: input.data_programada,
          origem_lat: input.origem_lat,
          origem_lng: input.origem_lng,
          destino_lat: input.destino_lat,
          destino_lng: input.destino_lng,
          otimizar: input.otimizar || false,
          observacoes: input.observacoes
        })
        .select()
        .single();

      if (rotaError) {
        console.error('❌ Erro ao criar rota:', rotaError);
        throw rotaError;
      }

      console.log('✅ Rota criada:', rota.id);

      // 2. Criar os pontos da rota
      if (input.pontos.length > 0) {
        const pontosParaInserir = input.pontos.map((ponto, index) => ({
          rota_id: rota.id,
          ordem: index + 1,
          tipo: ponto.tipo,
          referencia_id: ponto.referencia_id,
          nome: ponto.nome,
          endereco: ponto.endereco,
          latitude: ponto.latitude,
          longitude: ponto.longitude
        }));

        const { error: pontosError } = await supabase
          .from('rota_pontos')
          .insert(pontosParaInserir);

        if (pontosError) {
          console.error('❌ Erro ao criar pontos:', pontosError);
          throw pontosError;
        }

        console.log('✅ Pontos criados:', pontosParaInserir.length);
      }

      return rota;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota criada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar rota:', error);
      toast.error('Erro ao criar rota: ' + error.message);
    }
  });

  // Atualizar rota
  const atualizarRota = useMutation({
    mutationFn: async (input: AtualizarRotaInput) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { id, pontos, ...rotaData } = input;

      // 1. Atualizar a rota
      const { error: rotaError } = await supabase
        .from('rotas')
        .update(rotaData)
        .eq('id', id);

      if (rotaError) throw rotaError;

      // 2. Se pontos foram fornecidos, atualizar
      if (pontos !== undefined) {
        // Remover pontos antigos
        const { error: deleteError } = await supabase
          .from('rota_pontos')
          .delete()
          .eq('rota_id', id);

        if (deleteError) throw deleteError;

        // Inserir novos pontos
        if (pontos.length > 0) {
          const pontosParaInserir = pontos.map((ponto, index) => ({
            rota_id: id,
            ordem: index + 1,
            tipo: ponto.tipo,
            referencia_id: ponto.referencia_id,
            nome: ponto.nome,
            endereco: ponto.endereco,
            latitude: ponto.latitude,
            longitude: ponto.longitude,
            visitado: ponto.visitado || false,
            observacao_visita: ponto.observacao_visita
          }));

          const { error: pontosError } = await supabase
            .from('rota_pontos')
            .insert(pontosParaInserir);

          if (pontosError) throw pontosError;
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota atualizada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar rota:', error);
      toast.error('Erro ao atualizar rota: ' + error.message);
    }
  });

  // Iniciar rota (mudar status para em_andamento)
  const iniciarRota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rotas')
        .update({ status: 'em_andamento' })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota iniciada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao iniciar rota: ' + error.message);
    }
  });

  // Concluir rota
  const concluirRota = useMutation({
    mutationFn: async ({ id, observacoes_conclusao }: { id: string; observacoes_conclusao?: string }) => {
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          observacoes_conclusao
        })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota concluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao concluir rota: ' + error.message);
    }
  });

  // Cancelar rota
  const cancelarRota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rotas')
        .update({ status: 'cancelada' })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota cancelada');
    },
    onError: (error: any) => {
      toast.error('Erro ao cancelar rota: ' + error.message);
    }
  });

  // Excluir rota
  const excluirRota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rotas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota excluída');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir rota: ' + error.message);
    }
  });

  // Copiar rota (criar uma cópia para o usuário atual)
  const copiarRota = useMutation({
    mutationFn: async ({ rotaOriginal, novaData }: { rotaOriginal: Rota; novaData: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Criar a nova rota
      const { data: novaRota, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          titulo: `${rotaOriginal.titulo} (Cópia)`,
          usuario_id: user.id,
          data_programada: novaData,
          origem_lat: rotaOriginal.origem_lat,
          origem_lng: rotaOriginal.origem_lng,
          destino_lat: rotaOriginal.destino_lat,
          destino_lng: rotaOriginal.destino_lng,
          otimizar: rotaOriginal.otimizar,
          observacoes: rotaOriginal.observacoes
        })
        .select()
        .single();

      if (rotaError) throw rotaError;

      // 2. Copiar os pontos
      if (rotaOriginal.rota_pontos && rotaOriginal.rota_pontos.length > 0) {
        const pontosParaInserir = rotaOriginal.rota_pontos.map(ponto => ({
          rota_id: novaRota.id,
          ordem: ponto.ordem,
          tipo: ponto.tipo,
          referencia_id: ponto.referencia_id,
          nome: ponto.nome,
          endereco: ponto.endereco,
          latitude: ponto.latitude,
          longitude: ponto.longitude
        }));

        const { error: pontosError } = await supabase
          .from('rota_pontos')
          .insert(pontosParaInserir);

        if (pontosError) throw pontosError;
      }

      return novaRota;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Rota copiada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao copiar rota: ' + error.message);
    }
  });

  // Marcar ponto como visitado
  const marcarPontoVisitado = useMutation({
    mutationFn: async ({ pontoId, visitado, observacao }: { pontoId: string; visitado: boolean; observacao?: string }) => {
      const { error } = await supabase
        .from('rota_pontos')
        .update({
          visitado,
          observacao_visita: observacao
        })
        .eq('id', pontoId);

      if (error) throw error;
      return { pontoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar ponto: ' + error.message);
    }
  });

  // Filtrar rotas
  const rotasPendentes = rotas.filter(r => r.status === 'pendente');
  const rotasEmAndamento = rotas.filter(r => r.status === 'em_andamento');
  const rotasConcluidas = rotas.filter(r => r.status === 'concluida');
  const rotasCanceladas = rotas.filter(r => r.status === 'cancelada');
  const minhasRotas = rotas.filter(r => r.usuario_id === user?.id);

  return {
    rotas,
    rotasPendentes,
    rotasEmAndamento,
    rotasConcluidas,
    rotasCanceladas,
    minhasRotas,
    isLoading,
    error,
    refetch,
    buscarRota,
    criarRota,
    atualizarRota,
    iniciarRota,
    concluirRota,
    cancelarRota,
    excluirRota,
    copiarRota,
    marcarPontoVisitado
  };
}
