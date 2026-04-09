import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const CF_API = "https://api.cloudflare.com/client/v4";
const LOVABLE_ORIGIN_IP = "185.158.133.1";

// Ensure A record is present with proxy disabled to avoid Cloudflare Error 1000
async function ensureDnsOnlyARecord(
  cfToken: string,
  zoneId: string,
  name: string,
): Promise<boolean> {
  const searchRes = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${cfToken}` } }
  );
  const searchData = await searchRes.json();
  const records = searchData?.result || [];
  let changed = false;

  for (const record of records) {
    if (record.type === "CNAME") {
      console.log(`Fixing CNAME→A for ${name}: deleting CNAME ${record.id} (${record.content})`);
      await fetch(`${CF_API}/zones/${zoneId}/dns_records/${record.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      changed = true;
      continue;
    }

    if (record.type === "A") {
      const needsUpdate = record.content !== LOVABLE_ORIGIN_IP || record.proxied !== false;
      if (!needsUpdate) {
        return changed;
      }

      console.log(`Updating A record for ${name} to dns-only ${LOVABLE_ORIGIN_IP}`);
      const updateRes = await fetch(`${CF_API}/zones/${zoneId}/dns_records/${record.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "A",
          name,
          content: LOVABLE_ORIGIN_IP,
          proxied: false,
          comment: "Auto-fixed to DNS-only A record for platform site",
        }),
      });
      const updateData = await updateRes.json();
      return updateData?.success === true || changed;
    }
  }

  console.log(`Creating dns-only A record for ${name} → ${LOVABLE_ORIGIN_IP}`);
  const createRes = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "A",
      name,
      content: LOVABLE_ORIGIN_IP,
      proxied: false,
      comment: "Auto-fixed to DNS-only A record for platform site",
    }),
  });
  const createData = await createRes.json();
  return createData?.success === true || changed;
}

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

    const { data: pendingDomains, error: fetchErr } = await adminClient
      .from("tenant_domains")
      .select("id, hostname, cloudflare_hostname_id, cloudflare_zone_id, zone_mode, zone_status, organization_id")
      .or("and(zone_mode.eq.full_zone,cloudflare_zone_id.not.is.null),and(is_active.eq.false,cloudflare_hostname_id.not.is.null)");

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
    const results: { hostname: string; status: string; ssl: string; active: boolean; zone_status?: string; dns_fixed?: boolean }[] = [];

    for (const domain of pendingDomains) {
      try {
        // ── Full Zone mode ──
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
            // Auto-fix: replace CNAME with A record to avoid Error 1000
            const dnsFixed = await ensureDnsOnlyARecord(CF_TOKEN, domain.cloudflare_zone_id, domain.hostname);
            if (dnsFixed) {
              console.log(`🔧 Fixed DNS for ${domain.hostname}`);
            }
            // Also fix root if www
            if (domain.hostname.startsWith("www.")) {
              const rootName = domain.hostname.replace(/^www\./, "");
              await ensureDnsOnlyARecord(CF_TOKEN, domain.cloudflare_zone_id, rootName);
            }

            // Check for A record
            const aCheckRes = await fetch(
              `${CF_API}/zones/${domain.cloudflare_zone_id}/dns_records?name=${encodeURIComponent(domain.hostname)}&type=A`,
              { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
            );
            const aCheckData = await aCheckRes.json();
            const hasARecord = aCheckData.success && aCheckData.result?.length > 0;

            if (hasARecord) {
              console.log(`✅ Full-zone domain ready: ${domain.hostname}`);

              if (domain.hostname.startsWith("www.")) {
                const rootHostname = domain.hostname.replace(/^www\./, "");
                const { data: rootAlias } = await adminClient
                  .from("tenant_domains")
                  .select("id")
                  .eq("hostname", rootHostname)
                  .eq("organization_id", domain.organization_id)
                  .maybeSingle();

                const rootPayload = {
                  cloudflare_zone_id: domain.cloudflare_zone_id,
                  zone_mode: "full_zone",
                  zone_status: "active",
                  nameservers,
                  ssl_status: "active",
                  verification_status: "active",
                  is_active: true,
                  updated_at: new Date().toISOString(),
                };

                if (rootAlias?.id) {
                  await adminClient
                    .from("tenant_domains")
                    .update(rootPayload)
                    .eq("id", rootAlias.id);
                } else {
                  await adminClient
                    .from("tenant_domains")
                    .insert({
                      organization_id: domain.organization_id,
                      hostname: rootHostname,
                      ...rootPayload,
                    });
                }
              }

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
                dns_fixed: dnsFixed,
              });
              activated++;
            } else {
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
                status: "no_a_record",
                ssl: "pending",
                active: false,
                zone_status: "active",
              });
            }
          } else {
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

        // ── Custom Hostname mode ──
        const cfRes = await fetch(
          `${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`,
          { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
        );
        const cfData = await cfRes.json();
        checked++;

        if (!cfData.success) {
          console.warn(`CF check failed for ${domain.hostname}:`, cfData.errors);
          results.push({ hostname: domain.hostname, status: "cf_error", ssl: "unknown", active: false });
          continue;
        }

        const cfHostname = cfData.result;
        const sslStatus = cfHostname.ssl?.status || "unknown";
        const verificationStatus = cfHostname.status || "unknown";
        const isActive = verificationStatus === "active" && sslStatus === "active";

        await adminClient
          .from("tenant_domains")
          .update({
            ssl_status: sslStatus,
            verification_status: verificationStatus,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", domain.id);

        results.push({ hostname: domain.hostname, status: verificationStatus, ssl: sslStatus, active: isActive });

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
