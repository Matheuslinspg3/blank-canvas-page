import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const asLowerText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const parseJsonSafely = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizePersistedStatus = (
  value: unknown,
): "connected" | "connecting" | "provisioning" | "disconnected" => {
  const text = asLowerText(value);
  if (text === "connected") return "connected";
  if (text === "connecting") return "connecting";
  if (text === "provisioning") return "provisioning";
  return "disconnected";
};

const classifyConnectionStatus = (
  ...values: unknown[]
): "connected" | "connecting" | "disconnected" | "unknown" => {
  const text = values.map((value) => asLowerText(value)).filter(Boolean).join(" ");
  if (!text) return "unknown";
  if (/(^|[^a-z])(open|connected|online|ready)([^a-z]|$)/.test(text)) return "connected";
  if (/(connecting|pairing|pair|qr|qrcode|scan|await|starting|sync|opening)/.test(text)) return "connecting";
  if (/(disconnected|close|closed|logout|logged.?out|offline|removed|delete)/.test(text)) return "disconnected";
  return "unknown";
};

const extractPhoneNumber = (payload: any): string | null => {
  const candidates = [
    payload?.phone,
    payload?.number,
    payload?.phoneNumber,
    payload?.instance?.phone,
    payload?.instance?.number,
    payload?.instance?.phoneNumber,
    payload?.data?.phone,
    payload?.data?.number,
    payload?.data?.phoneNumber,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const digits = String(candidate).replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }

  return null;
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

const safePreview = (value: unknown, limit = 1000) => {
  const text = String(value ?? "");
  const masked = text
    .replace(/("?(?:apikey|api_key|token|authorization)"?\s*[:=]\s*")([^"\n]+)(")/gi, '$1***$3')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1***');
  return masked.substring(0, limit);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY not configured");

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

    // Get Organization Details for slug calculation
    const { data: org } = await supabaseClient
      .from("organizations")
      .select("id, name, slug")
      .eq("id", orgId)
      .single();
    
    if (!org) throw new Error("Organization not found in database");

    const orgSlug = org.slug || org.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "");
    const instanceNameFallback = `${orgSlug}-${orgId}`;

    const body = await req.json();
    const { action } = body;

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    
    // ── STATUS ──
    if (action === "status") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ status: "disconnected", phone: null, qr_code: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!config.instance_name) {
        return new Response(JSON.stringify({
          status: config.status || "disconnected",
          phone: config.phone_number || null,
          qr_code: config.qr_code || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const persistedStatus = normalizePersistedStatus(config.status);
      let newStatus = persistedStatus;
      let phone = config.phone_number || null;
      let evoStatus: "connected" | "connecting" | "disconnected" | "unknown" = "unknown";

      try {
        const evoRes = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const evoRaw = await evoRes.text();
        const evoData = parseJsonSafely(evoRaw);

        if (evoRes.ok) {
          evoStatus = classifyConnectionStatus(
            evoRaw,
            evoData ? JSON.stringify(evoData) : "",
            evoData?.state,
            evoData?.instance?.state,
            evoData?.connectionStatus,
          );
          phone = extractPhoneNumber(evoData) ?? phone;
        }

        console.log("Evolution connectionState response:", JSON.stringify({
          status: evoRes.status,
          interpretedStatus: evoStatus,
          raw: safePreview(evoRaw, 300),
        }));
      } catch (e) {
        console.warn("Evolution connectionState failed:", e);
      }

      const providerStatus = evoStatus;
      if (providerStatus === "connected") {
        newStatus = "connected";
      } else if (providerStatus === "connecting") {
        newStatus = "connecting";
      } else if (providerStatus === "disconnected") {
        newStatus = "disconnected";
      }

      const updatePayload: Record<string, any> = { status: newStatus };
      if (newStatus === "connected" || newStatus === "disconnected") {
        updatePayload.qr_code = null;
      }
      if (phone) updatePayload.phone_number = phone;

      await supabaseClient
        .from("whatsapp_agent_config")
        .update(updatePayload)
        .eq("id", config.id);

      await auditLog(supabaseClient, orgId, "status_check", user.id, {
        newStatus,
        persistedStatus,
        evoStatus,
      });

      return new Response(JSON.stringify({
        status: newStatus,
        phone,
        qr_code: newStatus === "connected" || newStatus === "disconnected" ? null : config.qr_code ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = config.instance_name || instanceNameFallback;

      try {
        const res = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        await res.text();
      } catch (e) {
        console.warn("Failed to disconnect on Evolution:", e);
      }

      await supabaseClient
        .from("whatsapp_agent_config")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", config.id);

      await auditLog(supabaseClient, orgId, "disconnect", user.id);

      return new Response(JSON.stringify({ status: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      // Collect potential names to delete
      const namesToDelete = new Set<string>();
      if (config?.instance_name) namesToDelete.add(config.instance_name);
      namesToDelete.add(instanceNameFallback);
      
      const attemptedEvolutionInstances = Array.from(namesToDelete);
      let evolutionDeletedCount = 0;
      let someInstancesStillExist = false;

      for (const name of attemptedEvolutionInstances) {
        try {
          // Pre-emptive logout (don't fail the whole process if this fails)
          await fetch(`${baseUrl}/instance/logout/${name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          }).catch(() => null);
          
          const res = await fetch(`${baseUrl}/instance/delete/${name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          });
          
          if (res.ok || res.status === 404) {
            evolutionDeletedCount++;
          } else {
            const errorRaw = await res.text();
            console.warn(`Evolution delete failed for ${name} [${res.status}]:`, safePreview(errorRaw));
          }
        } catch (e) {
          console.warn(`Failed to delete ${name} on Evolution:`, e);
        }
      }

      // Verification fetch
      try {
        const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        if (fetchRes.ok) {
          const list = await fetchRes.json();
          const instances = Array.isArray(list) ? list : (Array.isArray(list?.instances) ? list.instances : []);
          someInstancesStillExist = attemptedEvolutionInstances.some(name => 
            instances.some((item: any) => String(item?.instanceName || item?.name || "").trim() === name)
          );
        }
      } catch (e) {
        console.warn("Failed to verify instances after delete:", e);
      }

      const warning = someInstancesStillExist 
        ? "A instância ainda pode existir na Evolution. Remova manualmente no painel se persistir."
        : null;

      // ALWAYS clear local state if config exists
      if (config) {
        const { error: updateError } = await supabaseClient
          .from("whatsapp_agent_config")
          .update({
            instance_name: null,
            instance_token: null,
            status: "disconnected",
            phone_number: null,
            qr_code: null,
            webhook_url: null,
          })
          .eq("id", config.id);
          
        if (updateError) {
          console.error("Failed to clear local config:", updateError);
          throw new Error("Falha ao limpar configuração local no banco de dados.");
        }
      }

      await auditLog(supabaseClient, orgId, "delete", user.id, { 
        attempted: attemptedEvolutionInstances,
        evolutionDeletedCount,
        someInstancesStillExist,
        localCleared: !!config
      });

      return new Response(JSON.stringify({ 
        success: true,
        deleted: true, 
        localCleared: !!config,
        attemptedEvolutionInstances,
        evolutionDeleted: evolutionDeletedCount > 0,
        warning
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Supported: status, disconnect, delete" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("whatsapp-instance error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ success: false, error: { code: "WHATSAPP_DELETE_FAILED", message } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
