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

      const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

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
        const pushNameRaw = (msg.pushName ?? msg.verifiedBizName ?? "").toString().trim() || null;
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
          push_name: !fromMe ? pushNameRaw : null,
        });

        // Backfill push_name on prior rows of this conversation if it was empty
        if (!fromMe && pushNameRaw) {
          await sb
            .from("whatsapp_messages")
            .update({ push_name: pushNameRaw })
            .eq("broker_channel_id", channel.id)
            .eq("remote_jid", remoteJid)
            .is("push_name", null);
        }

        if (insertErr) {
          if (insertErr.code === "23505") continue;
          console.error("[broker-webhook] Insert error:", insertErr);
          continue;
        }

        // ── AUTO-GREETING (first contact, inbound only) ──
        if (!fromMe && channel.status === "connected") {
          try {
            // Reload channel with greeting + followup config
            const { data: chFull } = await sb
              .from("broker_whatsapp_channels")
              .select("greeting_enabled, greeting_template_id, user_id, followup_enabled, followup_intervals, followup_max_attempts")
              .eq("id", channel.id)
              .single();

            // Check if this is first contact (no previous messages from this jid)
            const { count } = await sb
              .from("whatsapp_messages")
              .select("id", { count: "exact", head: true })
              .eq("instance_name", instanceName)
              .eq("remote_jid", remoteJid)
              .eq("channel_type", "broker")
              .neq("message_id", messageId);

            const isFirstContact = count === 0;

            // ── Send greeting on first contact ──
            if (isFirstContact && chFull?.greeting_enabled && chFull.greeting_template_id) {
              const { data: tmpl } = await sb
                .from("broker_message_templates")
                .select("body")
                .eq("id", chFull.greeting_template_id)
                .eq("is_active", true)
                .single();

              if (tmpl?.body && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
                const pushName = msg.pushName ?? msg.verifiedBizName ?? "";
                const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
                const greetingText = tmpl.body
                  .replace(/\{nome\}/gi, pushName || "")
                  .replace(/\{lead\.name\}/gi, pushName || "")
                  .replace(/\{imovel\}/gi, "")
                  .replace(/\{telefone\}/gi, remoteJid.replace(/@s\.whatsapp\.net$/, ""))
                  .replace(/\{corretor\}/gi, "")
                  .replace(/\{data\}/gi, today)
                  .replace(/\{tentativa\}/gi, "1")
                  .trim();

                if (greetingText) {
                  const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                    method: "POST",
                    headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
                    body: JSON.stringify({ number: remoteJid, text: greetingText }),
                  });

                  if (sendRes.ok) {
                    const sendData = await sendRes.json();
                    const greetMsgId = sendData?.key?.id ?? crypto.randomUUID();

                    await sb.from("whatsapp_messages").insert({
                      organization_id: channel.organization_id,
                      instance_name: instanceName,
                      remote_jid: remoteJid,
                      from_me: true,
                      message_id: greetMsgId,
                      message_type: "text",
                      message_text: greetingText,
                      sender_type: "system",
                      timestamp: new Date().toISOString(),
                      channel_type: "broker",
                      broker_channel_id: channel.id,
                    });

                    console.log(`[broker-webhook] Auto-greeting sent to ${remoteJid}`);
                  }
                }
              }
            }

            // ── Enqueue in follow_up_queue on first contact ──
            if (isFirstContact && chFull?.followup_enabled) {
              const phone = remoteJid.replace(/@s\.whatsapp\.net$/, "");
              const intervals = (chFull.followup_intervals as number[]) ?? [24, 48, 72];
              const firstIntervalHours = intervals[0] ?? 24;
              const nextFollowup = new Date(Date.now() + firstIntervalHours * 3600 * 1000).toISOString();

              const { error: queueErr } = await sb.from("follow_up_queue").insert({
                org_id: channel.organization_id,
                lead_phone: phone,
                lead_name: msg.pushName ?? msg.verifiedBizName ?? null,
                instance_name: instanceName,
                status: "pending",
                attempt_count: 0,
                next_followup_at: nextFollowup,
                last_inbound_at: new Date().toISOString(),
                channel_type: "broker",
                broker_channel_id: channel.id,
              });

              if (queueErr && queueErr.code !== "23505") {
                console.warn("[broker-webhook] Follow-up queue insert error:", queueErr);
              } else {
                console.log(`[broker-webhook] Enqueued follow-up for ${phone} on broker channel`);
              }
            }
          } catch (greetErr) {
            console.warn("[broker-webhook] Greeting error:", greetErr);
          }
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
