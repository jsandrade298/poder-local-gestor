import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos para as tabelas do banco
export interface Usuario {
  id: string
  nome: string
  email: string
  telefone?: string
  ativo: boolean
  papel: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Municipe {
  id: string
  nome_completo: string
  email: string
  telefone?: string
  data_nascimento?: string
  end_logradouro?: string
  end_numero?: string
  end_complemento?: string
  end_bairro?: string
  end_cidade?: string
  end_cep?: string
  observacoes?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Tag {
  id: string
  nome: string
  descricao?: string
  cor: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Area {
  id: string
  nome: string
  descricao?: string
  cor: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Demanda {
  id: string
  titulo: string
  descricao?: string
  area_id?: string
  end_logradouro?: string
  end_numero?: string
  end_complemento?: string
  end_bairro?: string
  end_cidade?: string
  end_cep?: string
  responsavel_id?: string
  status: 'solicitado' | 'em_andamento' | 'nao_atendido' | 'arquivado' | 'concluido'
  municipe_id?: string
  prazo_entrega?: string
  observacoes?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Anexo {
  id: string
  demanda_id: string
  arquivo_url: string
  nome_arquivo: string
  tipo_mime?: string
  tamanho_bytes?: number
  created_at: string
  created_by?: string
}

export interface Configuracao {
  id: string
  chave: string
  valor?: string
  tipo: string
  descricao?: string
  created_at: string
  updated_at: string
}