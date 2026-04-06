import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID");

    if (!CF_TOKEN || !CF_ZONE) {
      console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID");
      return new Response(JSON.stringify({ error: "Missing Cloudflare config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all pending (non-active) domains that have a Cloudflare hostname ID
    const { data: pendingDomains, error: fetchErr } = await adminClient
      .from("tenant_domains")
      .select("id, hostname, cloudflare_hostname_id, organization_id")
      .eq("is_active", false)
      .not("cloudflare_hostname_id", "is", null);

    if (fetchErr) {
      console.error("DB fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingDomains?.length) {
      return new Response(JSON.stringify({ checked: 0, activated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let activated = 0;
    const results: { hostname: string; status: string; ssl: string; active: boolean }[] = [];

    for (const domain of pendingDomains) {
      try {
        const cfRes = await fetch(
          `${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`,
          { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
        );
        const cfData = await cfRes.json();
        checked++;

        if (!cfData.success) {
          console.warn(`CF check failed for ${domain.hostname}:`, cfData.errors);
          continue;
        }

        const cfHostname = cfData.result;
        const sslStatus = cfHostname.ssl?.status || "unknown";
        const verificationStatus = cfHostname.status || "unknown";
        const isActive = verificationStatus === "active" && sslStatus === "active";

        // Update DB
        await adminClient
          .from("tenant_domains")
          .update({
            ssl_status: sslStatus,
            verification_status: verificationStatus,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", domain.id);

        results.push({
          hostname: domain.hostname,
          status: verificationStatus,
          ssl: sslStatus,
          active: isActive,
        });

        if (isActive) {
          activated++;
          console.log(`✅ Domain activated: ${domain.hostname}`);
        }
      } catch (err) {
        console.error(`Error checking ${domain.hostname}:`, err);
      }
    }

    console.log(`Domain auto-check: ${checked} checked, ${activated} activated`);

    return new Response(JSON.stringify({ checked, activated, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-domains-status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
