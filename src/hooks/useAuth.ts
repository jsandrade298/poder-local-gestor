import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
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

      set({ user: data.user, session: data.session })
      return {}
    } catch (error) {
      return { error: 'Erro inesperado ao fazer login' }
    }
  },

  signUp: async (email: string, password: string, nome: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: nome
          }
        }
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      return { error: 'Erro inesperado ao fazer cadastro' }
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  initialize: async () => {
    console.log('Inicializando autenticação...');
    try {
      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', { event, user: session?.user?.email, hasSession: !!session });
          set({ session, user: session?.user ?? null, loading: false })
        }
      )

      // THEN check for existing session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session inicial:', { user: session?.user?.email, hasSession: !!session });
      set({ session, user: session?.user ?? null, loading: false })
    } catch (error) {
      console.error('Erro na inicialização:', error);
      set({ loading: false })
    }
  },
}))

// Hook para verificar se o usuário está autenticado
export const useAuth = () => {
  const { user, session, loading } = useAuthStore()
  const isAuthenticated = !!user
  console.log('useAuth hook:', { user: user?.email, isAuthenticated, loading });
  return { user, session, loading, isAuthenticated }
}