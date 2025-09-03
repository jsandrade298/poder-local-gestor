import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface TagWithCount {
  id: string
  nome: string
  cor: string
  created_at: string
  updated_at: string
  total_municipes?: number
}

export const useTags = () => {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTags = async () => {
    try {
      setLoading(true)
      
      // Buscar tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false })

      if (tagsError) throw tagsError

      // Buscar contagem de munícipes para cada tag
      const { data: municipesCount, error: countError } = await supabase
        .from('municipes_tags')
        .select('tag_id')

      if (countError) throw countError

      // Processar dados
      const tagsWithCount = tagsData?.map(tag => {
        const total_municipes = municipesCount?.filter(mt => mt.tag_id === tag.id).length || 0
        return { ...tag, total_municipes }
      }) || []

      setTags(tagsWithCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tags')
    } finally {
      setLoading(false)
    }
  }

  const createTag = async (tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert([tag])
        .select()
        .single()

      if (error) throw error
      fetchTags() // Recarregar para incluir contagem
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar tag'
      return { data: null, error: errorMessage }
    }
  }

  const updateTag = async (id: string, updates: Partial<Tag>) => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      fetchTags() // Recarregar para incluir contagem
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar tag'
      return { data: null, error: errorMessage }
    }
  }

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTags(prev => prev.filter(t => t.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir tag'
      return { error: errorMessage }
    }
  }

  const getMunicipesByTag = async (tagId: string) => {
    try {
      const { data, error } = await supabase
        .from('municipes_tags')
        .select(`
          municipe:municipes(*)
        `)
        .eq('tag_id', tagId)

      if (error) throw error
      return { data: data?.map(item => item.municipe) || [], error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar munícipes'
      return { data: [], error: errorMessage }
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  return {
    tags,
    loading,
    error,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    getMunicipesByTag
  }
}