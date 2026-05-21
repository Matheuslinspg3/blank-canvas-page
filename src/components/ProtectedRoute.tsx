import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useFreeTrialExpired } from "@/hooks/useFreeTrialExpired";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { FreeExpiredScreen } from "@/components/FreeExpiredScreen";
import { PasskeyEnrollmentPrompt } from "@/components/auth/PasskeyEnrollmentPrompt";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, profile, trialInfo } = useAuth();
  const { isDemoMode } = useDemo();
  const { isDeveloperOrLeader, isLoading: rolesLoading } = useUserRoles();
  const { isExpired: freeExpired, loading: freeLoading } = useFreeTrialExpired();
  const { subscription, loadingSub } = useSubscription();
  const location = useLocation();

  // Session guard - limits to 2 devices per user
  useSessionGuard(user?.id);

  // Permitir acesso em modo demo
  if (isDemoMode) {
    return <>{children}</>;
  }

  // Se não estiver carregando e não tiver usuário, redireciona imediatamente
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || rolesLoading || freeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando sua sessão...</p>
        </div>
      </div>
    );
  }

  // Redirect to onboarding if not completed (unless already on onboarding)
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Legacy OAuth users that completed onboarding without choosing a plan:
  // send them to onboarding so the wizard can prompt the plan step.
  if (
    profile?.onboarding_completed &&
    !loadingSub &&
    !subscription &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Free plan 15-day expiry - developers/leaders bypass
  if (freeExpired && !isDeveloperOrLeader) {
    return <FreeExpiredScreen />;
  }

  // Trial expired check (paid plan trial) - developers/leaders bypass
  if (trialInfo?.is_trial_expired && !isDeveloperOrLeader) {
    return <TrialExpiredScreen />;
  }

  return (
    <>
      {children}
      <PasskeyEnrollmentPrompt />
    </>
  );
}
