import { ReactNode } from "react";
import { useFeatureGate, useFeatureFlag } from "@/hooks/useFeatureGate";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  /** For counted limits (max_own_properties, max_leads, etc.) */
  featureKey: string;
  currentCount?: number;
  children: ReactNode;
  /** Fallback UI when blocked. If not provided, shows default upgrade card. */
  fallback?: ReactNode;
}

export function FeatureGate({ featureKey, currentCount = 0, children, fallback }: FeatureGateProps) {
  const { allowed, limit, loading } = useFeatureGate(featureKey, currentCount);

  if (loading) return null;

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <UpgradeCard limit={limit} featureKey={featureKey} />;
}

interface FeatureFlagGateProps {
  /** For boolean features (has_contracts, has_financial, etc.) */
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlagGate({ featureKey, children, fallback }: FeatureFlagGateProps) {
  const { allowed, loading } = useFeatureFlag(featureKey);

  if (loading) return null;

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <UpgradeCard featureKey={featureKey} />;
}

function UpgradeCard({ limit, featureKey }: { limit?: number; featureKey: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border border-border bg-muted/50 text-center">
      <Lock className="h-10 w-10 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-semibold text-foreground">Recurso bloqueado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {limit !== undefined
            ? `Seu plano permite até ${limit === Infinity ? "∞" : limit} itens. Faça upgrade para continuar.`
            : "Esse recurso não está incluído no seu plano atual."}
        </p>
      </div>
      <Button onClick={() => navigate("/planos")} variant="default">
        Ver planos
      </Button>
    </div>
  );
}
