import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, FileText, Calendar, MapPin, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Início",     url: "/rep",           icon: Home },
  { title: "Demandas",   url: "/rep/demandas",  icon: FileText },
  { title: "Munícipes",  url: "/rep/municipes",  icon: Users },
  { title: "Agenda",     url: "/rep/agenda",     icon: Calendar },
  { title: "Mapa",       url: "/rep/mapa",       icon: MapPin },
];

export function RepresentanteSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { profile, tenant } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo / Branding */}
        <div className={`flex items-center gap-2.5 px-4 py-4 border-b ${collapsed ? "justify-center px-2" : ""}`}>
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <UserCheck className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight">
                {tenant?.nome || "Portal"}
              </p>
              <p className="text-xs text-muted-foreground truncate">Representante</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  item.url === "/rep"
                    ? location.pathname === "/rep"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer com nome do usuário */}
      {!collapsed && profile?.nome && (
        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {profile.nome.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile.nome}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
