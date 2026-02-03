import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =============================================
// TIPOS
// =============================================

export interface DadoEleitoral {
  id: string;
  camada_id: string;
  nome_regiao: string;
  votos: number;
  total_eleitores?: number | null;
  eleicao: string;
  cargo?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface DadoEleitoralInput {
  camada_id: string;
  nome_regiao: string;
  votos: number;
  total_eleitores?: number | null;
  eleicao: string;
  cargo?: string;
}

export interface ImportacaoResult {
  sucesso: number;
  erros: string[];
  naoEncontrados: string[];
}

// =============================================
// HOOK PRINCIPAL
// =============================================

export function useDadosEleitorais(camadaId?: string | null) {
  const queryClient = useQueryClient();

  // Query: Buscar dados eleitorais de uma camada
  const {
    data: dadosEleitorais = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['dados-eleitorais', camadaId],
    queryFn: async () => {
      if (!camadaId) return [];

      try {
        const { data, error } = await supabase
          .from('dados_eleitorais')
          .select('*')
          .eq('camada_id', camadaId)
          .order('votos', { ascending: false });

        if (error) {
          console.warn('Erro ao buscar dados eleitorais:', error.message);
          return [];
        }

        return (data || []) as DadoEleitoral[];
      } catch (err) {
        console.error('Erro inesperado:', err);
        return [];
      }
    },
    enabled: !!camadaId,
    retry: false,
    placeholderData: []
  });

  // Query: Listar eleições disponíveis para uma camada
  const { data: eleicoesDisponiveis = [] } = useQuery({
    queryKey: ['eleicoes-disponiveis', camadaId],
    queryFn: async () => {
      if (!camadaId) return [];

      const { data, error } = await supabase
        .from('dados_eleitorais')
        .select('eleicao')
        .eq('camada_id', camadaId);

      if (error) return [];

      // Extrair eleições únicas
      const eleicoes = [...new Set(data?.map(d => d.eleicao) || [])];
      return eleicoes.sort().reverse(); // Mais recente primeiro
    },
    enabled: !!camadaId
  });

  // Mutation: Importar dados em lote
  const importarDados = useMutation({
    mutationFn: async ({
      camadaId,
      dados,
      eleicao,
      cargo,
      regioesDisponiveis
    }: {
      camadaId: string;
      dados: Array<{ nome: string; votos: number; totalEleitores?: number }>;
      eleicao: string;
      cargo?: string;
      regioesDisponiveis: string[];
    }): Promise<ImportacaoResult> => {
      const result: ImportacaoResult = {
        sucesso: 0,
        erros: [],
        naoEncontrados: []
      };

      // Normalizar nomes das regiões disponíveis para match
      const regioesNormalizadas = new Map<string, string>();
      regioesDisponiveis.forEach(nome => {
        regioesNormalizadas.set(normalizarNome(nome), nome);
      });

      // Preparar dados para inserção
      const dadosParaInserir: DadoEleitoralInput[] = [];

      for (const item of dados) {
        const nomeNormalizado = normalizarNome(item.nome);
        const nomeOriginal = regioesNormalizadas.get(nomeNormalizado);

        if (nomeOriginal) {
          dadosParaInserir.push({
            camada_id: camadaId,
            nome_regiao: nomeOriginal,
            votos: item.votos,
            total_eleitores: item.totalEleitores || null,
            eleicao,
            cargo
          });
        } else {
          result.naoEncontrados.push(item.nome);
        }
      }

      if (dadosParaInserir.length === 0) {
        throw new Error('Nenhum dado válido para importar');
      }

      // Deletar dados existentes desta eleição para esta camada
      const { error: deleteError } = await supabase
        .from('dados_eleitorais')
        .delete()
        .eq('camada_id', camadaId)
        .eq('eleicao', eleicao);

      if (deleteError) {
        console.warn('Erro ao limpar dados anteriores:', deleteError);
      }

      // Inserir novos dados
      const { error: insertError } = await supabase
        .from('dados_eleitorais')
        .insert(dadosParaInserir);

      if (insertError) {
        throw new Error(`Erro ao inserir dados: ${insertError.message}`);
      }

      result.sucesso = dadosParaInserir.length;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dados-eleitorais'] });
      queryClient.invalidateQueries({ queryKey: ['eleicoes-disponiveis'] });

      if (result.naoEncontrados.length > 0) {
        toast.warning(
          `${result.sucesso} regiões importadas. ${result.naoEncontrados.length} não encontradas.`
        );
      } else {
        toast.success(`${result.sucesso} regiões importadas com sucesso!`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao importar dados');
    }
  });

  // Mutation: Deletar dados de uma eleição
  const deletarEleicao = useMutation({
    mutationFn: async ({ camadaId, eleicao }: { camadaId: string; eleicao: string }) => {
      const { error } = await supabase
        .from('dados_eleitorais')
        .delete()
        .eq('camada_id', camadaId)
        .eq('eleicao', eleicao);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dados-eleitorais'] });
      queryClient.invalidateQueries({ queryKey: ['eleicoes-disponiveis'] });
      toast.success('Dados da eleição removidos');
    },
    onError: () => {
      toast.error('Erro ao remover dados');
    }
  });

  // Função para obter estatísticas de votos por região
  const getVotosPorRegiao = (eleicao?: string): Map<string, number> => {
    const map = new Map<string, number>();
    
    const dadosFiltrados = eleicao 
      ? dadosEleitorais.filter(d => d.eleicao === eleicao)
      : dadosEleitorais;

    dadosFiltrados.forEach(d => {
      map.set(d.nome_regiao, d.votos);
    });

    return map;
  };

  // Função para obter total de eleitores por região
  const getTotalEleitoresPorRegiao = (eleicao?: string): Map<string, number> => {
    const map = new Map<string, number>();
    
    const dadosFiltrados = eleicao 
      ? dadosEleitorais.filter(d => d.eleicao === eleicao)
      : dadosEleitorais;

    dadosFiltrados.forEach(d => {
      if (d.total_eleitores) {
        map.set(d.nome_regiao, d.total_eleitores);
      }
    });

    return map;
  };

  // Função para obter total de votos
  const getTotalVotos = (eleicao?: string): number => {
    const dadosFiltrados = eleicao 
      ? dadosEleitorais.filter(d => d.eleicao === eleicao)
      : dadosEleitorais;

    return dadosFiltrados.reduce((sum, d) => sum + d.votos, 0);
  };

  // Função para obter total geral de eleitores
  const getTotalEleitores = (eleicao?: string): number => {
    const dadosFiltrados = eleicao 
      ? dadosEleitorais.filter(d => d.eleicao === eleicao)
      : dadosEleitorais;

    return dadosFiltrados.reduce((sum, d) => sum + (d.total_eleitores || 0), 0);
  };

  return {
    dadosEleitorais,
    isLoading,
    error,
    eleicoesDisponiveis,
    importarDados,
    deletarEleicao,
    getVotosPorRegiao,
    getTotalEleitoresPorRegiao,
    getTotalVotos,
    getTotalEleitores
  };
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

/**
 * Normaliza nome para matching (remove acentos, lowercase, trim)
 */
function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Faz match fuzzy entre dois nomes (para sugestões)
 */
export function calcularSimilaridade(str1: string, str2: string): number {
  const s1 = normalizarNome(str1);
  const s2 = normalizarNome(str2);
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distância de Levenshtein entre duas strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Encontra a melhor correspondência para um nome em uma lista
 */
export function encontrarMelhorMatch(
  nome: string, 
  opcoes: string[], 
  limiarSimilaridade: number = 0.7
): { match: string | null; similaridade: number } {
  let melhorMatch: string | null = null;
  let melhorSimilaridade = 0;

  for (const opcao of opcoes) {
    const similaridade = calcularSimilaridade(nome, opcao);
    if (similaridade > melhorSimilaridade && similaridade >= limiarSimilaridade) {
      melhorMatch = opcao;
      melhorSimilaridade = similaridade;
    }
  }

  return { match: melhorMatch, similaridade: melhorSimilaridade };
}
