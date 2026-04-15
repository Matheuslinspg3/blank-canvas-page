/**
 * Security Feature Flags — Phase 2.
 *
 * Reads flags from security_feature_flags table with in-memory cache.
 * Supports modes: observe, dual, enforce.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface FlagState {
  enabled: boolean;
  mode: "observe" | "dual" | "enforce";
}

const FLAG_CACHE = new Map<string, FlagState>();
let lastFetch = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadFlags(): Promise<void> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL_MS && FLAG_CACHE.size > 0) return;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await sb.from("security_feature_flags").select("flag_key, enabled, mode");
    if (data) {
      FLAG_CACHE.clear();
      for (const f of data) {
        FLAG_CACHE.set(f.flag_key, { enabled: f.enabled, mode: f.mode });
      }
    }
    lastFetch = now;
  } catch (err) {
    console.error("[security-flags] Failed to load flags:", err);
    // Keep stale cache on error
  }
}

/**
 * Get flag state. Returns { enabled: false, mode: 'observe' } for unknown flags.
 */
export async function getFlag(key: string): Promise<FlagState> {
  await loadFlags();
  return FLAG_CACHE.get(key) || { enabled: false, mode: "observe" };
}

/**
 * Check if a flag is in enforce mode (enabled + enforce).
 */
export async function isEnforced(key: string): Promise<boolean> {
  const f = await getFlag(key);
  return f.enabled && f.mode === "enforce";
}

/**
 * Check if a flag should log but not block (observe or dual mode).
 */
export async function isObserving(key: string): Promise<boolean> {
  const f = await getFlag(key);
  return f.enabled && (f.mode === "observe" || f.mode === "dual");
}

/**
 * Check if dual mode (accept both old and new).
 */
export async function isDualMode(key: string): Promise<boolean> {
  const f = await getFlag(key);
  return f.enabled && f.mode === "dual";
}
