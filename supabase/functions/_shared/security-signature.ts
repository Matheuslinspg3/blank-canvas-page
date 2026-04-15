/**
 * M2M Webhook Signature Verification — Phase 1 Security Core.
 *
 * Provides HMAC-SHA256 signature verification for service-to-service calls,
 * replacing the Phase 0 `isInternalCall` shared-secret approach.
 *
 * Headers expected:
 *   X-Webhook-Signature: HMAC-SHA256 hex digest of body
 *   X-Webhook-Timestamp: Unix epoch seconds (replay window: 5 min)
 *
 * Backward compatibility:
 *   Falls back to Phase 0 `isInternalCall` if new headers are absent,
 *   allowing gradual migration of callers.
 */
import { isInternalCall } from "./auth-helpers.ts";

const WEBHOOK_SIGNING_KEY = Deno.env.get("WEBHOOK_SIGNING_KEY") || "";
const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

async function computeHmac(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export interface SignatureResult {
  valid: boolean;
  method: "hmac" | "legacy" | "none";
  error?: string;
}

/**
 * Verifies the request is an authorized internal/webhook call.
 *
 * Priority:
 *  1. HMAC signature (X-Webhook-Signature + X-Webhook-Timestamp)
 *  2. Legacy isInternalCall (Phase 0 fallback)
 *
 * Returns { valid, method, error }.
 */
export async function requireWebhookSignature(
  req: Request,
  bodyText?: string,
): Promise<SignatureResult> {
  const signature = req.headers.get("X-Webhook-Signature");
  const timestamp = req.headers.get("X-Webhook-Timestamp");

  // Try HMAC first
  if (signature && timestamp && WEBHOOK_SIGNING_KEY) {
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
      return { valid: false, method: "hmac", error: "Timestamp outside replay window" };
    }

    const payload = bodyText || "";
    const signedData = `${timestamp}.${payload}`;
    const expected = await computeHmac(WEBHOOK_SIGNING_KEY, signedData);

    if (!timingSafeEqual(signature, expected)) {
      return { valid: false, method: "hmac", error: "Invalid HMAC signature" };
    }

    return { valid: true, method: "hmac" };
  }

  // Fallback to Phase 0 legacy check
  if (isInternalCall(req)) {
    return { valid: true, method: "legacy" };
  }

  return { valid: false, method: "none", error: "No valid authentication method" };
}
