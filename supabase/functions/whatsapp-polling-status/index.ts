import { getAuthenticatedUser, createServiceClient } from "../_shared/auth.ts";
import { 
  corsHeaders, 
  parseJsonSafely, 
  classifyConnectionStatus,
  extractPhoneNumber 
} from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    const EVOLUTION_PROVIDER = (Deno.env.get("EVOLUTION_PROVIDER") || "evolution_node") as "evolution_node" | "evolution_go";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_GLOBAL_KEY não configurados");
    }

    const provider = new EvolutionProvider({
      baseUrl: EVOLUTION_API_URL,
      apiKey: EVOLUTION_API_KEY,
      provider: EVOLUTION_PROVIDER,
    });

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

    const stateRes = await provider.getStatus(config.instance_name);


    const stateRaw = await stateRes.text();
    console.log("Polling status response:", stateRaw.substring(0, 300));

    const stateData = parseJsonSafely(stateRaw);
    
    const connStatus = classifyConnectionStatus(
      stateRaw,
      stateData?.instance?.state,
      stateData?.state,
      stateData?.connectionStatus
    );

    const connected = connStatus === "connected";
    const phoneNumber = extractPhoneNumber(stateData);

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
