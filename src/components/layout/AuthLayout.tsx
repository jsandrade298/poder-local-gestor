import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { Button } from "@/components/ui/button";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatusMonitor } from "@/hooks/useDemandaStatusMonitor";
import { useDemandaNotificationSender } from "@/hooks/useDemandaNotificationSender";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LogOut, User } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isChooserPage = location.pathname === "/escolher";
  const isAdminArea = location.pathname.startsWith("/admin");
  const { user, loading, profileLoading, isSuperAdmin, signOut } = useAuth();
  
  // Ativar monitor de status de demandas apenas se autenticado e no gabinete
  useDemandaStatusMonitor();
  useDemandaNotificationSender();

  // Loading de autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // ========== PÁGINA DE LOGIN ==========
  if (isLoginPage) {
    if (user) {
      // Logado → aguardar profile carregar para decidir destino
      if (profileLoading) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando perfil...</p>
            </div>
          </div>
        );
      }
      // Superadmin → tela de escolha
      if (isSuperAdmin) {
        return <Navigate to="/escolher" replace />;
      }
      // Usuário normal → gabinete
      return <Navigate to="/" replace />;
    }
    // Não logado → mostrar formulário de login
    return <>{children}</>;
  }

  // ========== PÁGINAS PROTEGIDAS (requer autenticação) ==========
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ========== TELA DE ESCOLHA (superadmin) ==========
  if (isChooserPage) {
    // Só superadmin pode acessar
    if (!profileLoading && !isSuperAdmin) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // ========== ÁREA ADMIN (layout próprio) ==========
  if (isAdminArea) {
    // Só superadmin pode acessar
    if (profileLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      );
    }
    if (!isSuperAdmin) {
      return <Navigate to="/" replace />;
    }
    return <AdminLayout>{children}</AdminLayout>;
  }

  // ========== GABINETE (layout padrão com sidebar) ==========
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground">
                Sistema de Gestão do Gabinete
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationsDropdown />
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {user?.user_metadata?.full_name || user?.email}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  await signOut();
                  window.location.href = '/login';
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
