import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { evoGoSendAudio, evoGoExtractMessageId, EVO_GO_BASE_URL, resolveEvoConfig } from "../_shared/evo-go.ts";

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
    if (!EVO_GO_BASE_URL) {
      throw new Error("EVOLUTION_GO_URL not configured");
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

    const config = await resolveEvoConfig(supabaseClient, orgId);

    if (!config || config.status !== "connected") {
      return new Response(
        JSON.stringify({ 
          error: "WhatsApp não conectado.", 
          debug: { orgId, instance: config?.instance_name, status: config?.status } 
        }),
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

    // EvoGo accepts either a public URL or a data URL in `url`.
    const evoRes = await evoGoSendAudio(config.instance_name, config.instance_token, {
      number: cleanPhone,
      url: `data:audio/webm;base64,${audioBase64}`,
    });

    if (!evoRes.ok) {
      throw new Error(`EvoGo send audio error [${evoRes.status}]: ${evoRes.raw.slice(0, 500)}`);
    }
    const evoData = evoRes.data;

    // Persist sent audio message
    try {
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;
      const sentMessageId = evoGoExtractMessageId(evoData);
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
