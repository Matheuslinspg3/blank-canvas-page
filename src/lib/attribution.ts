const ATTRIBUTION_STORAGE_KEY = "porta_attribution_context_v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 90;
const CONSENT_KEY = "porta_analytics_consent";

const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "fbp", "fbc"] as const;
export type AttributionKey = typeof ATTR_KEYS[number];
export type AttributionContext = Partial<Record<AttributionKey, string>> & {
  landing_page?: string;
  referrer?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  current_url?: string;
  session_id?: string;
  anonymous_id?: string;
  consent_state?: "granted" | "denied" | null;
};

const canUseDom = () => typeof window !== "undefined" && typeof localStorage !== "undefined";
const nowIso = () => new Date().toISOString();
const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random()}`;

const parseStored = (): AttributionContext | null => {
  if (!canUseDom()) return null;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionContext;
    if (!parsed.first_seen_at || Date.now() - new Date(parsed.first_seen_at).getTime() > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export function captureAttributionFromUrl(): AttributionContext | null {
  if (!canUseDom()) return null;
  const url = new URL(window.location.href);
  const stored = parseStored();
  const base: AttributionContext = stored ?? {
    first_seen_at: nowIso(),
    landing_page: url.pathname + url.search,
    referrer: document.referrer || null || undefined,
    session_id: createId(),
    anonymous_id: createId(),
  };

  const next: AttributionContext = {
    ...base,
    current_url: url.href,
    last_seen_at: nowIso(),
    consent_state: (localStorage.getItem(CONSENT_KEY) as AttributionContext["consent_state"]) ?? null,
  };

  for (const key of ATTR_KEYS) {
    const value = url.searchParams.get(key);
    if (value) next[key] = value;
  }

  localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getAttributionContext(): AttributionContext | null {
  return parseStored();
}

export function clearAttributionContext() {
  if (canUseDom()) localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
}

export function buildAttributionPayload() {
  const ctx = getAttributionContext();
  return { attribution_context: ctx, ...ctx };
}

export function createEventId(eventName: string) {
  return `${eventName}_${createId()}`;
}
