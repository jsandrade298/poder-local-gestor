import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, FileText, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepresentanteLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/rep", label: "Início", icon: LayoutDashboard },
  { path: "/rep/municipes", label: "Munícipes", icon: Users },
  { path: "/rep/demandas", label: "Demandas", icon: FileText },
];

export function RepresentanteLayout({ children }: RepresentanteLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Header */}
      <header className="h-14 flex items-center justify-between border-b bg-card px-4 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground hidden sm:block">
              Portal do Representante
            </span>
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((item) => {
              const isActive =
                item.path === "/rep"
                  ? location.pathname === "/rep"
                  : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={cn("gap-2", isActive && "font-semibold")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-[180px]">
            {profile?.nome || user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around px-2 z-50">
        {navItems.map((item) => {
          const isActive =
            item.path === "/rep"
              ? location.pathname === "/rep"
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
