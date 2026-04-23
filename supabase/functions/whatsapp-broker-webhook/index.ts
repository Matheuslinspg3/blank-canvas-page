import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * whatsapp-broker-webhook
 *
 * Receives messages from Evolution API for broker (individual) WhatsApp channels.
 * - Resolves instance_name → broker_whatsapp_channels
 * - Persists in whatsapp_messages with channel_type='broker'
 * - Does NOT trigger AI pipeline (no n8n call)
 * - The existing mirror trigger handles omnichannel sync
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("[broker-webhook] Received:", JSON.stringify(body).substring(0, 500));

    // Evolution API sends different event types
    const event = body.event ?? body.type ?? "";
    const instanceName = body.instance ?? body.instanceName ?? body.data?.instance ?? "";

    if (!instanceName) {
      console.warn("[broker-webhook] No instance name in payload");
      return new Response(JSON.stringify({ ok: true, skipped: "no_instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve broker channel
    const { data: channel } = await sb
      .from("broker_whatsapp_channels")
      .select("id, organization_id, user_id, status")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!channel) {
      console.warn(`[broker-webhook] Unknown instance: ${instanceName}`);
      return new Response(JSON.stringify({ ok: true, skipped: "unknown_instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CONNECTION_UPDATE ──
    if (event === "CONNECTION_UPDATE" || event === "connection.update") {
      const state = body.data?.state ?? body.state ?? "";
      const stateLower = String(state).toLowerCase();

      let newStatus = "connecting";
      if (/(open|connected|online|ready)/.test(stateLower)) newStatus = "connected";
      else if (/(close|closed|disconnected|logout)/.test(stateLower)) newStatus = "disconnected";

      const update: Record<string, unknown> = { status: newStatus };
      if (newStatus === "connected" || newStatus === "disconnected") update.qr_code = null;

      // Extract phone if available
      const phone = body.data?.phone ?? body.data?.number ?? body.phone ?? null;
      if (phone) {
        const digits = String(phone).replace(/\D/g, "");
        if (digits.length >= 10) update.phone_number = digits;
      }

      await sb.from("broker_whatsapp_channels").update(update).eq("id", channel.id);

      console.log(`[broker-webhook] Connection update: ${instanceName} → ${newStatus}`);
      return new Response(JSON.stringify({ ok: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── QRCODE_UPDATED ──
    if (event === "QRCODE_UPDATED" || event === "qrcode.updated") {
      const qrCode = body.data?.qrcode?.base64 ?? body.data?.base64 ?? body.qrcode?.base64 ?? null;
      if (qrCode) {
        await sb.from("broker_whatsapp_channels").update({ qr_code: qrCode, status: "connecting" }).eq("id", channel.id);
      }

      return new Response(JSON.stringify({ ok: true, event: "qr_updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MESSAGES_UPSERT ──
    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      const messages = body.data ?? [];
      const msgArray = Array.isArray(messages) ? messages : [messages];

      for (const msg of msgArray) {
        const key = msg.key ?? {};
        const remoteJid = key.remoteJid ?? msg.remoteJid ?? "";
        const fromMe = key.fromMe ?? msg.fromMe ?? false;
        const messageId = key.id ?? msg.id ?? crypto.randomUUID();

        // Skip status messages
        if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) continue;

        // Determine message type and text
        const msgContent = msg.message ?? {};
        let messageType = "text";
        let messageText = msg.body ?? msgContent.conversation ?? msgContent.extendedTextMessage?.text ?? "";
        let mediaUrl: string | null = null;

        if (msgContent.imageMessage) { messageType = "image"; messageText = msgContent.imageMessage.caption ?? messageText; }
        else if (msgContent.audioMessage) { messageType = "audio"; }
        else if (msgContent.videoMessage) { messageType = "video"; messageText = msgContent.videoMessage.caption ?? messageText; }
        else if (msgContent.documentMessage) { messageType = "document"; messageText = msgContent.documentMessage.fileName ?? messageText; }

        // Persist in whatsapp_messages with channel_type='broker'
        const { error: insertErr } = await sb.from("whatsapp_messages").insert({
          organization_id: channel.organization_id,
          instance_name: instanceName,
          remote_jid: remoteJid,
          from_me: fromMe,
          message_id: messageId,
          message_type: messageType,
          message_text: messageText || null,
          media_url: mediaUrl,
          sender_type: fromMe ? "human" : "customer",
          timestamp: msg.messageTimestamp
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString(),
          channel_type: "broker",
          broker_channel_id: channel.id,
        });

        if (insertErr) {
          // Duplicate message_id — skip silently
          if (insertErr.code === "23505") continue;
          console.error("[broker-webhook] Insert error:", insertErr);
        }
      }

      // NO AI pipeline call — this is the key difference from org webhook

      return new Response(JSON.stringify({ ok: true, processed: msgArray.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unknown event — accept silently
    console.log(`[broker-webhook] Unknown event: ${event}`);
    return new Response(JSON.stringify({ ok: true, skipped: "unknown_event" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[broker-webhook] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
