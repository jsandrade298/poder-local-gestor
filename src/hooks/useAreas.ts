import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface AreaWithStats {
  id: string
  nome: string
  descricao?: string
  responsavel_id?: string
  created_at: string
  updated_at: string
  total_demandas?: number
  demandas_ativas?: number
}

export const useAreas = () => {
  const [areas, setAreas] = useState<AreaWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAreas = async () => {
    try {
      setLoading(true)
      
      // Buscar áreas
      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('*')
        .order('created_at', { ascending: false })

      if (areasError) throw areasError

      // Buscar estatísticas de demandas para cada área
      const { data: demandasData, error: demandasError } = await supabase
        .from('demandas')
        .select('area_id, status')

      if (demandasError) throw demandasError

      // Processar dados
      const areasWithStats = areasData?.map(area => {
        const areaDemandas = demandasData?.filter(d => d.area_id === area.id) || []
        const total_demandas = areaDemandas.length
        const demandas_ativas = areaDemandas.filter(d => 
          ['solicitado', 'em_andamento'].includes(d.status)
        ).length

        return { ...area, total_demandas, demandas_ativas }
      }) || []

      setAreas(areasWithStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar áreas')
    } finally {
      setLoading(false)
    }
  }

  const createArea = async (area: Omit<Area, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .insert([area])
        .select()
        .single()

      if (error) throw error
      fetchAreas() // Recarregar para incluir estatísticas
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar área'
      return { data: null, error: errorMessage }
    }
  }

  const updateArea = async (id: string, updates: Partial<Area>) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      fetchAreas() // Recarregar para incluir estatísticas
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar área'
      return { data: null, error: errorMessage }
    }
  }

  const deleteArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', id)

      if (error) throw error
      setAreas(prev => prev.filter(a => a.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir área'
      return { error: errorMessage }
    }
  }

  const getDemandasByArea = async (areaId: string) => {
    try {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          municipe:municipes(*),
          responsavel:usuarios(*)
        `)
        .eq('area_id', areaId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar demandas'
      return { data: [], error: errorMessage }
    }
  }

  useEffect(() => {
    fetchAreas()
  }, [])

  return {
    areas,
    loading,
    error,
    fetchAreas,
    createArea,
    updateArea,
    deleteArea,
    getDemandasByArea
  }
}