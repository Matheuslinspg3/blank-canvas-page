import { getAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFRESH_WEBHOOK_URL =
  "https://n8n.costazul.shop/webhook/autouazapiagenteiavalentQR-CODE";

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
    // Expect: { pairingCode, code, count, orgName, orgId, date, companyId }
    // Forward everything except base64 to the refresh webhook
    const { pairingCode, code, count, orgName, orgId, date, companyId } = body;

    const payload = {
      success: true,
      data: {
        pairingCode: pairingCode ?? null,
        code: code ?? null,
        count: count ?? 1,
      },
      orgName,
      orgId,
      date,
      companyId,
    };

    console.log("Refreshing QR code:", JSON.stringify(payload));

    let qrBase64: string | null = null;
    try {
      const res = await fetch(REFRESH_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        try {
          const data = await res.json();
          const obj = Array.isArray(data) ? data[0] : data;
          qrBase64 = obj?.data?.base64 ?? null;
        } catch {
          console.warn("Refresh response not JSON");
        }
      } else {
        const text = await res.text().catch(() => "");
        console.warn("Refresh webhook error:", res.status, text);
      }
    } catch (fetchErr) {
      console.warn("Refresh webhook fetch error:", fetchErr);
    }

    return new Response(JSON.stringify({
      success: !!qrBase64,
      qrCode: qrBase64,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
