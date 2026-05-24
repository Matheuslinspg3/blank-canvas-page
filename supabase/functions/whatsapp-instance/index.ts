import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  parseJsonSafely, 
  classifyConnectionStatus, 
  extractPhoneNumber, 
  safePreview,
  jsonResponse,
  errorResponse,
  AppError
} from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";


const normalizePersistedStatus = (
  value: unknown,
): "connected" | "connecting" | "provisioning" | "disconnected" => {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "connected") return "connected";
  if (text === "connecting") return "connecting";
  if (text === "provisioning") return "provisioning";
  return "disconnected";
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new AppError("MISSING_EVOLUTION_CONFIG", "Evolution API not configured", 422);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new AppError("UNAUTHORIZED", "Missing authorization header", 401);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new AppError("UNAUTHORIZED", "Unauthorized", 401);

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new AppError("ORGANIZATION_NOT_FOUND", "No organization found", 404);

    const orgId = profile.organization_id;
    const { action } = await req.json();
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    // ── STATUS ──
    if (action === "status") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!config || !config.instance_name) {
        return jsonResponse({ ok: true, status: "disconnected", phone: null, qr_code: null });
      }

      let evoStatus = "unknown";
      let phone = config.phone_number;

      try {
        const evoRes = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const evoRaw = await evoRes.text();
        const evoData = parseJsonSafely(evoRaw);

        if (evoRes.ok) {
          evoStatus = classifyConnectionStatus(evoRaw, evoData?.state, evoData?.instance?.state);
          phone = extractPhoneNumber(evoData) ?? phone;
        }
      } catch (e) {
        console.warn("Evolution connectionState failed:", e);
      }

      let newStatus = normalizePersistedStatus(config.status);
      if (evoStatus === "connected") newStatus = "connected";
      else if (evoStatus === "connecting") newStatus = "connecting";
      else if (evoStatus === "disconnected") newStatus = "disconnected";

      await supabaseClient
        .from("whatsapp_agent_config")
        .update({ status: newStatus, phone_number: phone })
        .eq("id", config.id);

      return jsonResponse({
        ok: true,
        status: newStatus,
        phone,
        qr_code: newStatus === "connected" ? null : config.qr_code,
      });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (config?.instance_name) {
        await fetch(`${baseUrl}/instance/logout/${config.instance_name}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        }).catch(() => null);

        await supabaseClient
          .from("whatsapp_agent_config")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", config.id);
      }

      return jsonResponse({ ok: true, status: "disconnected" });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (config?.instance_name) {
        await fetch(`${baseUrl}/instance/delete/${config.instance_name}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        }).catch(() => null);

        await supabaseClient
          .from("whatsapp_agent_config")
          .update({
            instance_name: null,
            instance_token: null,
            status: "disconnected",
            phone_number: null,
            qr_code: null,
          })
          .eq("id", config.id);
      }

      return jsonResponse({ ok: true, deleted: true });
    }

    throw new AppError("INVALID_ACTION", "Invalid action", 400);

  } catch (err: any) {
    console.error("whatsapp-instance error:", err);
    if (err instanceof AppError) {
        return errorResponse(err.status, err.code, err.message, err.debug_ref);
    }
    return errorResponse(500, "INTERNAL_ERROR", "Ocorreu um erro interno.");
  }
});
