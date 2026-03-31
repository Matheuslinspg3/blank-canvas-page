import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("No organization found");

    const orgId = profile.organization_id;

    const { data: config } = await supabaseClient
      .from("whatsapp_agent_config")
      .select("instance_name, status")
      .eq("organization_id", orgId)
      .single();

    if (!config?.instance_name || config.status !== "connected") {
      return new Response(
        JSON.stringify({ error: "WhatsApp não conectado." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const phone = formData.get("phone") as string | null;

    if (!audioFile || !phone) {
      throw new Error("audio file and phone are required");
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const endpoint = `${baseUrl}/message/sendWhatsAppAudio/${config.instance_name}`;

    const evoRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanPhone,
        audio: `data:audio/webm;base64,${audioBase64}`,
      }),
    });

    const evoData = await evoRes.json();

    if (!evoRes.ok) {
      throw new Error(`Evolution send audio error [${evoRes.status}]: ${JSON.stringify(evoData)}`);
    }

    // Persist sent audio message
    try {
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;
      const sentMessageId = evoData?.key?.id || evoData?.messageId || null;
      await supabaseClient.from("whatsapp_messages").insert({
        organization_id: orgId,
        instance_name: config.instance_name,
        remote_jid: remoteJid,
        from_me: true,
        message_text: "🎤 Áudio",
        message_type: "audio",
        message_id: sentMessageId,
        timestamp: new Date().toISOString(),
        sender_type: "human",
      });
    } catch (persistErr) {
      console.warn("Failed to persist audio message:", persistErr);
    }

    return new Response(JSON.stringify({ success: true, data: evoData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send-audio error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
