import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Downloads media from Evolution API and stores in Supabase Storage (whatsapp-media bucket).
 * 
 * Called by N8N after receiving an audio/image/video message.
 * 
 * Body: {
 *   instance_name: string,
 *   message_id: string,        // WhatsApp message ID
 *   remote_jid: string,
 *   media_type: "audio" | "image" | "video",
 *   media_key?: string,        // optional, for Evolution API v2
 * }
 * 
 * Returns: { media_url: string }
 */

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Auth: accept either webhook secret or JWT
    const requestSecret = req.headers.get("X-Webhook-Secret");
    const authHeader = req.headers.get("Authorization");

    if (!requestSecret && !authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestSecret && requestSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { instance_name, message_id, remote_jid, media_type } = body;

    if (!instance_name || !message_id) {
      return new Response(
        JSON.stringify({ error: "instance_name and message_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve organization_id from instance
    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .maybeSingle();

    if (!config?.organization_id) {
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = config.organization_id;

    // Download media from Evolution API (getBase64FromMediaMessage)
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const evoRes = await fetch(
      `${baseUrl}/chat/getBase64FromMediaMessage/${instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          message: { key: { id: message_id } },
          convertToMp4: media_type === "video",
        }),
      }
    );

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error("Evolution getBase64 error:", evoRes.status, errText);
      throw new Error(`Failed to download media: ${evoRes.status}`);
    }

    const evoData = await evoRes.json();
    const base64Data = evoData.base64 || evoData.data;
    const mimeType = evoData.mimetype || evoData.mediaType || getMimeType(media_type);

    if (!base64Data) {
      throw new Error("No base64 data returned from Evolution API");
    }

    // Decode base64 to bytes
    const rawBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const binaryStr = atob(rawBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Determine file extension
    const ext = getExtension(mimeType, media_type);
    const fileName = `${orgId}/${media_type}/${message_id}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await sb.storage
      .from("whatsapp-media")
      .upload(fileName, bytes.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = sb.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    const mediaUrl = urlData.publicUrl;

    // Update the whatsapp_messages record with the permanent media_url
    if (remote_jid) {
      await sb
        .from("whatsapp_messages")
        .update({ media_url: mediaUrl })
        .eq("message_id", message_id)
        .eq("organization_id", orgId);
    }

    return new Response(
      JSON.stringify({ success: true, media_url: mediaUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-download-media error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getMimeType(type: string): string {
  switch (type) {
    case "audio": return "audio/ogg";
    case "image": return "image/jpeg";
    case "video": return "video/mp4";
    default: return "application/octet-stream";
  }
}

function getExtension(mime: string, fallbackType: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "audio/webm": "webm",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
  };
  return map[mime] || (fallbackType === "audio" ? "ogg" : fallbackType === "image" ? "jpg" : "mp4");
}
