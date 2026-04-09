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
      .select("id, hostname, cloudflare_hostname_id, cloudflare_zone_id, zone_mode, zone_status, organization_id")
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
    const results: { hostname: string; status: string; ssl: string; active: boolean; zone_status?: string }[] = [];

    for (const domain of pendingDomains) {
      try {
        // ── Full Zone mode: zone's own SSL handles certificates ──
        if (domain.zone_mode === "full_zone" && domain.cloudflare_zone_id) {
          const zoneRes = await fetch(
            `${CF_API}/zones/${domain.cloudflare_zone_id}`,
            { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
          );
          const zoneData = await zoneRes.json();
          checked++;

          if (!zoneData.success) {
            console.warn(`Zone check failed for ${domain.hostname}:`, zoneData.errors);
            continue;
          }

          const zoneStatus = zoneData.result.status;
          const nameservers = zoneData.result.name_servers || [];
          console.log(`Zone check for ${domain.hostname}: status=${zoneStatus}`);

          if (zoneStatus === "active") {
            // Zone is active → DNS is working, Cloudflare Universal SSL handles certs.
            // Verify the CNAME/A record exists in the zone for this hostname.
            const dnsCheckRes = await fetch(
              `${CF_API}/zones/${domain.cloudflare_zone_id}/dns_records?name=${encodeURIComponent(domain.hostname)}&type=CNAME`,
              { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
            );
            const dnsCheckData = await dnsCheckRes.json();
            const hasCname = dnsCheckData.success && dnsCheckData.result?.length > 0;

            if (hasCname) {
              // CNAME exists + zone active → domain is fully operational
              console.log(`✅ Full-zone domain ready: ${domain.hostname} (zone active + CNAME exists)`);
              await adminClient
                .from("tenant_domains")
                .update({
                  zone_status: "active",
                  nameservers,
                  ssl_status: "active",
                  verification_status: "active",
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", domain.id);

              results.push({
                hostname: domain.hostname,
                status: "active",
                ssl: "active",
                active: true,
                zone_status: "active",
              });
              activated++;
            } else {
              console.log(`Zone active but no CNAME for ${domain.hostname}, checking A records...`);
              // Check for A records as fallback
              const aCheckRes = await fetch(
                `${CF_API}/zones/${domain.cloudflare_zone_id}/dns_records?name=${encodeURIComponent(domain.hostname)}&type=A`,
                { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
              );
              const aCheckData = await aCheckRes.json();
              const hasARecord = aCheckData.success && aCheckData.result?.length > 0;

              if (hasARecord) {
                console.log(`✅ Full-zone domain ready via A record: ${domain.hostname}`);
                await adminClient
                  .from("tenant_domains")
                  .update({
                    zone_status: "active",
                    nameservers,
                    ssl_status: "active",
                    verification_status: "active",
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", domain.id);

                results.push({
                  hostname: domain.hostname,
                  status: "active",
                  ssl: "active",
                  active: true,
                  zone_status: "active",
                });
                activated++;
              } else {
                // Zone active but no DNS record for this hostname
                await adminClient
                  .from("tenant_domains")
                  .update({
                    zone_status: "active",
                    nameservers,
                    verification_status: "active",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", domain.id);

                results.push({
                  hostname: domain.hostname,
                  status: "no_dns_record",
                  ssl: "pending",
                  active: false,
                  zone_status: "active",
                });
              }
            }
          } else {
            // Zone not yet active (NS haven't propagated)
            await adminClient
              .from("tenant_domains")
              .update({
                zone_status: zoneStatus,
                nameservers,
                updated_at: new Date().toISOString(),
              })
              .eq("id", domain.id);

            results.push({
              hostname: domain.hostname,
              status: "zone_pending",
              ssl: "pending",
              active: false,
              zone_status: zoneStatus,
            });
          }
          continue;
        }

        // ── Custom Hostname mode (default): check via platform zone ──
        const cfRes = await fetch(
          `${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`,
          { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
        );
        const cfData = await cfRes.json();
        checked++;

        if (!cfData.success) {
          console.warn(`CF check failed for ${domain.hostname}:`, cfData.errors);
          results.push({
            hostname: domain.hostname,
            status: "cf_error",
            ssl: "unknown",
            active: false,
          });
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
