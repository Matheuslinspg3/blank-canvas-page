import { useCallback } from "react";
import { useUserRoles } from "@/hooks/useUserRole";
import {
  isDeveloperOnlyFeature,
  isDeveloperOnlyRoute,
} from "@/config/featureAccess";

/**
 * Centralized feature access hook.
 *
 * - `developer` users can access everything.
 * - Other roles are blocked from features/routes marked as developer-only.
 * - While roles are loading, restricted content is hidden (no flicker).
 */
export function useFeatureAccess() {
  const { isDeveloper, isLoading } = useUserRoles();

  const canAccessFeature = useCallback(
    (key: string): boolean => {
      if (isLoading) return false;
      if (isDeveloper) return true;
      return !isDeveloperOnlyFeature(key);
    },
    [isDeveloper, isLoading],
  );

  const canAccessRoute = useCallback(
    (path: string): boolean => {
      if (isLoading) return false;
      if (isDeveloper) return true;
      return !isDeveloperOnlyRoute(path);
    },
    [isDeveloper, isLoading],
  );

  return {
    isDeveloper,
    isLoading,
    canAccessFeature,
    canAccessRoute,
  };
}
