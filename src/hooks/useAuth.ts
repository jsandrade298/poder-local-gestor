import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error: error.message }
      }

      set({ user: data.user })
      return {}
    } catch (error) {
      return { error: 'Erro inesperado ao fazer login' }
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user ?? null, loading: false })

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        set({ user: session?.user ?? null, loading: false })
      })
    } catch (error) {
      set({ loading: false })
    }
  },
}))

// Hook para verificar se o usuário está autenticado
export const useAuth = () => {
  const { user, loading } = useAuthStore()
  return { user, loading, isAuthenticated: !!user }
}