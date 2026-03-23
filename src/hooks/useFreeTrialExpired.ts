import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Checks if a user on the free plan has exceeded the 15-day grace period.
 * Returns true if the user should be blocked from using the app.
 */
export function useFreeTrialExpired() {
  const { profile, trialInfo } = useAuth();
  const { subscription, currentPlan, loadingSub } = useSubscription();

  const isExpired = useMemo(() => {
    if (loadingSub) return false;

    // If user has a paid subscription (active, not free), allow
    const slug = currentPlan?.slug ?? "gratuito";
    if (slug !== "gratuito") return false;

    // Check org creation date via trialInfo
    const trialEndsAt = trialInfo?.trial_ends_at;
    if (trialEndsAt) {
      return new Date(trialEndsAt) < new Date();
    }

    // Fallback: no trial info means legacy user, don't block yet
    return false;
  }, [loadingSub, currentPlan, trialInfo]);

  // User qualifies for 25% discount if they're on free plan
  const qualifiesForDiscount = useMemo(() => {
    const slug = currentPlan?.slug ?? "gratuito";
    return slug === "gratuito";
  }, [currentPlan]);

  return { isExpired, qualifiesForDiscount, loading: loadingSub };
}
