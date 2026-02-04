import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  FileText,
  Users,
  Tags,
  Building2,
  UserCheck,
  Settings,
  Home,
  Columns,
  Calendar,
  Bot,
  MessageCircle,
  Target,
  MapPin,
  Layers
} from "lucide-react";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Visão Geral", url: "/", icon: Home },
  { title: "Demandas", url: "/demandas", icon: FileText },
  { title: "Mapa", url: "/mapa", icon: MapPin },
  // Removido: { title: "Mapa Cruzado", url: "/mapa-cruzado", icon: PieChart },
  { title: "Munícipes", url: "/municipes", icon: Users },
  { title: "Kanban", url: "/kanban", icon: Columns },
  { title: "Plano de Ação", url: "/plano-acao", icon: Target },
  { title: "Solicitar Agenda", url: "/solicitar-agenda", icon: Calendar },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
  { title: "Assessor IA", url: "/assessor-ia", icon: Bot },
  { title: "Tags", url: "/tags", icon: Tags },
  { title: "Categorias", url: "/categorias", icon: Layers },
  { title: "Áreas", url: "/areas", icon: Building2 },
  { title: "Usuários", url: "/usuarios", icon: UserCheck },
  { title: "Configurações", url: "/config", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { data: config } = useConfiguracoes();

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = (active: boolean) =>
    active 
      ? "bg-primary text-primary-foreground font-medium" 
      : "hover:bg-accent text-foreground";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <div className="p-4 border-b">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {config?.gabinete?.nome || "Gabinete"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {config?.gabinete?.descricao || "Sistema de Gestão"}
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"}
                      className={getNavCls(isActive(item.url))}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
