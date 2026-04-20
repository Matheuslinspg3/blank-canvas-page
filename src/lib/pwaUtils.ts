/**
 * PWA utility helpers for diagnostics and repair.
 */

export interface PwaDiagnostics {
  displayMode: "standalone" | "browser" | "twa" | "unknown";
  swActive: string | null;
  swWaiting: boolean;
  swScope: string | null;
  manifestUrl: string | null;
  buildVersion: string | null;
  cacheNames: string[];
}

/** Detect current display mode */
export function getDisplayMode(): PwaDiagnostics["displayMode"] {
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if ((navigator as any).standalone === true) return "standalone"; // iOS
  if (document.referrer.includes("android-app://")) return "twa";
  return "browser";
}

/** Gather full PWA diagnostics */
export async function getPwaDiagnostics(): Promise<PwaDiagnostics> {
  const diag: PwaDiagnostics = {
    displayMode: getDisplayMode(),
    swActive: null,
    swWaiting: false,
    swScope: null,
    manifestUrl: null,
    buildVersion: null,
    cacheNames: [],
  };

  // SW info
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      diag.swActive = reg.active?.scriptURL ?? null;
      diag.swWaiting = !!reg.waiting;
      diag.swScope = reg.scope;
    }
  }

  // Manifest link
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  diag.manifestUrl = link?.href ?? null;

  // Build version from version.json
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      diag.buildVersion = data.version ?? null;
    }
  } catch { /* ignore */ }

  // Cache names
  if ("caches" in window) {
    try {
      diag.cacheNames = await caches.keys();
    } catch { /* ignore */ }
  }

  return diag;
}

/** Full PWA repair: clears caches, unregisters SW, clears storage, then reloads */
export async function repairPwa(): Promise<{ cleared: number; unregistered: number }> {
  let cleared = 0;
  let unregistered = 0;

  // 1. Clear ALL caches (including precache)
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        const ok = await caches.delete(key);
        if (ok) cleared++;
      }
    } catch { /* ignore */ }
  }

  // 2. Unregister ALL service workers (forces full re-fetch on next load)
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        // Try to skip waiting first, then unregister
        if (reg.waiting) {
          try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ }
        }
        const ok = await reg.unregister();
        if (ok) unregistered++;
      }
    } catch { /* ignore */ }
  }

  // 3. Clear sessionStorage (preserve localStorage to keep auth/session)
  try {
    sessionStorage.clear();
  } catch { /* ignore */ }

  // 4. Hard reload after a short delay so the user sees the toast
  setTimeout(() => {
    window.location.reload();
  }, 1500);

  return { cleared, unregistered };
}
