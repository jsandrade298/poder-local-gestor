import { NavLink, useLocation } from "react-router-dom";
import { Home, FileText, Columns, MapPin, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Início", url: "/", icon: Home, exact: true },
  { title: "Demandas", url: "/demandas", icon: FileText },
  { title: "Kanban", url: "/kanban", icon: Columns },
  { title: "Mapa", url: "/mapa", icon: MapPin },
];

export function BottomNav() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {navItems.map((item) => {
          const active = isActive(item.url, item.exact);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium transition-colors min-w-0 relative",
                "active:scale-95 tap-highlight-transparent",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <item.icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
              <span className="truncate max-w-full">{item.title}</span>
            </NavLink>
          );
        })}

        {/* Botão "Mais" que abre o sidebar/drawer */}
        <button
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium transition-colors min-w-0",
            "active:scale-95 tap-highlight-transparent",
            "text-muted-foreground"
          )}
        >
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
