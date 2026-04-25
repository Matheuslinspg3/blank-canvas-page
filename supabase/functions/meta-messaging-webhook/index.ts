// Phase 3B: Meta Messaging webhook receiver (Instagram + Messenger).
// - GET: subscription verification handshake
// - POST: signed payload with messages; normalize and persist into omnichannel
// Idempotency via meta_webhook_events. Always returns 200 to Meta after logging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = verification handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Signature check (X-Hub-Signature-256: sha256=...)
  const signature = req.headers.get("x-hub-signature-256") || "";
  if (APP_SECRET) {
    const ok = await verifySignature(APP_SECRET, rawBody, signature);
    if (!ok) {
      console.error("invalid_signature");
      return new Response("invalid signature", { status: 401 });
    }
  } else {
    console.warn("META_APP_SECRET not configured; skipping signature check");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Always ack to Meta — process best-effort
  try {
    await processPayload(admin, payload);
  } catch (err) {
    console.error("process_payload_error", err);
  }
  return new Response("ok", { status: 200 });
});

async function processPayload(admin: any, payload: any) {
  const object = payload?.object as string | undefined; // "page" | "instagram"
  const entries: any[] = payload?.entry || [];
  if (!object || entries.length === 0) return;

  const channelType: "messenger" | "instagram" =
    object === "instagram" ? "instagram" : "messenger";

  for (const entry of entries) {
    const messaging: any[] = entry.messaging || [];
    for (const event of messaging) {
      const externalEventId =
        event?.message?.mid || `${entry.id}:${event?.timestamp ?? Date.now()}`;

      // Idempotency
      const { data: existing } = await admin
        .from("meta_webhook_events")
        .select("id")
        .eq("channel_type", channelType)
        .eq("external_event_id", externalEventId)
        .maybeSingle();
      if (existing) continue;

      await admin.from("meta_webhook_events").insert({
        external_event_id: externalEventId,
        channel_type: channelType,
        payload: event,
      });

      try {
        await handleMessageEvent(admin, channelType, entry, event);
        await admin
          .from("meta_webhook_events")
          .update({ processed_at: new Date().toISOString() })
          .eq("channel_type", channelType)
          .eq("external_event_id", externalEventId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("handle_message_event_error", msg);
        await admin
          .from("meta_webhook_events")
          .update({ error: msg })
          .eq("channel_type", channelType)
          .eq("external_event_id", externalEventId);
      }
    }
  }
}

async function handleMessageEvent(
  admin: any,
  channelType: "messenger" | "instagram",
  entry: any,
  event: any,
) {
  // Inbound message
  const message = event?.message;
  if (!message || message?.is_echo) return; // ignore echoes for outbound mirroring
  const senderId: string | undefined = event?.sender?.id;
  const recipientId: string | undefined = event?.recipient?.id;
  if (!senderId || !recipientId) return;

  // Resolve channel_account: for messenger recipientId = page id;
  // for instagram recipientId = ig user id.
  const externalId = recipientId;
  const { data: chAcc } = await admin
    .from("channel_accounts")
    .select("id, organization_id")
    .eq("channel_type", channelType)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!chAcc) {
    console.warn("channel_account_not_found", { channelType, externalId });
    return;
  }

  // Feature flag gate (do not persist if org disabled)
  const { data: flag } = await admin
    .from("omnichannel_feature_flags")
    .select("meta_messaging_enabled")
    .eq("organization_id", chAcc.organization_id)
    .maybeSingle();
  if (!flag?.meta_messaging_enabled) return;

  // Upsert conversation
  const { data: conv } = await admin
    .from("conversations")
    .upsert(
      {
        organization_id: chAcc.organization_id,
        channel_account_id: chAcc.id,
        channel_type: channelType,
        external_contact_id: senderId,
        status: "open",
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        last_message_preview: contentPreview(message),
      },
      { onConflict: "channel_account_id,external_contact_id" },
    )
    .select("id")
    .single();

  if (!conv) return;

  await admin.from("messages").insert({
    organization_id: chAcc.organization_id,
    conversation_id: conv.id,
    channel_account_id: chAcc.id,
    channel_type: channelType,
    direction: "inbound",
    sender_type: "customer",
    content_type: classifyContentType(message),
    content_text: typeof message?.text === "string" ? message.text : null,
    media_url: extractMediaUrl(message),
    external_message_id: message?.mid ?? null,
    sent_at: event?.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    source_table: "meta_webhook_events",
    source_id: chAcc.id,
    metadata: { raw: event },
  });
}

function contentPreview(message: any): string {
  if (typeof message?.text === "string") return message.text.slice(0, 200);
  if (message?.attachments?.length) return `[${message.attachments[0]?.type ?? "media"}]`;
  return "";
}

function classifyContentType(message: any): string {
  if (typeof message?.text === "string" && message.text.length > 0) return "text";
  const t = message?.attachments?.[0]?.type;
  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "file") return "document";
  return "text";
}

function extractMediaUrl(message: any): string | null {
  return message?.attachments?.[0]?.payload?.url ?? null;
}

async function verifySignature(secret: string, body: string, header: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
