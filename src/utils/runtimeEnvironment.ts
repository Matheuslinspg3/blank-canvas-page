/**
 * Centralized runtime environment detection.
 * SSR-safe: every `window` access is guarded.
 */

function safeWindow(): Window | null {
  return typeof window !== "undefined" ? window : null;
}

const w = safeWindow();

export const isPreviewHost: boolean = (() => {
  if (!w) return false;
  const h = w.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
})();

export const isInIframe: boolean = (() => {
  if (!w) return false;
  try {
    return w.self !== w.top;
  } catch {
    return true; // cross-origin → assume iframe
  }
})();

export const isProductionBuild: boolean = import.meta.env.MODE === "production";

/**
 * PWA / Service Worker should only run in real production deployments,
 * never in Lovable preview hosts, iframes, or dev builds.
 */
export const isPwaRuntimeEnabled: boolean =
  isProductionBuild && !isInIframe && !isPreviewHost;

export function getServiceWorkerControllerState(): string {
  if (!w || !("serviceWorker" in (w.navigator ?? {}))) return "none";
  return w.navigator.serviceWorker?.controller?.state ?? "none";
}

export function getHostname(): string {
  return w?.location.hostname ?? "unknown";
}

export function getRoute(): string {
  return w?.location.pathname ?? "unknown";
}
