import { getAuthenticatedUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const POLLING_WEBHOOK_URL =
  "https://n8n.costazul.shop/webhook/autouazapiagenteiavalentpolling";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError ?? "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { orgName, orgId, date, companyId } = body;

    const payload = { orgName, orgId, date, companyId };

    console.log("Polling WhatsApp status:", JSON.stringify(payload));

    let connected = false;
    let phoneNumber: string | null = null;
    let rawResponse: any = null;

    try {
      const res = await fetch(POLLING_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        try {
          const data = await res.json();
          rawResponse = data;
          const obj = Array.isArray(data) ? data[0] : data;

          // Check various possible response shapes for connected status
          const status = (
            obj?.status ?? obj?.data?.status ?? obj?.state ?? obj?.data?.state ?? ""
          ).toString().toLowerCase();

          // Check connectionStatus field directly
          const connStatus = (
            obj?.connectionStatus ?? obj?.data?.connectionStatus ?? ""
          ).toString().toLowerCase();

          connected =
            obj?.connected === true ||
            obj?.data?.connected === true ||
            connStatus === "open" ||
            /connected|open|ready|online|authorized/.test(status);

          phoneNumber =
            obj?.phone ?? obj?.data?.phone ?? obj?.phoneNumber ?? obj?.data?.phoneNumber ?? null;
        } catch {
          console.warn("Polling response not JSON");
        }
      } else {
        const text = await res.text().catch(() => "");
        console.warn("Polling webhook error:", res.status, text);
      }
    } catch (fetchErr) {
      console.warn("Polling webhook fetch error:", fetchErr);
    }

    // If connected, update whatsapp_instances in DB
    if (connected) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (profile?.organization_id) {
          const updatePayload: Record<string, any> = {
            status: "connected",
            qr_code: null,
          };
          if (phoneNumber) updatePayload.phone_number = phoneNumber;

          await supabaseClient
            .from("whatsapp_instances")
            .update(updatePayload)
            .eq("organization_id", profile.organization_id);
        }
      } catch (dbErr) {
        console.warn("DB update error:", dbErr);
      }
    }

    return new Response(
      JSON.stringify({ connected, phone: phoneNumber, raw: rawResponse }),
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
