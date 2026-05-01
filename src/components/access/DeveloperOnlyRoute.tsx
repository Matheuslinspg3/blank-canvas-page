import { ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRole";

interface DeveloperOnlyRouteProps {
  children: ReactNode;
  /** Where to redirect non-developers. Defaults to `/dashboard`. */
  redirectTo?: string;
}

/**
 * Route guard that only allows `developer` users through.
 * Non-developers are redirected (default `/dashboard`) with a toast.
 */
export function DeveloperOnlyRoute({
  children,
  redirectTo = "/dashboard",
}: DeveloperOnlyRouteProps) {
  const { isDeveloper, isLoading } = useUserRoles();
  const toastShown = useRef(false);

  const blocked = !isLoading && !isDeveloper;

  useEffect(() => {
    if (blocked && !toastShown.current) {
      toastShown.current = true;
      toast.error("Esse recurso está temporariamente restrito.");
    }
  }, [blocked]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blocked) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
