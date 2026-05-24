import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    const EVOLUTION_PROVIDER = (Deno.env.get("EVOLUTION_PROVIDER") || "evolution_node") as "evolution_node" | "evolution_go";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new Error("Evolution API not configured");

    const provider = new EvolutionProvider({
      baseUrl: EVOLUTION_API_URL,
      apiKey: EVOLUTION_API_KEY,
      provider: EVOLUTION_PROVIDER,
    });


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
    const { phone, message, type = "text", brokerChannelId, channelAccountId, mediaUrl, mediaType, clientMessageId } = body;

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
    const requestClientMessageId = typeof clientMessageId === "string" && clientMessageId.trim()
      ? clientMessageId.trim()
      : null;

    if (requestClientMessageId) {
      const { data: insertedLock, error: lockErr } = await sb
        .from("whatsapp_broker_send_locks")
        .insert({
          organization_id: profile.organization_id,
          broker_channel_id: channel.id,
          remote_jid: remoteJid,
          client_message_id: requestClientMessageId,
        })
        .select("id")
        .maybeSingle();

      if (lockErr?.code === "23505") {
        const { data: existingLock } = await sb
          .from("whatsapp_broker_send_locks")
          .select("message_id, status")
          .eq("broker_channel_id", channel.id)
          .eq("client_message_id", requestClientMessageId)
          .maybeSingle();
        return json({ sent: true, duplicate: true, messageId: existingLock?.message_id ?? null, status: existingLock?.status ?? "pending" });
      }
      if (lockErr || !insertedLock) throw lockErr ?? new Error("Falha ao criar trava de envio");
    }

    if (requestClientMessageId) {
      const { data: existingMessage } = await sb
        .from("whatsapp_messages")
        .select("message_id")
        .eq("broker_channel_id", channel.id)
        .eq("client_message_id", requestClientMessageId)
        .maybeSingle();

      if (existingMessage?.message_id) {
        return json({ sent: true, duplicate: true, messageId: existingMessage.message_id });
      }
    }

    const { data: contactNameRow } = await sb
      .from("whatsapp_messages")
      .select("push_name")
      .eq("broker_channel_id", channel.id)
      .eq("remote_jid", remoteJid)
      .not("push_name", "is", null)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    const contactPushName = typeof contactNameRow?.push_name === "string" && contactNameRow.push_name.trim()
      ? contactNameRow.push_name.trim()
      : null;

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
    const { error: insertErr } = await sb.from("whatsapp_messages").insert({
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
      client_message_id: requestClientMessageId,
      push_name: contactPushName,
    });
    if (insertErr) throw insertErr;

    if (requestClientMessageId) {
      await sb
        .from("whatsapp_broker_send_locks")
        .update({ status: "sent", message_id: messageId })
        .eq("broker_channel_id", channel.id)
        .eq("client_message_id", requestClientMessageId);
    }

    return json({ sent: true, messageId });
  } catch (err: unknown) {
    console.error("[broker-send] Error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
