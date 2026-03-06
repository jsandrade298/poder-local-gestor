import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, Home, FileText, Users } from "lucide-react";
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
];

function BottomNavRep() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around px-2 z-50">
      {repNavItems.map((item) => {
        const isActive = item.path === "/rep"
          ? location.pathname === "/rep"
          : location.pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <button key={item.path} onClick={() => navigate(item.path)}
            className={cn("flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function RepresentanteLayout({ children }: RepresentanteLayoutProps) {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RepresentanteSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 safe-area-top">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="hidden md:flex" />
              <h1 className="text-sm md:text-lg font-semibold text-foreground truncate hidden md:block">
                Portal do Representante
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <div className="hidden md:flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                  {profile?.nome || user?.email}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden md:flex">
                <LogOut className="h-4 w-4 mr-2" />Sair
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="md:hidden h-9 w-9">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-3 md:p-6 bg-muted/20 pb-20 md:pb-6">
            {children}
          </main>
        </div>
        <BottomNavRep />
      </div>
    </SidebarProvider>
  );
}
