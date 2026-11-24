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
  Layers,
  Shield,
  PieChart,
  LineChart as LineChartIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURES } from "@/lib/featureFlags";
import { cn } from "@/lib/utils";
import { MarcaIcone, MarcaPalavra } from "@/components/marca/Marca";
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

type MenuItem = { title: string; url: string; icon: typeof Home; enabled?: boolean };
type MenuGroup = { label: string | null; items: MenuItem[] };

/**
 * Menu em grupos (revisão de navegação, Fase 2):
 *   Início · Atendimento · Análises · Gabinete
 * Itens com `enabled: false` ficam ocultos (ver src/lib/featureFlags.ts).
 */
const allGroups: MenuGroup[] = [
  {
    label: null,
    items: [{ title: "Início", url: "/inicio", icon: Home }],
  },
  {
    label: "Atendimento",
    items: [
      { title: "Demandas", url: "/demandas", icon: FileText },
      { title: "Munícipes", url: "/municipes", icon: Users },
      { title: "Quadros", url: "/quadros", icon: Columns },
      { title: "Agenda", url: "/solicitar-agenda", icon: Calendar },
      { title: "Mapa", url: "/mapa", icon: MapPin },
      { title: "Plano de Ação", url: "/plano-acao", icon: Target, enabled: FEATURES.planoAcao },
      { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle, enabled: FEATURES.disparosWhatsApp },
      { title: "Assessor IA", url: "/assessor-ia", icon: Bot, enabled: FEATURES.assessorIA },
    ],
  },
  {
    label: "Análises",
    items: [
      { title: "Análises", url: "/analises", icon: LineChartIcon },
      { title: "Visão geral", url: "/visao-geral", icon: BarChart3, enabled: FEATURES.visaoGeral },
      { title: "Balanço de Demandas", url: "/balanco-demandas", icon: PieChart, enabled: FEATURES.balancoDemandas },
    ],
  },
  {
    label: "Gabinete",
    items: [
      { title: "Usuários", url: "/usuarios", icon: UserCheck },
      { title: "Tags", url: "/tags", icon: Tags },
      { title: "Categorias", url: "/categorias", icon: Layers },
      { title: "Áreas", url: "/areas", icon: Building2 },
      { title: "Configurações", url: "/config", icon: Settings },
    ],
  },
];

const menuGroups = allGroups
  .map((g) => ({ ...g, items: g.items.filter((i) => i.enabled !== false) }))
  .filter((g) => g.items.length > 0);

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const currentPath = location.pathname;
  const { isSuperAdmin } = useAuth();

  const isActive = (path: string) => {
    // Os quadros de equipe e pessoal ainda abrem na tela /kanban
    if (path === "/quadros" && currentPath.startsWith("/kanban")) return true;
    return currentPath.startsWith(path);
  };

  const getNavCls = (active: boolean) =>
    cn(
      "relative transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
    );

  // No celular, fechar o menu ao escolher uma tela
  const aoNavegar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        {/* Marca Jorgeus (o nome do gabinete fica no cabeçalho) */}
        <div className={cn("flex items-center h-14 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
          <MarcaIcone className={collapsed ? "h-8 w-8" : "h-8 w-8 shrink-0"} />
          {!collapsed && <MarcaPalavra className="h-[15px]" />}
        </div>

        {menuGroups.map((group, gi) => (
          <SidebarGroup key={group.label ?? `grupo-${gi}`} className={group.label ? "py-1" : "pt-2 pb-0"}>
            {group.label && (
              <SidebarGroupLabel className={collapsed ? "sr-only" : "texto-etiqueta text-[10px] text-sidebar-foreground/55"}>
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined} className="h-9 rounded-lg">
                      <NavLink
                        to={item.url}
                        end={item.url === "/inicio"}
                        className={getNavCls(isActive(item.url))}
                        onClick={aoNavegar}
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
        ))}

        {/* Link para Admin SaaS — só para superadmin */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? "sr-only" : "texto-etiqueta text-[10px] text-sidebar-foreground/55"}>
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-9 rounded-lg">
                    <NavLink
                      to="/admin"
                      onClick={aoNavegar}
                      className={cn(getNavCls(isActive("/admin")), "border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15")}
                    >
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      {!collapsed && <span className="text-amber-700 dark:text-amber-400 font-medium">Admin SaaS</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
