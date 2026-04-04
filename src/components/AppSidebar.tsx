import React, { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  DollarSign, 
  Calendar, 
  LayoutDashboard,
  LogOut,
  Settings,
  Home,
  Store,
  Plug,
  Code,
  Building2,
  User,
  Zap,
  UserCog,
  Megaphone,
  Search,
  CreditCard,
  Landmark,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { PillBadge } from "@/components/ui/pill-badge";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
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

// ── Sidebar Items ────────────────────────────────────────────

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Imóveis", url: "/imoveis", icon: Home },
  { title: "Proprietários", url: "/proprietarios", icon: Building2 },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Correspondente", url: "/correspondente", icon: Landmark },
  { title: "Marketing", url: "/marketing", icon: Megaphone, badge: true },
];

// ── Component ────────────────────────────────────────────────

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, profile, organizationType } = useAuth();
  const { isDeveloper, isAdminOrAbove } = useUserRoles();
  const currentPath = location.pathname;
...
            <SidebarMenu>
              {mainItems.map(renderMenuItem)}
              {isAdminOrAbove && renderMenuItem({ title: "Automações", url: "/automacoes", icon: Zap })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Gestão (admin+) ── */}
        {isAdminOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItem({ title: "Administração", url: "/administracao", icon: UserCog })}
                {renderMenuItem({ title: "Integrações", url: "/integracoes", icon: Plug })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Sistema ── */}
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

        {/* ── Developer ── */}
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
                variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                icon={organizationType === 'imobiliaria' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                className="mt-2"
              >
                {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
              </PillBadge>
            )}
            {orgName && (
              <p className="text-xs text-muted-foreground truncate mt-1">{orgName}</p>
            )}
          </div>
        )}
        {collapsed && organizationType && (
          <div className="flex justify-center mb-2">
            {organizationType === 'imobiliaria' ? (
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
