import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone?: string
  cargo?: string
  created_at: string
  updated_at: string
}

export const useUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const createUsuario = async (usuario: Omit<Usuario, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .insert([usuario])
        .select()
        .single()

      if (error) throw error
      setUsuarios(prev => [data, ...prev])
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar usuário'
      return { data: null, error: errorMessage }
    }
  }

  const updateUsuario = async (id: string, updates: Partial<Usuario>) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setUsuarios(prev => prev.map(u => u.id === id ? data : u))
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar usuário'
      return { data: null, error: errorMessage }
    }
  }

  const deleteUsuario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id)

      if (error) throw error
      setUsuarios(prev => prev.filter(u => u.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir usuário'
      return { error: errorMessage }
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    createUsuario,
    updateUsuario,
    deleteUsuario
  }
}