import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { APP_VERSION } from "@/config/appVersion";

const POLL_INTERVAL = 30_000; // 30s

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

/**
 * Polls /version.json periodically and on every navigation.
 * Disabled entirely on Lovable preview hosts to avoid reload loops
 * (preview serves a different version.json than the compiled APP_VERSION).
 *
 * When a newer version is detected:
 *   1. Sets window.__newVersionAvailable = true
 *   2. Dispatches "sw-update-available" for UpdateBanner
 *   3. On the NEXT navigation, forces a hard reload so the user
 *      always gets the latest assets without Ctrl+Shift+R.
 */
export function useVersionPolling() {
  const location = useLocation();
  const staleRef = useRef(false);
  const checkingRef = useRef(false);

  // Skip entirely on preview hosts — version.json won't match APP_VERSION
  // and would trigger infinite reload loops.
  const disabled = isPreviewHost;

  const checkVersion = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== APP_VERSION) {
        staleRef.current = true;
        window.__newVersionAvailable = true;
        window.dispatchEvent(new CustomEvent("sw-update-available"));
      }
    } catch {
      // Network error — ignore silently
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // Periodic polling
  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkVersion]);

  // On navigation: if stale, hard-reload to pick up new assets
  useEffect(() => {
    if (staleRef.current) {
      // Small delay so the navigation intent is preserved in the URL bar
      window.location.reload();
    }
  }, [location.pathname]);
}
