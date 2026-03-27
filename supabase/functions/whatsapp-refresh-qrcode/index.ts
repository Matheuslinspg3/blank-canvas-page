import { getAuthenticatedUser, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_GLOBAL_KEY não configurados");
    }

    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError ?? "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instance } = await sb
      .from("whatsapp_instances")
      .select("id, instance_name, status")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!instance?.instance_name) {
      return new Response(JSON.stringify({ success: false, error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    // Call Evolution API connect endpoint to get fresh QR
    const connectRes = await fetch(`${baseUrl}/instance/connect/${instance.instance_name}`, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
    });

    const connectRaw = await connectRes.text();
    console.log("QR refresh response:", connectRaw.substring(0, 500));

    let connectData: any;
    try {
      connectData = JSON.parse(connectRaw);
    } catch {
      connectData = {};
    }

    const qrBase64 =
      connectData?.base64 ??
      connectData?.qrcode?.base64 ??
      connectData?.code ??
      null;

    const pairingCode = connectData?.pairingCode ?? connectData?.qrcode?.pairingCode ?? null;

    // Check if already connected
    const state = String(connectData?.state ?? connectData?.instance?.state ?? "").toLowerCase();
    if (state === "open" || state === "connected") {
      await sb.from("whatsapp_instances").update({ status: "connected", qr_code: null }).eq("id", instance.id);
      return new Response(JSON.stringify({
        success: true,
        qrCode: null,
        pairingCode: null,
        connected: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save QR to DB
    if (qrBase64) {
      await sb.from("whatsapp_instances").update({ qr_code: qrBase64, status: "connecting" }).eq("id", instance.id);
    }

    return new Response(JSON.stringify({
      success: !!qrBase64,
      qrCode: qrBase64,
      pairingCode,
      connected: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
