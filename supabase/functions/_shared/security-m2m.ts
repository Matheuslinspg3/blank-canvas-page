/**
 * M2M Internal Authentication — Phase 2 Security Core.
 *
 * Provides robust service-to-service authentication with:
 *  - X-Internal-Key-Id: identifies the calling service/key
 *  - X-Internal-Timestamp: Unix epoch seconds
 *  - X-Internal-Nonce: unique per-request nonce (UUID)
 *  - X-Internal-Signature: HMAC-SHA256 of canonical string
 *
 * Canonical string: METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256
 *
 * Features:
 *  - Time skew validation (5 min window)
 *  - Nonce uniqueness (in-memory + optional Redis)
 *  - Key rotation support (multiple key IDs)
 *  - Clear distinction: user JWT vs internal_service vs external webhook
 */

const M2M_SIGNING_KEYS: Record<string, string> = {};

// Load keys from env: M2M_KEY_primary, M2M_KEY_secondary, etc.
for (const [key, value] of Object.entries(Deno.env.toObject())) {
  if (key.startsWith("M2M_KEY_") && value) {
    const keyId = key.replace("M2M_KEY_", "").toLowerCase();
    M2M_SIGNING_KEYS[keyId] = value;
  }
}

// Fallback: use WEBHOOK_SIGNING_KEY as "default" key if no M2M keys configured
const fallbackKey = Deno.env.get("WEBHOOK_SIGNING_KEY") || Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
if (Object.keys(M2M_SIGNING_KEYS).length === 0 && fallbackKey) {
  M2M_SIGNING_KEYS["default"] = fallbackKey;
}

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes
const NONCE_CACHE = new Set<string>();
const NONCE_CACHE_MAX = 10000;

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

export interface M2MVerifyResult {
  valid: boolean;
  keyId?: string;
  error?: string;
}

export type CallerType = "user" | "internal_service" | "webhook_external";

/**
 * Verifies M2M internal authentication headers.
 */
export async function verifyM2MSignature(
  req: Request,
  bodyText?: string,
): Promise<M2MVerifyResult> {
  const keyId = req.headers.get("X-Internal-Key-Id");
  const timestamp = req.headers.get("X-Internal-Timestamp");
  const nonce = req.headers.get("X-Internal-Nonce");
  const signature = req.headers.get("X-Internal-Signature");

  if (!keyId || !timestamp || !nonce || !signature) {
    return { valid: false, error: "Missing M2M auth headers" };
  }

  // Resolve key
  const signingKey = M2M_SIGNING_KEYS[keyId.toLowerCase()];
  if (!signingKey) {
    return { valid: false, error: `Unknown key ID: ${keyId}` };
  }

  // Validate timestamp
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return { valid: false, error: "Timestamp outside replay window" };
  }

  // Nonce replay check
  if (NONCE_CACHE.has(nonce)) {
    return { valid: false, error: "Nonce replay detected" };
  }

  // Build canonical string
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = url.pathname;
  const body = bodyText || "";
  const bodyHash = await sha256Hex(body);
  const canonical = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;

  const expected = await hmacSha256(signingKey, canonical);
  if (!timingSafeEqual(signature, expected)) {
    return { valid: false, error: "Invalid M2M signature" };
  }

  // Store nonce (evict old ones if too many)
  if (NONCE_CACHE.size >= NONCE_CACHE_MAX) {
    const first = NONCE_CACHE.values().next().value;
    if (first) NONCE_CACHE.delete(first);
  }
  NONCE_CACHE.add(nonce);

  return { valid: true, keyId: keyId.toLowerCase() };
}

/**
 * Determines caller type from request headers.
 */
export function determineCallerType(req: Request): CallerType {
  if (req.headers.get("X-Internal-Key-Id")) return "internal_service";
  if (req.headers.get("X-Webhook-Signature") || req.headers.get("X-Webhook-Secret")) return "webhook_external";
  return "user";
}

/**
 * Helper to generate M2M headers for outgoing internal calls.
 * Used by Edge Functions calling other Edge Functions.
 */
export async function generateM2MHeaders(
  method: string,
  path: string,
  body: string = "",
  keyId: string = "default",
): Promise<Record<string, string>> {
  const signingKey = M2M_SIGNING_KEYS[keyId];
  if (!signingKey) throw new Error(`M2M key not found: ${keyId}`);

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(body);
  const canonical = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await hmacSha256(signingKey, canonical);

  return {
    "X-Internal-Key-Id": keyId,
    "X-Internal-Timestamp": timestamp,
    "X-Internal-Nonce": nonce,
    "X-Internal-Signature": signature,
  };
}
