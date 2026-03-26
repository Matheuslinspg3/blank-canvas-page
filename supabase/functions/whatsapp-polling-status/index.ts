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

      const rawText = await res.text().catch(() => "");
      const normalizedRaw = rawText.trim().toLowerCase();
      console.log("Polling raw response (status " + res.status + "):", rawText.substring(0, 500));
      rawResponse = rawText;

      if (res.ok && rawText) {
        let obj: any = null;

        // Fast-path for plain text responses like: open
        if (normalizedRaw === "open" || normalizedRaw === '"open"') {
          connected = true;
        }

        try {
          const parsed = JSON.parse(rawText);
          obj = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch {
          // Try to find connectionStatus in raw text
          if (
            /connectionstatus\s*[:=]\s*["']?open["']?/i.test(rawText) ||
            /\bopen\b/i.test(normalizedRaw)
          ) {
            connected = true;
          }
        }

        if (obj) {
          // Deep search for connectionStatus in any nested structure
          const jsonStr = JSON.stringify(obj).toLowerCase();

          const status = (
            obj?.status ?? obj?.data?.status ?? obj?.state ?? obj?.data?.state ?? ""
          ).toString().toLowerCase();

          const connStatus = (
            obj?.connectionStatus ?? obj?.data?.connectionStatus ??
            obj?.instance?.connectionStatus ?? ""
          ).toString().toLowerCase();

          connected =
            connected ||
            obj?.connected === true ||
            obj?.data?.connected === true ||
            connStatus === "open" ||
            jsonStr.includes('"connectionstatus":"open"') ||
            /connected|open|ready|online|authorized/.test(status);

          phoneNumber =
            obj?.phone ?? obj?.data?.phone ?? obj?.phoneNumber ?? obj?.data?.phoneNumber ?? null;
        }
      } else if (!res.ok) {
        console.warn("Polling webhook error:", res.status, rawText.substring(0, 200));
      }
    } catch (fetchErr) {
      console.warn("Polling webhook fetch error:", fetchErr);
    }

    // If connected, upsert whatsapp_instances in DB
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
          const fallbackInstanceName = `whatsapp-${String(profile.organization_id).slice(0, 8)}`;
          const upsertPayload: Record<string, any> = {
            organization_id: profile.organization_id,
            instance_name: fallbackInstanceName,
            status: "connected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          };

          if (phoneNumber) upsertPayload.phone_number = phoneNumber;

          const { error: upsertError } = await supabaseClient
            .from("whatsapp_instances")
            .upsert(upsertPayload, { onConflict: "organization_id" });

          if (upsertError) {
            console.warn("DB upsert error:", upsertError);
          } else {
            console.log("Connection persisted for organization:", profile.organization_id);
          }
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
