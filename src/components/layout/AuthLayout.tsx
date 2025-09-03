import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth, useAuthStore } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const isLoginPage = location.pathname === "/login";

  console.log('AuthLayout Debug:', { 
    isAuthenticated, 
    loading, 
    isLoginPage, 
    pathname: location.pathname 
  });

  // Aguardar enquanto carrega
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não está autenticado e não está na página de login, redireciona
  if (!isAuthenticated && !isLoginPage) {
    console.log('Redirecionando para login - não autenticado');
    return <Navigate to="/login" replace />;
  }

  // Se está autenticado e está na página de login, redireciona para dashboard
  if (isAuthenticated && isLoginPage) {
    console.log('Redirecionando para dashboard - já autenticado');
    return <Navigate to="/" replace />;
  }

  if (isLoginPage) {
    console.log('Renderizando página de login');
    return <>{children}</>;
  }

  console.log('Renderizando layout autenticado');
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
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Usuário Admin
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => useAuthStore.getState().signOut()}
              >
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