// Phase 3B: Meta Messaging outbound (Instagram + Messenger).
// Adapter-only entrypoint. Resolves credentials server-side from
// channel_account_credentials. Never trusts client-supplied tokens.
// Behind feature flag `meta_messaging_enabled`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendBody {
  channelAccountId: string;
  recipientId: string; // PSID (messenger) or IGSID (instagram)
  message: string;
  type?: "text" | "media";
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (!body.channelAccountId || !body.recipientId || !body.message) {
    return json({ error: "missing_fields" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate channel account belongs to user's org
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return json({ error: "no_org" }, 403);

  const { data: chAcc } = await admin
    .from("channel_accounts")
    .select("id, organization_id, channel_type, status, external_id")
    .eq("id", body.channelAccountId)
    .maybeSingle();
  if (!chAcc || chAcc.organization_id !== profile.organization_id) {
    return json({ error: "channel_account_not_found" }, 404);
  }
  if (!["messenger", "instagram"].includes(chAcc.channel_type)) {
    return json({ error: "unsupported_channel" }, 400);
  }

  // Feature flag gate
  const { data: flag } = await admin
    .from("omnichannel_feature_flags")
    .select("meta_messaging_enabled")
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!flag?.meta_messaging_enabled) {
    return json({ error: "feature_disabled" }, 403);
  }

  const { data: cred } = await admin
    .from("channel_account_credentials")
    .select("access_token, external_page_id, external_ig_user_id, expires_at")
    .eq("channel_account_id", chAcc.id)
    .maybeSingle();
  if (!cred?.access_token) return json({ error: "no_credentials" }, 400);
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
    return json({ error: "credentials_expired" }, 401);
  }

  // Build Graph API payload
  const messagePayload: Record<string, unknown> = {};
  if (body.type === "media" && body.mediaUrl) {
    messagePayload.attachment = {
      type: body.mediaType ?? "image",
      payload: { url: body.mediaUrl, is_reusable: false },
    };
  } else {
    messagePayload.text = body.message;
  }

  // Endpoint differs slightly between messenger and instagram, but both
  // use /<PAGE_OR_IG_USER_ID>/messages with the page access token.
  const senderId = chAcc.channel_type === "instagram"
    ? cred.external_ig_user_id
    : cred.external_page_id;
  if (!senderId) return json({ error: "missing_sender_id" }, 400);

  const url = `https://graph.facebook.com/v21.0/${senderId}/messages?access_token=${cred.access_token}`;
  const graphRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: body.recipientId },
      messaging_type: "RESPONSE",
      message: messagePayload,
    }),
  });
  const graphJson = await graphRes.json();
  if (!graphRes.ok || graphJson.error) {
    console.error("graph_send_failed", graphJson);
    return json({ error: "graph_error", details: graphJson.error ?? graphJson }, 502);
  }

  // Mirror outbound into messages
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("channel_account_id", chAcc.id)
    .eq("external_contact_id", body.recipientId)
    .maybeSingle();

  if (conv) {
    await admin.from("messages").insert({
      organization_id: profile.organization_id,
      conversation_id: conv.id,
      channel_account_id: chAcc.id,
      channel_type: chAcc.channel_type,
      direction: "outbound",
      sender_type: "agent",
      content_type: body.type === "media" ? (body.mediaType ?? "image") : "text",
      content_text: body.type === "media" ? null : body.message,
      media_url: body.type === "media" ? (body.mediaUrl ?? null) : null,
      external_message_id: graphJson.message_id ?? null,
      sent_at: new Date().toISOString(),
      source_table: "meta_messaging_send",
      source_id: chAcc.id,
      metadata: { sent_by: user.id },
    });

    await admin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        last_message_preview: body.type === "media" ? "[media]" : body.message.slice(0, 200),
      })
      .eq("id", conv.id);
  }

  return json({ ok: true, message_id: graphJson.message_id ?? null });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
