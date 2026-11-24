import { NavLink, useLocation } from "react-router-dom";
import { MenuUsuario } from "@/components/layout/MenuUsuario";
import { MarcaIcone, MarcaPalavra } from "@/components/marca/Marca";
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

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return currentPath === path;
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar Admin */}
      <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <MarcaIcone className="h-8 w-8" />
            <div className="min-w-0">
              <MarcaPalavra className="h-[13px]" />
              <p className="texto-etiqueta text-[9.5px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1"><Shield className="h-3 w-3" /> Admin SaaS</p>
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
            to="/inicio"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Voltar ao Gabinete</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 flex items-center justify-between border-b bg-card/85 backdrop-blur-md px-5 sticky top-0 z-40">
          <h1 className="text-lg font-semibold text-foreground">
            Administração SaaS
          </h1>
          
          <MenuUsuario />
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
