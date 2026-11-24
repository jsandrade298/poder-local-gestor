import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Home, FileText, Users, Calendar, MapPin } from "lucide-react";
import { MenuUsuario } from "@/components/layout/MenuUsuario";
import { MarcaIcone } from "@/components/marca/Marca";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { RepresentanteSidebar } from "@/components/layout/RepresentanteSidebar";
import { cn } from "@/lib/utils";

interface RepresentanteLayoutProps {
  children: React.ReactNode;
}

const repNavItems = [
  { path: "/rep",           label: "Início",    icon: Home },
  { path: "/rep/demandas",  label: "Demandas",  icon: FileText },
  { path: "/rep/municipes", label: "Munícipes", icon: Users },
  { path: "/rep/agenda",    label: "Agenda",    icon: Calendar },
  { path: "/rep/mapa",      label: "Mapa",      icon: MapPin },
];

function BottomNavRep() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t flex items-center justify-around px-2 z-50 safe-area-bottom">
      {repNavItems.map((item) => {
        const isActive = item.path === "/rep"
          ? location.pathname === "/rep"
          : location.pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <button key={item.path} onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function RepresentanteLayout({ children }: RepresentanteLayoutProps) {
  const { profile, tenant } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RepresentanteSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header melhorado — agora com visual do app principal */}
          <header className="h-14 flex items-center justify-between border-b bg-card/85 backdrop-blur-md px-3 md:px-5 safe-area-top sticky top-0 z-40">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="hidden md:flex" />
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <h1 className="text-sm md:text-lg font-semibold text-foreground truncate">
                  Portal do Representante
                </h1>
                {tenant?.nome && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[200px]">
                    {tenant.nome}
                  </span>
                )}
              </div>
              {/* Mobile: logo compacto */}
              <div className="flex md:hidden items-center gap-2">
                <MarcaIcone className="h-7 w-7" />
                <span className="text-sm font-semibold truncate max-w-[180px]">
                  {profile?.nome?.split(" ")[0] || "Representante"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <MenuUsuario />
            </div>
          </header>
          <main className="flex-1 p-3 md:p-6 lg:p-8 pb-24 md:pb-8">
            {children}
          </main>
        </div>
        <BottomNavRep />
      </div>
    </SidebarProvider>
  );
}
