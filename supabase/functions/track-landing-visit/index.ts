import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashIp(ip: string): Promise<string> {
  const buf = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { broker_token, property_id, referrer, not_found, org_slug, property_code } = body;

    // Telemetria de 404 — landing pública não resolveu (anônimo bate aqui)
    if (not_found) {
      console.warn(JSON.stringify({
        level: "warn",
        event: "landing_not_found",
        org_slug: org_slug ?? null,
        property_code: property_code ?? null,
        broker_token: broker_token ?? null,
        referrer: referrer ?? null,
        ua: req.headers.get("user-agent") ?? null,
        timestamp: new Date().toISOString(),
      }));
      return new Response(JSON.stringify({ tracked: false, reason: "not_found_logged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!broker_token || !property_id) {
      return new Response(JSON.stringify({ error: "broker_token and property_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link } = await supabase
      .from("property_share_links")
      .select("id")
      .eq("broker_token", broker_token)
      .eq("property_id", property_id)
      .eq("active", true)
      .maybeSingle();

    if (!link) {
      return new Response(JSON.stringify({ tracked: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || null;
    const ipHash = await hashIp(ip);

    await supabase.from("property_share_visits").insert({
      share_link_id: link.id,
      ip_hash: ipHash,
      user_agent: ua,
      referrer: referrer || null,
    });

    return new Response(JSON.stringify({ tracked: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-landing-visit error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
