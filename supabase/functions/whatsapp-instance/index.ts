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
    const body = await req.json();
    const { action } = body;

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const N8N_VERIFICA = "https://n8n.costazul.shop/webhook/autouazapiagenteiavalentpolling";

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

      let newStatus = "disconnected";
      let phone = config.phone_number || null;

      try {
        const verificaRes = await fetch(N8N_VERIFICA, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName: config.instance_name }),
        });

        const verificaRaw = await verificaRes.text();
        console.log("N8N VERIFICA response:", verificaRes.status, verificaRaw.substring(0, 300));

        if (verificaRes.ok) {
          const statusText = asLowerText(verificaRaw);
          if (/open|connected|online|ready/.test(statusText) && !/disconnected|closed/.test(statusText)) {
            newStatus = "connected";
          }
        }
      } catch (e) {
        console.warn("N8N VERIFICA failed, trying Evolution API:", e);

        if (config.instance_token) {
          try {
            const evoRes = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
              method: "GET",
              headers: { apikey: EVOLUTION_API_KEY },
            });
            const evoData = await evoRes.json().catch(() => ({}));
            const evoStatus = asLowerText(evoData?.state ?? evoData?.instance?.state ?? "");
            if (/open|connected/.test(evoStatus)) {
              newStatus = "connected";
            }
            phone = evoData?.phone || evoData?.data?.phone || phone;
          } catch { /* ignore */ }
        }
      }

      const updatePayload: Record<string, any> = { status: newStatus };
      if (newStatus === "connected") {
        updatePayload.qr_code = null;
        if (phone) updatePayload.phone_number = phone;
      }

      await supabaseClient
        .from("whatsapp_agent_config")
        .update(updatePayload)
        .eq("id", config.id);

      await auditLog(supabaseClient, orgId, "status_check", user.id, { newStatus });

      return new Response(JSON.stringify({
        status: newStatus,
        phone: phone,
        qr_code: newStatus === "connected" ? null : config.qr_code ?? null,
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

      if (config.instance_token) {
        try {
          const res = await fetch(`${baseUrl}/instance/logout/${config.instance_name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          });
          await res.text();
        } catch (e) {
          console.warn("Failed to disconnect on Evolution:", e);
        }
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

      if (!config) {
        return new Response(JSON.stringify({ deleted: true, skipped: "config_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (config.instance_token && config.instance_name) {
        try {
          const res = await fetch(`${baseUrl}/instance/delete/${config.instance_name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          });
          await res.text();
        } catch (e) {
          console.warn("Failed to delete on Evolution:", e);
        }
      }

      // Clear instance fields but keep the config row
      await supabaseClient
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

      await auditLog(supabaseClient, orgId, "delete", user.id, { instanceName: config.instance_name });

      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Supported: status, disconnect, delete" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-instance error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
