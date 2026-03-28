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
      return new Response(JSON.stringify({ connected: false, error: "Organização não encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("id, instance_name, status")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!config?.instance_name) {
      return new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
    });

    const stateRaw = await stateRes.text();
    console.log("Polling status response:", stateRaw.substring(0, 300));

    let stateData: any;
    try {
      stateData = JSON.parse(stateRaw);
    } catch {
      stateData = {};
    }

    const connStatus = String(
      stateData?.instance?.state ?? stateData?.state ?? stateData?.connectionStatus ?? ""
    ).toLowerCase();

    const connected = connStatus === "open" || connStatus === "connected";
    const phoneNumber = stateData?.instance?.phoneNumber ?? stateData?.phoneNumber ?? null;

    if (connected) {
      await sb.from("whatsapp_agent_config").update({
        status: "connected",
        qr_code: null,
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", config.id);
    }

    return new Response(
      JSON.stringify({ connected, connectionStatus: connStatus, phone: phoneNumber }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
