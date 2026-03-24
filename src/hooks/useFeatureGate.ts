import { useCallback } from "react";
import { useSubscription, getFeatureLimit, hasFeature } from "@/hooks/useSubscription";
import { toast } from "sonner";

export interface FeatureGateResult {
  allowed: boolean;
  limit: number;
  current: number;
  /** Call to show upgrade toast & return false, or return true if allowed */
  guard: () => boolean;
}

/**
 * Hook that checks if the current plan allows a counted feature.
 * Pass `currentCount` (how many the org already has) and it compares against the plan limit.
 */
export function useFeatureGate(featureKey: string, currentCount: number = 0): FeatureGateResult {
  const { currentPlan, isActive } = useSubscription();
  const limit = getFeatureLimit(currentPlan, featureKey);
  const allowed = isActive !== false && (limit === Infinity || currentCount < limit);

  const guard = useCallback(() => {
    if (!allowed) {
      toast.error("Limite do plano atingido", {
        description: `Seu plano permite até ${limit === Infinity ? "∞" : limit} ${featureKey}. Faça upgrade para continuar.`,
      });
      return false;
    }
    return true;
  }, [allowed, limit, featureKey]);

  return { allowed, limit, current: currentCount, guard };
}

/**
 * Hook that checks a boolean feature flag from the plan.
 */
export function useFeatureFlag(featureKey: string): { allowed: boolean; guard: () => boolean } {
  const { currentPlan, isActive } = useSubscription();
  const allowed = isActive !== false && hasFeature(currentPlan, featureKey);

  const guard = useCallback(() => {
    if (!allowed) {
      toast.error("Recurso não disponível", {
        description: `Esse recurso não está incluído no seu plano atual. Faça upgrade para acessar.`,
      });
      return false;
    }
    return true;
  }, [allowed]);

  return { allowed, guard };
}
