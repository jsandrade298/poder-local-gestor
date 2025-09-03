import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface MunicipeWithTags {
  id: string
  nome: string
  cpf?: string
  rg?: string
  email?: string
  telefone?: string
  endereco?: string
  bairro?: string
  cidade?: string
  cep?: string
  data_nascimento?: string
  profissao?: string
  observacoes?: string
  created_at: string
  updated_at: string
  total_demandas?: number
}

export const useMunicipes = () => {
  const [municipes, setMunicipes] = useState<MunicipeWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMunicipes = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          id,
          nome,
          cpf,
          rg,
          email,
          telefone,
          endereco,
          bairro,
          cidade,
          cep,
          data_nascimento,
          profissao,
          observacoes,
          created_at,
          updated_at
        `)
        .order('nome')

      if (error) throw error

      // Para cada munícipe, buscar total de demandas
      const municipesWithStats = await Promise.all(
        (data || []).map(async (municipe) => {
          const { count: totalDemandas } = await supabase
            .from('demandas')
            .select('*', { count: 'exact', head: true })
            .eq('municipe_id', municipe.id)

          return {
            ...municipe,
            total_demandas: totalDemandas || 0
          }
        })
      )

      setMunicipes(municipesWithStats)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createMunicipe = async (municipeData: Omit<MunicipeWithTags, 'id' | 'created_at' | 'updated_at' | 'total_demandas'>) => {
    try {
      const { data, error } = await supabase
        .from('municipes')
        .insert([municipeData])
        .select()

      if (error) throw error

      await fetchMunicipes() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const updateMunicipe = async (id: string, updates: Partial<MunicipeWithTags>) => {
    try {
      const { data, error } = await supabase
        .from('municipes')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) throw error

      await fetchMunicipes() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const deleteMunicipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('municipes')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchMunicipes() // Recarregar lista
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  useEffect(() => {
    fetchMunicipes()
  }, [])

  return {
    municipes,
    loading,
    error,
    fetchMunicipes,
    createMunicipe,
    updateMunicipe,
    deleteMunicipe
  }
}