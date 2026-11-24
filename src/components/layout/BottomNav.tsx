import { NavLink, useLocation } from "react-router-dom";
import { Home, FileText, Columns, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";

/**
 * Barra inferior do celular (assessores na rua).
 * As 4 áreas mais usadas + "Nova demanda" sempre a um toque, no centro.
 * As demais telas ficam no menu (botão ☰ no cabeçalho).
 */
const navItems = [
  { title: "Início", url: "/inicio", icon: Home, exact: true },
  { title: "Demandas", url: "/demandas", icon: FileText },
  // posição 2: botão "Nova demanda"
  { title: "Munícipes", url: "/municipes", icon: Users },
  { title: "Quadros", url: "/quadros", icon: Columns },
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    if (path === "/quadros" && location.pathname.startsWith("/kanban")) return true;
    return location.pathname.startsWith(path);
  };

  const renderItem = (item: (typeof navItems)[number]) => {
    const active = isActive(item.url, item.exact);
    return (
      <NavLink
        key={item.url}
        to={item.url}
        className={cn(
          "flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium transition-colors min-w-0 relative",
          "active:scale-95 tap-highlight-transparent",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {active && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
        )}
        <item.icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
        <span className="truncate max-w-full">{item.title}</span>
      </NavLink>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {navItems.slice(0, 2).map(renderItem)}

        {/* Nova demanda — sempre a um toque */}
        <div className="flex flex-1 items-center justify-center min-w-0">
          <NovaDemandaDialog
            trigger={
              <button
                type="button"
                aria-label="Nova demanda"
                className="flex h-11 w-11 -mt-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background active:scale-95 transition-transform"
              >
                <Plus className="h-6 w-6" />
              </button>
            }
          />
        </div>

        {navItems.slice(2).map(renderItem)}
      </div>
    </nav>
  );
}
