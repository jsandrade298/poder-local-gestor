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
      
      // Buscar áreas com estatísticas de demandas
      const { data, error } = await supabase
        .from('areas')
        .select(`
          id,
          nome,
          descricao,
          responsavel_id,
          created_at,
          updated_at
        `)
        .order('nome')

      if (error) throw error

      // Para cada área, buscar estatísticas de demandas
      const areasWithStats = await Promise.all(
        (data || []).map(async (area) => {
          const { count: totalDemandas } = await supabase
            .from('demandas')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', area.id)

          const { count: demandasAtivas } = await supabase
            .from('demandas')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', area.id)
            .in('status', ['aberta', 'em_andamento'])

          return {
            ...area,
            total_demandas: totalDemandas || 0,
            demandas_ativas: demandasAtivas || 0
          }
        })
      )

      setAreas(areasWithStats)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createArea = async (areaData: { nome: string; descricao?: string }) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .insert([areaData])
        .select()

      if (error) throw error

      await fetchAreas() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const updateArea = async (id: string, updates: Partial<AreaWithStats>) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) throw error

      await fetchAreas() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const deleteArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchAreas() // Recarregar lista
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
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
    deleteArea
  }
}