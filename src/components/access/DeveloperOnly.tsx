import { ReactNode } from "react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface DeveloperOnlyProps {
  /** Stable feature key from DEVELOPER_ONLY_FEATURES. */
  featureKey: string;
  children: ReactNode;
  /** Optional fallback when the user cannot access the feature. */
  fallback?: ReactNode;
}

/**
 * Render `children` only when the current user can access `featureKey`.
 * During role loading, renders the fallback (or nothing) to avoid flicker.
 */
export function DeveloperOnly({ featureKey, children, fallback = null }: DeveloperOnlyProps) {
  const { canAccessFeature } = useFeatureAccess();
  if (!canAccessFeature(featureKey)) return <>{fallback}</>;
  return <>{children}</>;
}
