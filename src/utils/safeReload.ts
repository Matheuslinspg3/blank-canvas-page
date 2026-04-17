/**
 * Controlled reload with anti-loop guard.
 * - At most 1 automatic reload per route+session within TTL window.
 * - No reload when offline.
 */
const KEY = "lov_reload_attempted_v1";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ReloadRecord {
  route: string;
  ts: number;
  reason: string;
}

function readRecord(): ReloadRecord | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ReloadRecord;
    if (Date.now() - rec.ts > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export function hasReloadedThisSession(route = window.location.pathname): boolean {
  const rec = readRecord();
  return !!rec && rec.route === route;
}

/**
 * Reloads the page once per route+session. Returns true if a reload was triggered,
 * false if blocked by guard rails (already reloaded, offline, etc.).
 */
export function safeReloadOnce(reason: string): boolean {
  if (typeof window === "undefined") return false;
  if (!navigator.onLine) {
    console.warn("[safeReloadOnce] blocked — offline", { reason });
    return false;
  }
  const route = window.location.pathname;
  if (hasReloadedThisSession(route)) {
    console.warn("[safeReloadOnce] blocked — already reloaded this session", { reason, route });
    return false;
  }
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ route, ts: Date.now(), reason } satisfies ReloadRecord),
    );
  } catch {
    /* sessionStorage might be unavailable in some contexts */
  }
  // Tiny delay so Sentry / logs have a chance to flush.
  setTimeout(() => window.location.reload(), 100);
  return true;
}

export function clearReloadGuard(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
