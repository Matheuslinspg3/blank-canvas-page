import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const auditLog = async (
  sb: any,
  orgId: string,
  action: string,
  actorId: string | null,
  details: Record<string, any> = {},
) => {
  try {
    await sb.from("whatsapp_audit_log").insert({
      organization_id: orgId,
      action,
      actor_id: actorId,
      details,
    });
  } catch (e) {
    console.warn("Failed to write audit log:", e);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
    if (!UAZAPI_BASE_URL) throw new Error("UAZAPI_BASE_URL not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("No organization found");

    const orgId = profile.organization_id;

    // Get instance token
    const { data: instance } = await supabaseClient
      .from("whatsapp_instances")
      .select("instance_token, status")
      .eq("organization_id", orgId)
      .single();

    if (!instance?.instance_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Ative a integração na área de integrações." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (instance.status !== "connected") {
      return new Response(
        JSON.stringify({ error: "WhatsApp desconectado. Reconecte na área de integrações antes de enviar mensagens." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { phone, message, type = "text" } = body;

    if (!phone || !message) throw new Error("phone and message are required");

    const cleanPhone = phone.replace(/\D/g, "");
    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, "");

    let endpoint: string;
    let payload: Record<string, any>;

    if (type === "media") {
      endpoint = `${baseUrl}/send/media`;
      payload = {
        number: cleanPhone,
        text: message,
        type: body.mediaType || "image",
        file: body.mediaUrl,
      };
    } else {
      endpoint = `${baseUrl}/send/text`;
      payload = {
        number: cleanPhone,
        text: message,
        linkPreview: false,
        delay: 0,
      };
    }

    const uazapiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instance.instance_token,
      },
      body: JSON.stringify(payload),
    });

    const uazapiData = await uazapiRes.json();

    if (!uazapiRes.ok) {
      // Check for invalid token specifically
      const isInvalidToken = uazapiRes.status === 401 || /invalid token/i.test(String(uazapiData?.message ?? ""));
      if (isInvalidToken) {
        // Update instance status to disconnected
        await supabaseClient
          .from("whatsapp_instances")
          .update({ status: "disconnected" })
          .eq("organization_id", orgId);

        await auditLog(supabaseClient, orgId, "send_token_invalid", user.id, { phone: cleanPhone });

        return new Response(
          JSON.stringify({ error: "Token do WhatsApp expirado ou inválido. Reconecte na área de integrações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Evolution send error [${uazapiRes.status}]: ${JSON.stringify(uazapiData)}`);
    }

    await auditLog(supabaseClient, orgId, "send", user.id, { phone: cleanPhone, type });

    return new Response(JSON.stringify({ success: true, data: uazapiData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
