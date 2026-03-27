import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const asLowerText = (value: unknown) => String(value ?? "").toLowerCase();

const safeJsonForError = (payload: unknown, max = 1500) => {
  const raw = JSON.stringify(payload ?? {});
  return raw.length > max ? `${raw.slice(0, max)}...` : raw;
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
    const body = await req.json();
    const { action } = body;

    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, "");

    // ── STATUS ──
    if (action === "status") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance) {
        return new Response(JSON.stringify({ status: "disconnected", phone: null, qr_code: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no token, return DB status directly
      if (!instance.instance_token) {
        return new Response(JSON.stringify({
          status: instance.status || "disconnected",
          phone: instance.phone_number || null,
          qr_code: instance.qr_code || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET /instance/status — header: token
      const uazapiRes = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { token: instance.instance_token },
      });

      const rawStatusBody = await uazapiRes.text();
      let uazapiData: any = null;
      try {
        uazapiData = rawStatusBody ? JSON.parse(rawStatusBody) : {};
      } catch {
        uazapiData = { raw: rawStatusBody };
      }

      if (!uazapiRes.ok) {
        const isInvalidToken = uazapiRes.status === 401 || /invalid token/i.test(String(uazapiData?.message ?? rawStatusBody));

        if (isInvalidToken) {
          console.warn("whatsapp-instance status: invalid token, returning DB fallback", {
            instance_id: instance.id,
            token_last4: String(instance.instance_token || "").slice(-4),
          });

          return new Response(JSON.stringify({
            status: instance.status || "disconnected",
            phone: instance.phone_number || null,
            qr_code: instance.qr_code || null,
            warning: "EVOLUTION_TOKEN_INVALID",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error(`Evolution status error [${uazapiRes.status}]: ${safeJsonForError(uazapiData)}`);
      }

      const statusText = [
        uazapiData?.status,
        uazapiData?.state,
        uazapiData?.connectionStatus,
        uazapiData?.session?.status,
        uazapiData?.instance?.status,
        uazapiData?.instance?.state,
        uazapiData?.data?.status,
        uazapiData?.data?.state,
      ]
        .map(asLowerText)
        .join(" ");

      const hasConnectedFlag = [
        uazapiData?.connected,
        uazapiData?.isConnected,
        uazapiData?.instance?.connected,
        uazapiData?.data?.connected,
      ].some((value) => value === true || asLowerText(value) === "true");

      const isConnectedByStatus =
        /connected|authorized|open|online|ready|working/.test(statusText) &&
        !/disconnected|disconnect|notauthorized|offline|closed/.test(statusText);

      const newStatus = hasConnectedFlag || isConnectedByStatus
        ? "connected"
        : "disconnected";

      const updatePayload: Record<string, any> = { status: newStatus };
      if (newStatus === "connected") {
        updatePayload.qr_code = null;
        updatePayload.phone_number = uazapiData.phone || uazapiData.phoneNumber || uazapiData.data?.phone || instance.phone_number;
      }

      await supabaseClient
        .from("whatsapp_instances")
        .update(updatePayload)
        .eq("id", instance.id);

      await auditLog(supabaseClient, orgId, "status_check", user.id, { newStatus });

      return new Response(JSON.stringify({
        status: newStatus,
        phone: updatePayload.phone_number || instance.phone_number,
        qr_code: newStatus === "connected" ? null : instance.qr_code ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance) {
        return new Response(JSON.stringify({ status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (instance.instance_token) {
        try {
          const res = await fetch(`${baseUrl}/instance/disconnect`, {
            method: "POST",
            headers: { token: instance.instance_token },
          });
          await res.text();
        } catch (e) {
          console.warn("Failed to disconnect on Evolution:", e);
        }
      }

      await supabaseClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);

      await auditLog(supabaseClient, orgId, "disconnect", user.id);

      return new Response(JSON.stringify({ status: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance) {
        return new Response(JSON.stringify({ deleted: true, skipped: "instance_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (instance.instance_token) {
        try {
          const res = await fetch(`${baseUrl}/instance`, {
            method: "DELETE",
            headers: { token: instance.instance_token },
          });
          await res.text();
        } catch (e) {
          console.warn("Failed to delete on Evolution:", e);
        }
      }

      await supabaseClient
        .from("whatsapp_instances")
        .delete()
        .eq("id", instance.id);

      await auditLog(supabaseClient, orgId, "delete", user.id, { instanceName: instance.instance_name });

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
