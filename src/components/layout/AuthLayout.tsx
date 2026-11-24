import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { HelpChatWidget } from "@/components/layout/HelpChatWidget";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatusMonitor } from "@/hooks/useDemandaStatusMonitor";
import { useDemandaNotificationSender } from "@/hooks/useDemandaNotificationSender";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import { MenuUsuario } from "@/components/layout/MenuUsuario";
import { MarcaIcone } from "@/components/marca/Marca";
import { lazy, Suspense } from "react";

// Layouts usados só por representantes e pelo super admin: carregam à parte
const RepresentanteLayout = lazy(() => import("@/components/layout/RepresentanteLayout").then((m) => ({ default: m.RepresentanteLayout })));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })));

/** Tela inicial do app depois do login (a raiz "/" é a apresentação). */
export const INICIO_APP = "/inicio";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/** Nome do gabinete no cabeçalho. Componente próprio para só consultar após o login. */
function NomeGabinete() {
  const { data: config } = useConfiguracoes();
  return (
    <div className="min-w-0 leading-tight">
      <p className="texto-etiqueta text-[9.5px] text-muted-foreground hidden sm:block">Gabinete</p>
      <h1 className="text-sm md:text-[15px] font-semibold text-foreground truncate">
        {config?.gabinete?.nome || "Gabinete"}
      </h1>
    </div>
  );
}

/** Carregamento entre telas de acesso, com o símbolo da marca. */
function TelaCarregando({ texto }: { texto: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
      <div className="text-center">
        <MarcaIcone className="h-14 w-14 mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isChooserPage = location.pathname === "/escolher";
  const isAdminArea = location.pathname.startsWith("/admin");
  const isLandingPage = location.pathname === "/";
  const isSiteAntigo = location.pathname === "/site";
  const isConvitePage = location.pathname === "/convite";
  const isRepArea = location.pathname.startsWith("/rep");
  const { user, loading, profileLoading, isSuperAdmin, roleNoTenant } = useAuth();
  
  // Ativar monitor de status de demandas apenas se autenticado e no gabinete
  useDemandaStatusMonitor();
  useDemandaNotificationSender();

  // Loading de autenticação
  if (loading) {
    return (
      <TelaCarregando texto="Abrindo o Jorgeus…" />
    );
  }

  // ========== APRESENTAÇÃO (raiz "/") ==========
  // Quem já entrou vai direto para o app; os demais veem a apresentação.
  if (isSiteAntigo) {
    return <Navigate to="/" replace />;
  }
  if (isLandingPage) {
    if (user) {
      if (profileLoading) return <TelaCarregando texto="Abrindo o Jorgeus…" />;
      if (isSuperAdmin) return <Navigate to="/escolher" replace />;
      if (roleNoTenant === "representante") return <Navigate to="/rep" replace />;
      return <Navigate to={INICIO_APP} replace />;
    }
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
          <TelaCarregando texto="Carregando perfil…" />
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
      return <Navigate to={INICIO_APP} replace />;
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
      return <Navigate to={INICIO_APP} replace />;
    }
    return <>{children}</>;
  }

  // ========== ÁREA REPRESENTANTE (layout próprio) ==========
  if (isRepArea) {
    if (profileLoading) {
      return (
        <TelaCarregando texto="Carregando…" />
      );
    }
    // Apenas representantes podem acessar /rep
    if (roleNoTenant !== "representante") {
      return <Navigate to={INICIO_APP} replace />;
    }
    return <Suspense fallback={<TelaCarregando texto="Carregando…" />}><RepresentanteLayout>{children}</RepresentanteLayout></Suspense>;
  }

  // ========== ÁREA ADMIN (layout próprio) ==========
  if (isAdminArea) {
    // Só superadmin pode acessar
    if (profileLoading) {
      return (
        <TelaCarregando texto="Verificando permissões…" />
      );
    }
    if (!isSuperAdmin) {
      return <Navigate to={INICIO_APP} replace />;
    }
    return <Suspense fallback={<TelaCarregando texto="Carregando…" />}><AdminLayout>{children}</AdminLayout></Suspense>;
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
          <header className="h-14 flex items-center justify-between gap-2 border-b bg-card/85 backdrop-blur-md px-2 md:px-5 safe-area-top sticky top-0 z-40">
            <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
              {/* Menu completo: no celular é o único acesso às telas fora da barra inferior */}
              <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground" aria-label="Abrir menu" />
              <MarcaIcone className="h-7 w-7 md:hidden" />
              <span className="hidden md:block h-6 w-px bg-border" aria-hidden />
              <NomeGabinete />
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <NotificationsDropdown />
              <MenuUsuario />
            </div>
          </header>

          {/* pb-16 no mobile para não ficar atrás do BottomNav */}
          <main className="flex-1 p-3 md:p-6 lg:p-8 pb-24 md:pb-8">
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
