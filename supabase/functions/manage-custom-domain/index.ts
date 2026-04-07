import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CF_API = "https://api.cloudflare.com/client/v4";
const PLATFORM_DOMAIN = "portadocorretor.com.br";
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function errorJson(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: jsonHeaders });
}

// ─── Wildcard DNS helper ────────────────────────────────────────
async function ensureWildcardDns(cfToken: string, cfZone: string): Promise<{ already_exists: boolean; record_id?: string; error?: string }> {
  const wildcard = `*.${PLATFORM_DOMAIN}`;
  const searchRes = await fetch(
    `${CF_API}/zones/${cfZone}/dns_records?type=CNAME&name=${encodeURIComponent(wildcard)}`,
    { headers: { Authorization: `Bearer ${cfToken}` } }
  );
  const searchData = await searchRes.json();
  if (!searchData.success) {
    console.error("Cloudflare DNS search error:", JSON.stringify(searchData.errors));
    return { already_exists: false, error: "Failed to query DNS records" };
  }
  if (searchData.result && searchData.result.length > 0) {
    return { already_exists: true, record_id: searchData.result[0].id };
  }
  const createRes = await fetch(`${CF_API}/zones/${cfZone}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CNAME", name: "*", content: PLATFORM_DOMAIN, proxied: true,
      comment: "Auto-created wildcard for tenant subdomains",
    }),
  });
  const createData = await createRes.json();
  if (!createData.success) {
    return { already_exists: false, error: createData.errors?.[0]?.message || "Failed to create wildcard DNS" };
  }
  return { already_exists: false, record_id: createData.result.id };
}

// ─── Auth helper ────────────────────────────────────────────────
async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { error: errorJson("Unauthorized", 401) };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: errorJson("Unauthorized", 401) };

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isManager } = await adminClient.rpc("is_org_manager_or_above", { _user_id: user.id });
  if (!isManager) return { error: errorJson("Forbidden", 403) };

  const { data: profile } = await adminClient.from("profiles").select("organization_id").eq("user_id", user.id).single();
  if (!profile?.organization_id) return { error: errorJson("No organization", 400) };

  return { userId: user.id, orgId: profile.organization_id, adminClient };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateRequest(req);
    if ("error" in auth && !("userId" in auth)) return auth.error;
    const { userId, orgId, adminClient } = auth as { userId: string; orgId: string; adminClient: any };

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return errorJson("Invalid or empty request body", 400); }
    const action = body.action as string;

    // ─── Update Slug ───────────────────────────────────────────────
    if (action === "update_slug") {
      const newSlug = (body.slug as string || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
      if (!newSlug || newSlug.length < 3) return errorJson("Slug deve ter ao menos 3 caracteres", 400);

      const { data: existing } = await adminClient.from("organizations").select("id").eq("slug", newSlug).neq("id", orgId).maybeSingle();
      if (existing) return errorJson("Este slug já está em uso", 409);

      const { error: updateErr } = await adminClient.from("organizations").update({ slug: newSlug }).eq("id", orgId);
      if (updateErr) return errorJson("Erro ao atualizar slug", 500);

      const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
      const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID");
      if (CF_TOKEN && CF_ZONE) {
        const dnsResult = await ensureWildcardDns(CF_TOKEN, CF_ZONE);
        console.log("Wildcard DNS check:", JSON.stringify(dnsResult));
      }
      return json({ success: true, slug: newSlug });
    }

    // ─── Cloudflare secrets check ──────────────────────────────────
    const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID");
    if (!CF_TOKEN || !CF_ZONE) return errorJson("Missing Cloudflare credentials", 500);

    // ─── Ensure Wildcard DNS ───────────────────────────────────────
    if (action === "ensure_wildcard_dns") {
      const result = await ensureWildcardDns(CF_TOKEN, CF_ZONE);
      if (result.error) return errorJson(result.error, 502);
      return json({ success: true, already_exists: result.already_exists, record_id: result.record_id });
    }

    // ─── Add Zone (Full DNS Control) ───────────────────────────────
    if (action === "add_zone") {
      const hostname = (body.hostname as string || "").toLowerCase().trim();
      if (!hostname || !hostname.includes(".")) return errorJson("Hostname inválido", 400);

      // Extract root domain
      const parts = hostname.split(".");
      let rootDomain = hostname;
      if (parts.length > 2) {
        const lastTwo = parts.slice(-2).join(".");
        if (["com.br", "org.br", "net.br", "edu.br", "gov.br", "co.uk", "com.au"].includes(lastTwo)) {
          rootDomain = parts.slice(-3).join(".");
        } else {
          rootDomain = parts.slice(-2).join(".");
        }
      }

      // Check if zone already exists in CF account
      const checkRes = await fetch(`${CF_API}/zones?name=${encodeURIComponent(rootDomain)}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const checkData = await checkRes.json();

      let cfZoneResult: any;

      if (checkData.success && checkData.result?.length > 0) {
        cfZoneResult = checkData.result[0];
        console.log("Zone already exists:", cfZoneResult.id, cfZoneResult.status);
      } else {
        // Create zone
        const createRes = await fetch(`${CF_API}/zones`, {
          method: "POST",
          headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: rootDomain, type: "full" }),
        });
        const createData = await createRes.json();
        console.log("CF zone create:", createRes.status, JSON.stringify(createData));

        if (!createData.success) {
          return errorJson(createData.errors?.[0]?.message || "Erro ao adicionar zona no Cloudflare", 502, { details: createData.errors });
        }
        cfZoneResult = createData.result;
      }

      const nameservers = cfZoneResult.name_servers || [];
      const zoneId = cfZoneResult.id;
      const zoneStatus = cfZoneResult.status || "pending";

      // Add CNAME record pointing hostname to platform domain
      try {
        await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "CNAME", name: hostname, content: PLATFORM_DOMAIN, proxied: true,
            comment: "Auto-created for platform site",
          }),
        });
        // Also add root domain CNAME if hostname is www.*
        if (hostname.startsWith("www.")) {
          await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
            method: "POST",
            headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "CNAME", name: "@", content: PLATFORM_DOMAIN, proxied: true,
              comment: "Auto-created root for platform site",
            }),
          });
        }
      } catch (e) {
        console.warn("DNS record creation warning (may already exist):", e);
      }

      // Check if domain already exists in DB
      const { data: existingDomain } = await adminClient
        .from("tenant_domains").select("id").eq("hostname", hostname).eq("organization_id", orgId).maybeSingle();

      if (existingDomain) {
        // Update existing
        await adminClient.from("tenant_domains").update({
          cloudflare_zone_id: zoneId,
          zone_mode: "full_zone",
          nameservers,
          zone_status: zoneStatus,
          updated_at: new Date().toISOString(),
        }).eq("id", existingDomain.id);
      } else {
        // Also create custom hostname in the platform zone for SSL
        const cfHostRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames`, {
          method: "POST",
          headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            hostname,
            ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
          }),
        });
        const cfHostData = await cfHostRes.json();
        const cfHostnameId = cfHostData.success ? cfHostData.result?.id : null;

        await adminClient.from("tenant_domains").insert({
          organization_id: orgId,
          hostname,
          cloudflare_hostname_id: cfHostnameId,
          cloudflare_zone_id: zoneId,
          zone_mode: "full_zone",
          nameservers,
          zone_status: zoneStatus,
          ssl_status: "pending",
          verification_status: "pending",
          is_active: false,
          created_by: userId,
        });
      }

      return json({
        success: true,
        zone_id: zoneId,
        nameservers,
        zone_status: zoneStatus,
        root_domain: rootDomain,
        instructions: `Acesse seu registrador de domínio e altere os nameservers para: ${nameservers.join(", ")}`,
      }, 201);
    }

    // ─── Check Zone Status ─────────────────────────────────────────
    if (action === "check_zone_status") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains").select("*").eq("id", domainId).eq("organization_id", orgId).single();
      if (!domain?.cloudflare_zone_id) return errorJson("Zona não encontrada", 404);

      const cfRes = await fetch(`${CF_API}/zones/${domain.cloudflare_zone_id}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const cfData = await cfRes.json();
      if (!cfData.success) return errorJson("Erro ao consultar zona", 502);

      const zoneStatus = cfData.result.status;
      const nameservers = cfData.result.name_servers || [];

      await adminClient.from("tenant_domains").update({
        zone_status: zoneStatus,
        nameservers,
        updated_at: new Date().toISOString(),
        // If zone is active, the NS are correctly pointed
        ...(zoneStatus === "active" ? { verification_status: "active" } : {}),
      }).eq("id", domainId);

      return json({ zone_status: zoneStatus, nameservers });
    }

    // ─── Create Custom Hostname ────────────────────────────────────
    if (action === "create") {
      const hostname = (body.hostname as string || "").toLowerCase().trim();
      if (!hostname || !hostname.includes(".")) return errorJson("Hostname inválido", 400);

      const { data: existing } = await adminClient.from("tenant_domains").select("id").eq("hostname", hostname).maybeSingle();
      if (existing) return errorJson("Domínio já cadastrado", 409);

      const cfRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames`, {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname,
          ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
        }),
      });
      const cfText = await cfRes.text();
      console.log("Cloudflare create response:", cfRes.status, cfText);

      let cfData: any;
      try { cfData = JSON.parse(cfText); } catch { return errorJson("Cloudflare returned invalid JSON", 502); }
      if (!cfData.success) return errorJson("Erro no Cloudflare", 502, { details: cfData.errors });

      const cfHostname = cfData.result;
      const { data: domain, error: insertErr } = await adminClient.from("tenant_domains").insert({
        organization_id: orgId, hostname,
        cloudflare_hostname_id: cfHostname.id,
        ssl_status: cfHostname.ssl?.status || "pending",
        verification_status: cfHostname.status || "pending",
        zone_mode: "custom_hostname",
        is_active: false, created_by: userId,
      }).select().single();

      if (insertErr) return errorJson("Erro ao salvar domínio", 500);
      return json({ domain, instructions: `Aponte o CNAME de ${hostname} para ${PLATFORM_DOMAIN}` }, 201);
    }

    // ─── Check Status ──────────────────────────────────────────────
    if (action === "check_status") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains").select("*").eq("id", domainId).eq("organization_id", orgId).single();
      if (!domain || !domain.cloudflare_hostname_id) return errorJson("Domínio não encontrado", 404);

      const cfRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const cfText = await cfRes.text();
      let cfData: any;
      try { cfData = JSON.parse(cfText); } catch { return errorJson("Cloudflare returned invalid JSON", 502); }
      if (!cfData.success) return errorJson("Erro ao consultar Cloudflare", 502, { details: cfData.errors });

      const cfHostname = cfData.result;
      const sslStatus = cfHostname.ssl?.status || "unknown";
      const verificationStatus = cfHostname.status || "unknown";
      const isActive = verificationStatus === "active" && sslStatus === "active";

      await adminClient.from("tenant_domains").update({
        ssl_status: sslStatus, verification_status: verificationStatus,
        is_active: isActive, updated_at: new Date().toISOString(),
      }).eq("id", domainId);

      return json({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive });
    }

    // ─── Delete ────────────────────────────────────────────────────
    if (action === "delete") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains").select("*").eq("id", domainId).eq("organization_id", orgId).single();
      if (!domain) return errorJson("Domínio não encontrado", 404);

      // Delete custom hostname from platform zone
      if (domain.cloudflare_hostname_id) {
        const delRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${CF_TOKEN}` },
        });
        console.log("CF hostname delete:", delRes.status, await delRes.text());
      }

      // Optionally delete zone (only if we created it)
      if ((domain as any).cloudflare_zone_id && (domain as any).zone_mode === "full_zone") {
        try {
          const delZoneRes = await fetch(`${CF_API}/zones/${(domain as any).cloudflare_zone_id}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${CF_TOKEN}` },
          });
          console.log("CF zone delete:", delZoneRes.status, await delZoneRes.text());
        } catch (e) {
          console.warn("Zone delete warning:", e);
        }
      }

      await adminClient.from("tenant_domains").delete().eq("id", domainId);
      return json({ success: true });
    }

    return errorJson("Ação inválida", 400);
  } catch (err) {
    console.error("manage-custom-domain error:", err);
    return errorJson("Internal server error", 500);
  }
});
