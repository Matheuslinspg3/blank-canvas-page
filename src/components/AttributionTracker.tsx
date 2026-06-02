import { useAttribution } from "@/hooks/useAttribution";

/**
 * Global attribution tracker.
 * Captures UTM params on any page (landing, auth, etc.) and persists to localStorage.
 * Mount once inside BrowserRouter so useLocation is available.
 */
export function AttributionTracker() {
  useAttribution();
  return null;
}
