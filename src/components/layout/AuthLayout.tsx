import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { HelpChatWidget } from "@/components/layout/HelpChatWidget";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { RepresentanteLayout } from "@/components/layout/RepresentanteLayout";
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
  const isPublicPage = location.pathname === "/site";
  const isConvitePage = location.pathname === "/convite";
  const isRepArea = location.pathname.startsWith("/rep");
  const { user, loading, profileLoading, isSuperAdmin, roleNoTenant, signOut } = useAuth();
  
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

  // ========== PÁGINA PÚBLICA (landing page) ==========
  if (isPublicPage) {
    return <>{children}</>;
  }

  // ========== PÁGINA DE CONVITE (representante) ==========
  if (isConvitePage) {
    return <>{children}</>;
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
      // Representante → portal próprio
      if (roleNoTenant === "representante") {
        return <Navigate to="/rep" replace />;
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

  // ========== ÁREA REPRESENTANTE (layout próprio) ==========
  if (isRepArea) {
    if (profileLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      );
    }
    // Apenas representantes podem acessar /rep
    if (roleNoTenant !== "representante") {
      return <Navigate to="/" replace />;
    }
    return <RepresentanteLayout>{children}</RepresentanteLayout>;
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
  // Representante não pode acessar o gabinete
  if (roleNoTenant === "representante") {
    return <Navigate to="/rep" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 safe-area-top">
            <div className="flex items-center gap-2 min-w-0">
              {/* No mobile, esconder o trigger pois temos o BottomNav */}
              <SidebarTrigger className="hidden md:flex" />
              <h1 className="text-sm md:text-lg font-semibold text-foreground truncate hidden md:block">
                Sistema de Gestão do Gabinete
              </h1>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <NotificationsDropdown />
              {/* No mobile, ocultar nome e email para economizar espaço */}
              <div className="hidden md:flex items-center gap-2">
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
                className="hidden md:flex"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
              {/* No mobile, botão compacto de logout */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={async () => {
                  await signOut();
                  window.location.href = '/login';
                }}
                className="md:hidden h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* pb-16 no mobile para não ficar atrás do BottomNav */}
          <main className="flex-1 p-3 md:p-6 bg-muted/20 pb-20 md:pb-6">
            {children}
          </main>
        </div>

        {/* Bottom Navigation - apenas mobile */}
        <BottomNav />

        {/* Chat de ajuda flutuante */}
        <HelpChatWidget />
      </div>
    </SidebarProvider>
  );
}
