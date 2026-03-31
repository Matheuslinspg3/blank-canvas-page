import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Support both direct fields and Evolution API webhook payload format
    const instanceName = body.instance_name || body.instance;
    if (!instanceName) {
      return new Response(JSON.stringify({ error: "instance_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse messages — support single message or array
    const messages: Array<{
      remote_jid: string;
      from_me: boolean;
      message_text: string | null;
      message_type: string;
      message_id: string | null;
      timestamp: string;
    }> = [];

    if (body.messages && Array.isArray(body.messages)) {
      // Batch format: { instance_name, messages: [...] }
      for (const m of body.messages) {
        messages.push({
          remote_jid: m.remote_jid,
          from_me: !!m.from_me,
          message_text: m.message_text ?? null,
          message_type: m.message_type ?? "text",
          message_id: m.message_id ?? null,
          timestamp: m.timestamp ?? new Date().toISOString(),
        });
      }
    } else if (body.data && Array.isArray(body.data)) {
      // Evolution API MESSAGES_UPSERT format
      for (const item of body.data) {
        const key = item.key || {};
        const msg = item.message || {};
        const text =
          msg.conversation ||
          msg.extendedTextMessage?.text ||
          msg.imageMessage?.caption ||
          msg.videoMessage?.caption ||
          msg.documentMessage?.caption ||
          null;

        let messageType = "text";
        if (msg.imageMessage) messageType = "image";
        else if (msg.videoMessage) messageType = "video";
        else if (msg.audioMessage) messageType = "audio";
        else if (msg.documentMessage) messageType = "document";
        else if (msg.stickerMessage) messageType = "sticker";
        else if (msg.contactMessage) messageType = "contact";
        else if (msg.locationMessage) messageType = "location";

        const ts = item.messageTimestamp
          ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        messages.push({
          remote_jid: key.remoteJid || body.remote_jid,
          from_me: !!key.fromMe,
          message_text: text,
          message_type: messageType,
          message_id: key.id || null,
          timestamp: ts,
        });
      }
    } else if (body.remote_jid) {
      // Single message format
      messages.push({
        remote_jid: body.remote_jid,
        from_me: !!body.from_me,
        message_text: body.message_text ?? null,
        message_type: body.message_type ?? "text",
        message_id: body.message_id ?? null,
        timestamp: body.timestamp ?? new Date().toISOString(),
      });
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to persist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out group messages and status broadcasts
    const filteredMessages = messages.filter(
      (m) => m.remote_jid && !m.remote_jid.endsWith("@g.us") && m.remote_jid !== "status@broadcast"
    );

    if (filteredMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, persisted: 0, skipped: "group/status" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve organization_id from instance_name
    const { data: config, error: configError } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id")
      .eq("instance_name", instanceName)
      .single();

    if (configError || !config?.organization_id) {
      return new Response(
        JSON.stringify({ error: `Instance '${instanceName}' not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = config.organization_id;

    // Build rows for upsert (deduplicate by message_id)
    const rows = filteredMessages.map((m) => ({
      organization_id: orgId,
      instance_name: instanceName,
      remote_jid: m.remote_jid,
      from_me: m.from_me,
      message_text: m.message_text,
      message_type: m.message_type,
      message_id: m.message_id,
      timestamp: m.timestamp,
      sender_type: m.from_me ? "agent" : "customer",
    }));

    // Use upsert with message_id to avoid duplicates when message_id exists
    const rowsWithId = rows.filter((r) => r.message_id);
    const rowsWithoutId = rows.filter((r) => !r.message_id);

    let persisted = 0;

    if (rowsWithId.length > 0) {
      const { error: upsertError, count } = await sb
        .from("whatsapp_messages")
        .upsert(rowsWithId, { onConflict: "message_id", ignoreDuplicates: true });
      if (upsertError) {
        console.error("Upsert error:", upsertError);
        // Fallback to insert ignoring conflicts
        await sb.from("whatsapp_messages").insert(rowsWithId);
      }
      persisted += rowsWithId.length;
    }

    if (rowsWithoutId.length > 0) {
      const { error: insertError } = await sb
        .from("whatsapp_messages")
        .insert(rowsWithoutId);
      if (insertError) console.error("Insert error:", insertError);
      persisted += rowsWithoutId.length;
    }

    return new Response(
      JSON.stringify({ success: true, persisted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-persist-message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
