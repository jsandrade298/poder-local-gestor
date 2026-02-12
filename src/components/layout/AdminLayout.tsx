import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Building2,
  LogOut,
  Home,
  Shield,
  Users,
  Activity,
  Settings,
  User,
} from "lucide-react";

const adminMenuItems = [
  { title: "Visão Geral", url: "/admin", icon: BarChart3, exact: true },
  // Futuras páginas admin:
  // { title: "Gabinetes", url: "/admin/gabinetes", icon: Building2 },
  // { title: "Usuários", url: "/admin/usuarios", icon: Users },
  // { title: "Análises", url: "/admin/analytics", icon: Activity },
  // { title: "Configurações", url: "/admin/config", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return currentPath === path;
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar Admin */}
      <aside className="w-60 border-r bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Poder Local
              </h2>
              <p className="text-xs text-muted-foreground">
                Painel Administrativo
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {adminMenuItems.map((item) => {
            const active = isActive(item.url, item.exact);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t space-y-2">
          {/* Voltar ao Gabinete */}
          <NavLink
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Voltar ao Gabinete</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 flex items-center justify-between border-b bg-card px-4">
          <h1 className="text-lg font-semibold text-foreground">
            Administração SaaS
          </h1>
          
          <div className="flex items-center gap-4">
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
  );
}
