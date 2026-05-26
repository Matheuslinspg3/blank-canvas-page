import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

/**
 * Allows access only to admin, sub_admin or developer roles.
 * Used to restrict the credit recharge area.
 */
export function AdminOrDeveloperRoute({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isSubAdmin, isDeveloper, isLoading: rolesLoading } = useUserRoles();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const hasAccess = isAdmin || isSubAdmin || isDeveloper;
  if (!hasAccess) return <Navigate to="/acesso-negado" replace />;

  return <>{children}</>;
}
