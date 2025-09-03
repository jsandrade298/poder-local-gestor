import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface DemandaWithRelations {
  id: string
  protocolo: string
  titulo: string
  descricao: string
  status: 'aberta' | 'em_andamento' | 'aguardando' | 'resolvida' | 'cancelada'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  municipe_id: string
  area_id?: string
  responsavel_id?: string
  criado_por: string
  data_prazo?: string
  resolucao?: string
  created_at: string
  updated_at: string
  area?: { id: string; nome: string }
  responsavel?: { id: string; nome: string }
  municipe?: { id: string; nome: string }
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
          id,
          protocolo,
          titulo,
          descricao,
          status,
          prioridade,
          municipe_id,
          area_id,
          responsavel_id,
          criado_por,
          data_prazo,
          resolucao,
          created_at,
          updated_at,
          areas!demandas_area_id_fkey (id, nome),
          municipes!demandas_municipe_id_fkey (id, nome)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const demandasFormatted = (data || []).map(demanda => ({
        ...demanda,
        area: demanda.areas ? { id: demanda.areas.id, nome: demanda.areas.nome } : undefined,
        municipe: demanda.municipes ? { id: demanda.municipes.id, nome: demanda.municipes.nome } : undefined,
        responsavel: undefined // Temporariamente undefined até implementarmos profiles
      }))

      setDemandas(demandasFormatted as any)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createDemanda = async (demandaData: {
    titulo: string
    descricao: string
    municipe_id: string
    area_id?: string
    prioridade?: 'baixa' | 'media' | 'alta' | 'urgente'
    data_prazo?: string
  }) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.user) throw new Error('Usuário não autenticado')

      // Protocolo será gerado automaticamente pelo trigger
      const { data, error } = await supabase
        .from('demandas')
        .insert([{
          titulo: demandaData.titulo,
          descricao: demandaData.descricao,
          municipe_id: demandaData.municipe_id,
          area_id: demandaData.area_id,
          prioridade: demandaData.prioridade || 'media',
          criado_por: session.session.user.id,
          status: 'aberta' as const,
          protocolo: '' // Será preenchido pelo trigger
        }])
        .select()

      if (error) throw error

      await fetchDemandas() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const updateDemanda = async (id: string, updates: Partial<DemandaWithRelations>) => {
    try {
      const { data, error } = await supabase
        .from('demandas')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) throw error

      await fetchDemandas() // Recarregar lista
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  const deleteDemanda = async (id: string) => {
    try {
      const { error } = await supabase
        .from('demandas')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchDemandas() // Recarregar lista
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
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
    deleteDemanda
  }
}