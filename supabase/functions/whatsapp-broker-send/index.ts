import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * whatsapp-broker-send
 *
 * Sends messages via broker's individual WhatsApp channel.
 * Resolves instance from broker_whatsapp_channels.
 * Persists outbound message with channel_type='broker'.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new Error("Evolution API not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const sb = createClient(supabaseUrl, serviceKey);
    const anon = createClient(supabaseUrl, anonKey);

    const { data: { user }, error: authErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await sb.from("profiles").select("organization_id, full_name").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new Error("No organization");

    const body = await req.json();
    const { phone, message, type = "text", brokerChannelId, channelAccountId, mediaUrl, mediaType } = body;

    if (!phone || !message) throw new Error("phone and message are required");

    // Resolve broker channel — by explicit ID or by user's own channel
    let channel: any = null;

    if (brokerChannelId) {
      const { data } = await sb.from("broker_whatsapp_channels")
        .select("*")
        .eq("id", brokerChannelId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      channel = data;
    } else if (channelAccountId) {
      // Resolve via channel_accounts → broker_whatsapp_channels
      const { data: account } = await sb.from("channel_accounts")
        .select("source_table, source_id, metadata")
        .eq("id", channelAccountId)
        .maybeSingle();

      if (account?.source_table === "broker_whatsapp_channels" && account.source_id) {
        const { data } = await sb.from("broker_whatsapp_channels")
          .select("*")
          .eq("id", account.source_id)
          .maybeSingle();
        channel = data;
      }
    } else {
      // Fallback: user's own channel
      const { data } = await sb.from("broker_whatsapp_channels")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      channel = data;
    }

    if (!channel) throw new Error("Canal do corretor não encontrado");
    if (channel.status !== "connected") throw new Error("Canal não está conectado");
    if (!channel.instance_name) throw new Error("Instância não configurada");

    // Send via Evolution API
    const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;

    let evoEndpoint: string;
    let evoBody: Record<string, unknown>;

    if (type === "media" && mediaUrl) {
      evoEndpoint = `${EVOLUTION_API_URL}/message/sendMedia/${channel.instance_name}`;
      evoBody = {
        number: remoteJid,
        mediatype: mediaType ?? "image",
        media: mediaUrl,
        caption: message,
      };
    } else {
      evoEndpoint = `${EVOLUTION_API_URL}/message/sendText/${channel.instance_name}`;
      evoBody = { number: remoteJid, text: message };
    }

    const evoRes = await fetch(evoEndpoint, {
      method: "POST",
      headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(evoBody),
    });

    const evoData = await evoRes.json();
    if (!evoRes.ok) {
      console.error("[broker-send] Evolution error:", evoData);
      throw new Error("Falha ao enviar mensagem pelo Evolution API");
    }

    const messageId = evoData?.key?.id ?? evoData?.id ?? crypto.randomUUID();

    // Persist outbound message
    await sb.from("whatsapp_messages").insert({
      organization_id: profile.organization_id,
      instance_name: channel.instance_name,
      remote_jid: remoteJid,
      from_me: true,
      message_id: messageId,
      message_type: type === "media" ? (mediaType ?? "image") : "text",
      message_text: message,
      media_url: mediaUrl ?? null,
      sender_type: "human",
      timestamp: new Date().toISOString(),
      channel_type: "broker",
      broker_channel_id: channel.id,
    });

    return json({ sent: true, messageId });
  } catch (err: unknown) {
    console.error("[broker-send] Error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
