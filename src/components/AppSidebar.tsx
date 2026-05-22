import React from "react";
import * as Sentry from "@sentry/react";
import {
  Users,
  DollarSign,
  Calendar,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Settings,
  Home,
  Store,
  Plug,
  Code,
  Smartphone,
  Building2,
  User,
  Zap,
  UserCog,
  Megaphone,
  Search,
  CreditCard,
  Landmark,
  Globe,
  Inbox as InboxIcon,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { PillBadge } from "@/components/ui/pill-badge";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { useSetupPendingCount } from "@/components/developer/SetupChecklistTab";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: boolean;
  developerOnly?: boolean;
};

const mainItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Métricas", url: "/metricas", icon: BarChart3 },
  { title: "Imóveis", url: "/imoveis", icon: Home },
  { title: "Proprietários", url: "/proprietarios", icon: Building2 },

  { title: "CRM", url: "/crm", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Correspondente", url: "/correspondente", icon: Landmark, developerOnly: true },
  { title: "Marketing", url: "/marketing", icon: Megaphone, badge: true },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, profile, organizationType } = useAuth();
  const { isDeveloper, isAdminOrAbove, isLoading: rolesLoading } = useUserRoles();
  const { hasFeature, loadingSub } = useSubscription();
  const currentPath = location.pathname;
  const { data: newAdLeadsCount = 0 } = useAdLeadsCount();
  const setupPending = useSetupPendingCount();

  const { shouldShowMyWhatsApp, shouldShowAutomations } = getSidebarVisibilityFlags({
    isDeveloper,
    hasWhatsAppFeature: hasFeature("has_whatsapp"),
    hasAutomationsFeature: hasFeature("has_automations"),
    rolesLoading,
    subscriptionLoading: loadingSub,
    hasAuthenticatedUser: !!user,
  });

  const [orgName, setOrgName] = React.useState<string>("");

  React.useEffect(() => {
    if (!profile?.organization_id) return;

    const load = async () => {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id!)
        .maybeSingle();

      if (error) {
        Sentry.captureException(error, { tags: { module: "AppSidebar", action: "load_organization" } });
      }

      if (data?.name) setOrgName(data.name);
    };

    load();
  }, [profile?.organization_id]);

  const isActive = (path: string) => currentPath.startsWith(path);

  const prevPath = React.useRef(currentPath);
  React.useEffect(() => {
    if (isMobile && currentPath !== prevPath.current) {
      setOpenMobile(false);
    }
    prevPath.current = currentPath;
  }, [currentPath, isMobile, setOpenMobile]);

  const renderMenuItem = (item: {
    title: string;
    url: string;
    icon: React.ElementType;
    badge?: boolean;
    badgeCount?: number;
  }) => {
    const active = isActive(item.url);
    const count = item.badgeCount ?? (item.badge ? newAdLeadsCount : 0);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.title}
          className={active ? "bg-sidebar-accent border-l-2 border-primary" : ""}
        >
          <NavLink
            to={item.url}
            className="flex items-center gap-3"
            activeClassName="text-primary font-medium"
            
            aria-label={`Ir para ${item.title}`}
          >
            <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
            <span>{item.title}</span>
            {count > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                {count}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-sidebar backdrop-blur-xl">
      <SidebarHeader className="p-4 space-y-3">
        <a href="/dashboard" className="block cursor-pointer">
          {collapsed ? (
            <HabitaeLogo variant="icon" size="sm" />
          ) : (
            <HabitaeLogo variant="horizontal" size="md" />
          )}
        </a>

        {!collapsed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground font-normal h-9"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
              );
            }}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Buscar...</span>
            <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter((item) => isDeveloper || !item.developerOnly)
                .map(renderMenuItem)}
              {shouldShowMyWhatsApp &&
                renderMenuItem({ title: "Meu WhatsApp", url: "/whatsapp/meu-canal", icon: Smartphone })}
              {shouldShowAutomations &&
                renderMenuItem({ title: "Automações", url: "/automacoes", icon: Zap })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdminOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(isDeveloper || hasFeature("has_brand_settings")) &&
                  renderMenuItem({ title: "Meu Site", url: "/site", icon: Globe })}
                {(isDeveloper || hasFeature("has_whatsapp")) &&
                  renderMenuItem({ title: "Canais da Equipe", url: "/whatsapp/canais-equipe", icon: Smartphone })}
                {renderMenuItem({ title: "Administração", url: "/administracao", icon: UserCog })}
                {renderMenuItem({ title: "Integrações", url: "/integracoes", icon: Plug })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdminOrAbove && renderMenuItem({ title: "Meu Plano", url: "/meu-plano", icon: CreditCard })}
              {renderMenuItem({ title: "Configurações", url: "/configuracoes", icon: Settings })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isDeveloper && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Developer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItem({ title: "Developer", url: "/developer", icon: Code, badgeCount: setupPending })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.user_metadata?.full_name || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {organizationType && (
              <PillBadge
                size="sm"
                variant={organizationType === "imobiliaria" ? "warning" : "muted"}
                icon={organizationType === "imobiliaria" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                className="mt-2"
              >
                {organizationType === "imobiliaria" ? "Imobiliária" : "Corretor Individual"}
              </PillBadge>
            )}
            {orgName && (
              <p className="text-xs text-muted-foreground truncate mt-1">{orgName}</p>
            )}
          </div>
        )}

        {collapsed && organizationType && (
          <div className="flex justify-center mb-2">
            {organizationType === "imobiliaria" ? (
              <Building2 className="h-4 w-4 text-accent" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button
            variant="ghost"
            className="flex-1 justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={signOut}
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}


type SidebarVisibilityInputs = {
  isDeveloper: boolean;
  hasWhatsAppFeature: boolean;
  hasAutomationsFeature: boolean;
  rolesLoading: boolean;
  subscriptionLoading: boolean;
  hasAuthenticatedUser: boolean;
};

export function getSidebarVisibilityFlags({
  isDeveloper,
  hasWhatsAppFeature,
  hasAutomationsFeature,
  rolesLoading,
  subscriptionLoading,
  hasAuthenticatedUser,
}: SidebarVisibilityInputs) {
  const canAccessMyWhatsApp = isDeveloper || hasWhatsAppFeature;
  const canAccessAutomations = isDeveloper || hasAutomationsFeature;

  // Guardrail: keep nav structure stable while auth/subscription/roles are hydrating
  // after updates/reloads. Loading is not equal to "no permission", but only for
  // authenticated sessions.
  const keepVisibleDuringLoading = hasAuthenticatedUser && (rolesLoading || subscriptionLoading);

  return {
    shouldShowMyWhatsApp: canAccessMyWhatsApp || keepVisibleDuringLoading,
    shouldShowAutomations: canAccessAutomations || keepVisibleDuringLoading,
  };
}
