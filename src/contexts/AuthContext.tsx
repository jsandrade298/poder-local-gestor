import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface TenantInfo {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  ativo: boolean;
}

interface ProfileInfo {
  id: string;
  nome: string;
  email: string;
  tenant_id: string | null;
  role_no_tenant: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileLoading: boolean;
  // MULTI-TENANT
  profile: ProfileInfo | null;
  tenant: TenantInfo | null;
  tenantId: string | null;
  roleNoTenant: string | null;
  isTenantAdmin: boolean;
  isSuperAdmin: boolean;
  // Métodos
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const queryClient = useQueryClient();

  const loadProfileAndTenant = async (userId: string) => {
    setProfileLoading(true);
    try {
      // Buscar profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, email, tenant_id, role_no_tenant')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.warn('⚠️ Profile não encontrado:', profileError?.message);
        setProfile(null);
        setTenant(null);
        setIsSuperAdmin(false);
        return;
      }

      setProfile(profileData as ProfileInfo);

      // Buscar tenant
      if (profileData.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id, nome, slug, plano, ativo')
          .eq('id', profileData.tenant_id)
          .single();

        if (tenantData && !tenantError) {
          setTenant(tenantData as TenantInfo);
          console.log('🏢 Tenant carregado:', tenantData.nome);
        } else {
          setTenant(null);
        }
      } else {
        setTenant(null);
      }

      // Verificar superadmin
      const { data: superAdminCheck } = await supabase.rpc('is_superadmin');
      setIsSuperAdmin(superAdminCheck === true);
      if (superAdminCheck === true) {
        console.log('🛡️ Superadmin detectado');
      }
    } catch (err) {
      console.error('Erro ao carregar profile/tenant:', err);
      setProfile(null);
      setTenant(null);
      setIsSuperAdmin(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfileAndTenant(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            loadProfileAndTenant(session.user.id);
          }, 0);
          
          console.log('🔄 Login detectado - invalidando cache de dados');
          queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
          queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
          queryClient.invalidateQueries({ queryKey: ['demandas'] });
          queryClient.invalidateQueries({ queryKey: ['tags'] });
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('🧹 Logout detectado - limpando cache');
          setProfile(null);
          setTenant(null);
          setIsSuperAdmin(false);
          setProfileLoading(true);
          queryClient.clear();
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadProfileAndTenant(session.user.id);
      } else {
        setProfileLoading(false);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } }
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Erro no logout, limpando estado local:', error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setTenant(null);
      setIsSuperAdmin(false);
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
    }
  };

  const value: AuthContextType = {
    user, session, loading, profileLoading,
    profile, tenant,
    tenantId: profile?.tenant_id || null,
    roleNoTenant: profile?.role_no_tenant || null,
    isTenantAdmin: profile?.role_no_tenant === 'admin',
    isSuperAdmin,
    signIn, signUp, signOut, refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
