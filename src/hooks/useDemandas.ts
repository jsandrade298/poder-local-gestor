import { useState, useEffect } from 'react'
import { supabase, type Demanda, type Area, type Usuario, type Municipe } from '@/lib/supabase'

export interface DemandaWithRelations extends Demanda {
  area?: Area
  responsavel?: Usuario
  municipe?: Municipe
}

export const useDemandas = () => {
  const [demandas, setDemandas] = useState<DemandaWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDemandas = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          *,
          area:areas(*),
          responsavel:usuarios(*),
          municipe:municipes(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDemandas(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
    } finally {
      setLoading(false)
    }
  }

  const createDemanda = async (demanda: Omit<Demanda, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('demandas')
        .insert([demanda])
        .select()
        .single()

      if (error) throw error
      fetchDemandas() // Recarregar para incluir relações
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar demanda'
      return { data: null, error: errorMessage }
    }
  }

  const updateDemanda = async (id: string, updates: Partial<Demanda>) => {
    try {
      const { data, error } = await supabase
        .from('demandas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      fetchDemandas() // Recarregar para incluir relações
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar demanda'
      return { data: null, error: errorMessage }
    }
  }

  const deleteDemanda = async (id: string) => {
    try {
      const { error } = await supabase
        .from('demandas')
        .delete()
        .eq('id', id)

      if (error) throw error
      setDemandas(prev => prev.filter(d => d.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir demanda'
      return { error: errorMessage }
    }
  }

  // Funções auxiliares para dashboard
  const getDemandasPorStatus = () => {
    const statusCount = demandas.reduce((acc, demanda) => {
      acc[demanda.status] = (acc[demanda.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return [
      { name: 'Solicitado', value: statusCount.solicitado || 0, color: '#3b82f6' },
      { name: 'Em Andamento', value: statusCount.em_andamento || 0, color: '#f59e0b' },
      { name: 'Concluído', value: statusCount.concluido || 0, color: '#10b981' },
      { name: 'Não Atendido', value: statusCount.nao_atendido || 0, color: '#ef4444' },
      { name: 'Arquivado', value: statusCount.arquivado || 0, color: '#6b7280' },
    ]
  }

  const getDemandasPorArea = () => {
    const areaCount = demandas.reduce((acc, demanda) => {
      if (demanda.area) {
        acc[demanda.area.nome] = (acc[demanda.area.nome] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    return Object.entries(areaCount).map(([name, demandas]) => ({
      name,
      demandas
    }))
  }

  const getDemandasEnvelhecimento = () => {
    const hoje = new Date()
    const demandas30 = []
    const demandas60 = []
    const demandas90 = []

    for (const demanda of demandas) {
      if (['concluido', 'arquivado'].includes(demanda.status)) continue

      const criadoEm = new Date(demanda.created_at)
      const diasVencido = Math.floor((hoje.getTime() - criadoEm.getTime()) / (1000 * 60 * 60 * 24))

      const demandaInfo = {
        id: demanda.id,
        titulo: demanda.titulo,
        area: demanda.area?.nome || 'Sem área',
        responsavel: demanda.responsavel?.nome || 'Sem responsável',
        diasVencido
      }

      if (diasVencido >= 90) {
        demandas90.push(demandaInfo)
      } else if (diasVencido >= 60) {
        demandas60.push(demandaInfo)
      } else if (diasVencido >= 30) {
        demandas30.push(demandaInfo)
      }
    }

    return { demandas30, demandas60, demandas90 }
  }

  useEffect(() => {
    fetchDemandas()
  }, [])

  return {
    demandas,
    loading,
    error,
    fetchDemandas,
    createDemanda,
    updateDemanda,
    deleteDemanda,
    getDemandasPorStatus,
    getDemandasPorArea,
    getDemandasEnvelhecimento
  }
}