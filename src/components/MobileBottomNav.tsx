import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Home, 
  Settings, 
  Users,
  Calendar
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRoles } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { getSidebarVisibilityFlags } from "@/config/featureAccess";
import { useSidebar } from "@/components/ui/sidebar";

export function MobileBottomNav() {
  const location = useLocation();
  const { data: adLeadsCount = 0 } = useAdLeadsCount();
  const { hasFeature, loadingSub } = useSubscription();
  const { isDeveloper, isLoading: loadingRoles } = useUserRoles();
  const { user, loading: loadingAuth } = useAuth();
  const { setOpenMobile } = useSidebar();
  
  const currentPath = location.pathname;

  const { showAutomations } = getSidebarVisibilityFlags({
    isDeveloper,
    hasFeature,
    isLoadingAuth: loadingAuth,
    isLoadingRoles: loadingRoles,
    isLoadingSubscription: loadingSub,
    hasAuthenticatedUser: !!user,
  });

  const items = [
    { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Imóveis", icon: Home, path: "/imoveis" },
    { label: "CRM", icon: Users, path: "/crm" },
    { label: "Agenda", icon: Calendar, path: "/agenda" },
    { label: "Mais", icon: Settings, onClick: () => setOpenMobile(true) },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-md border-t border-sidebar-border/30 px-2 lg:hidden">
      <div className="flex h-full items-center justify-around max-w-md mx-auto">
        {items.map((item, index) => {
          const isActive = 'path' in item ? currentPath === item.path : false;
          const Content = (
            <div className={`flex flex-col items-center justify-center gap-1 transition-colors relative min-w-[64px] ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {'badge' in item && item.badge && (
                <span className="absolute -top-1 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </div>
          );

          if ('path' in item) {
            return (
              <NavLink key={item.path} to={item.path}>
                {Content}
              </NavLink>
            );
          }

          return (
            <button key={`btn-${index}`} onClick={item.onClick} className="outline-none">
              {Content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}