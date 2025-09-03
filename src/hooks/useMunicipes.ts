import { useState, useEffect } from 'react'
import { supabase, type Municipe } from '@/lib/supabase'

export interface MunicipeWithTags extends Municipe {
  tags?: { id: string; nome: string; cor: string }[]
  total_demandas?: number
}

export const useMunicipes = () => {
  const [municipes, setMunicipes] = useState<MunicipeWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMunicipes = async () => {
    try {
      setLoading(true)
      
      // Buscar munícipes com suas tags
      const { data: municipesData, error: municipesError } = await supabase
        .from('municipes')
        .select(`
          *,
          municipes_tags(
            tag:tags(id, nome, cor)
          )
        `)
        .order('created_at', { ascending: false })

      if (municipesError) throw municipesError

      // Buscar contagem de demandas para cada munícipe
      const { data: demandasCount, error: demandasError } = await supabase
        .from('demandas')
        .select('municipe_id')

      if (demandasError) throw demandasError

      // Processar dados
      const municipesWithData = municipesData?.map(municipe => {
        const tags = municipe.municipes_tags?.map((mt: any) => mt.tag) || []
        const total_demandas = demandasCount?.filter(d => d.municipe_id === municipe.id).length || 0

        return {
          ...municipe,
          tags,
          total_demandas
        }
      }) || []

      setMunicipes(municipesWithData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar munícipes')
    } finally {
      setLoading(false)
    }
  }

  const createMunicipe = async (municipe: Omit<Municipe, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('municipes')
        .insert([municipe])
        .select()
        .single()

      if (error) throw error
      fetchMunicipes() // Recarregar para incluir relações
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar munícipe'
      return { data: null, error: errorMessage }
    }
  }

  const updateMunicipe = async (id: string, updates: Partial<Municipe>) => {
    try {
      const { data, error } = await supabase
        .from('municipes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      fetchMunicipes() // Recarregar para incluir relações
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar munícipe'
      return { data: null, error: errorMessage }
    }
  }

  const deleteMunicipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('municipes')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMunicipes(prev => prev.filter(m => m.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir munícipe'
      return { error: errorMessage }
    }
  }

  const addTagToMunicipe = async (municipeId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('municipes_tags')
        .insert([{ municipe_id: municipeId, tag_id: tagId }])

      if (error) throw error
      fetchMunicipes() // Recarregar para atualizar as tags
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar tag'
      return { error: errorMessage }
    }
  }

  const removeTagFromMunicipe = async (municipeId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('municipes_tags')
        .delete()
        .eq('municipe_id', municipeId)
        .eq('tag_id', tagId)

      if (error) throw error
      fetchMunicipes() // Recarregar para atualizar as tags
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover tag'
      return { error: errorMessage }
    }
  }

  const importFromCSV = async (csvData: any[]) => {
    try {
      // Validar e formatar dados do CSV
      const validData = csvData.filter(row => row.email && row.nome_completo)
      
      const { data, error } = await supabase
        .from('municipes')
        .insert(validData)
        .select()

      if (error) throw error
      fetchMunicipes()
      return { 
        success: data?.length || 0, 
        errors: csvData.length - validData.length, 
        error: null 
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar CSV'
      return { success: 0, errors: csvData.length, error: errorMessage }
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
    deleteMunicipe,
    addTagToMunicipe,
    removeTagFromMunicipe,
    importFromCSV
  }
}