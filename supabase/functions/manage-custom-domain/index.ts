import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CF_API = "https://api.cloudflare.com/client/v4";
const PLATFORM_DOMAIN = "portadocorretor.com.br";
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type RuntimeConfig = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  cloudflareToken: string | null;
  cloudflareZoneId: string | null;
  cloudflareAccountId: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function errorJson(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: jsonHeaders });
}

function getRuntimeConfig(): RuntimeConfig {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    cloudflareToken: Deno.env.get("CLOUDFLARE_API_TOKEN"),
    cloudflareZoneId: Deno.env.get("CLOUDFLARE_ZONE_ID"),
    cloudflareAccountId: Deno.env.get("CLOUDFLARE_ACCOUNT_ID"),
  };
}

function missingEntries(entries: Array<[string, string | null]>) {
  return entries.filter(([, value]) => !value).map(([name]) => name);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return { text: "", data: null };
  }

  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: null };
  }
}

function buildCloudflareZoneCreateMessage(responseStatus: number, data: any, hasAccountId: boolean) {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const messageBlob = errors
    .map((error: any) => String(error?.message ?? ""))
    .join(" | ")
    .toLowerCase();

  if (responseStatus === 401) {
    return "Falha de autenticação com o Cloudflare. Verifique o token configurado.";
  }

  if (responseStatus === 403 || messageBlob.includes("permission") || messageBlob.includes("forbidden")) {
    return "O token do Cloudflare não tem permissão para criar zonas. Garanta 'Zone:Zone:Edit' em 'All zones'.";
  }

  if (messageBlob.includes("unhandled server error")) {
    return hasAccountId
      ? "O Cloudflare recusou a criação da zona. Verifique se o token tem 'Zone:Zone:Edit' em 'All zones'."
      : "O Cloudflare recusou a criação da zona. Verifique se o token tem 'Zone:Zone:Edit' em 'All zones' e, se sua conta exigir, configure também o secret CLOUDFLARE_ACCOUNT_ID.";
  }

  return errors[0]?.message || "Erro ao adicionar zona no Cloudflare";
}

// ─── Wildcard DNS helper ────────────────────────────────────────
// The wildcard CNAME must point to the actual origin (Lovable app),
// NOT to the platform domain itself — otherwise Cloudflare creates
// a prohibited loop (Error 1000: DNS points to prohibited IP).
const LOVABLE_ORIGIN = "portocaicaraimoveis.lovable.app";

async function ensureWildcardDns(cfToken: string, cfZone: string): Promise<{ already_exists: boolean; record_id?: string; error?: string; updated?: boolean }> {
  const wildcard = `*.${PLATFORM_DOMAIN}`;
  const searchRes = await fetch(
    `${CF_API}/zones/${cfZone}/dns_records?type=CNAME&name=${encodeURIComponent(wildcard)}`,
    { headers: { Authorization: `Bearer ${cfToken}` } }
  );
  const { data: searchData } = await readJsonResponse(searchRes);

  if (!searchData?.success) {
    console.error("Cloudflare DNS search error:", JSON.stringify(searchData?.errors ?? []));
    return { already_exists: false, error: "Failed to query DNS records" };
  }

  if (searchData.result && searchData.result.length > 0) {
    const existing = searchData.result[0];
    // Fix: if the existing record points to the platform domain (loop), update it
    if (existing.content === PLATFORM_DOMAIN || existing.content === `${PLATFORM_DOMAIN}.`) {
      console.log("Fixing wildcard CNAME loop: changing target from", existing.content, "to", LOVABLE_ORIGIN);
      const updateRes = await fetch(`${CF_API}/zones/${cfZone}/dns_records/${existing.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CNAME",
          name: "*",
          content: LOVABLE_ORIGIN,
          proxied: true,
          comment: "Auto-fixed wildcard for tenant subdomains (origin: Lovable)",
        }),
      });
      const { data: updateData } = await readJsonResponse(updateRes);
      if (!updateData?.success) {
        return { already_exists: true, error: updateData?.errors?.[0]?.message || "Failed to fix wildcard DNS" };
      }
      return { already_exists: true, record_id: existing.id, updated: true };
    }
    return { already_exists: true, record_id: existing.id };
  }

  const createRes = await fetch(`${CF_API}/zones/${cfZone}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CNAME",
      name: "*",
      content: LOVABLE_ORIGIN,
      proxied: true,
      comment: "Auto-created wildcard for tenant subdomains (origin: Lovable)",
    }),
  });
  const { data: createData } = await readJsonResponse(createRes);

  if (!createData?.success) {
    return { already_exists: false, error: createData?.errors?.[0]?.message || "Failed to create wildcard DNS" };
  }

  return { already_exists: false, record_id: createData.result.id };
}

// ─── Auth helper ────────────────────────────────────────────────
async function authenticateRequest(
  req: Request,
  env: { supabaseUrl: string; supabaseAnonKey: string; supabaseServiceRoleKey: string }
) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { error: errorJson("Unauthorized", 401) };

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: errorJson("Unauthorized", 401) };

  const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
  const { data: isManager } = await adminClient.rpc("is_org_manager_or_above", { _user_id: user.id });
  if (!isManager) return { error: errorJson("Forbidden", 403) };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) return { error: errorJson("No organization", 400) };

  return { userId: user.id, orgId: profile.organization_id, adminClient };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const env = getRuntimeConfig();

    const missingSupabase = missingEntries([
      ["SUPABASE_URL", env.supabaseUrl],
      ["SUPABASE_ANON_KEY", env.supabaseAnonKey],
      ["SUPABASE_SERVICE_ROLE_KEY", env.supabaseServiceRoleKey],
    ]);

    if (missingSupabase.length > 0) {
      console.error("Missing Supabase env vars:", missingSupabase);
      return errorJson("Server configuration error: Missing Supabase credentials", 500, {
        missing: missingSupabase,
      });
    }

    const auth = await authenticateRequest(req, {
      supabaseUrl: env.supabaseUrl!,
      supabaseAnonKey: env.supabaseAnonKey!,
      supabaseServiceRoleKey: env.supabaseServiceRoleKey!,
    });

    if ("error" in auth && !("userId" in auth)) return auth.error;
    const { userId, orgId, adminClient } = auth as { userId: string; orgId: string; adminClient: any };

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorJson("Invalid or empty request body", 400);
    }

    const action = body.action as string;

    // ─── Update Slug ───────────────────────────────────────────────
    if (action === "update_slug") {
      const newSlug = (body.slug as string || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
      if (!newSlug || newSlug.length < 3) return errorJson("Slug deve ter ao menos 3 caracteres", 400);

      const { data: existing } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", newSlug)
        .neq("id", orgId)
        .maybeSingle();

      if (existing) return errorJson("Este slug já está em uso", 409);

      const { error: updateErr } = await adminClient.from("organizations").update({ slug: newSlug }).eq("id", orgId);
      if (updateErr) return errorJson("Erro ao atualizar slug", 500);

      if (env.cloudflareToken && env.cloudflareZoneId) {
        const dnsResult = await ensureWildcardDns(env.cloudflareToken, env.cloudflareZoneId);
        console.log("Wildcard DNS check:", JSON.stringify(dnsResult));
      }

      return json({ success: true, slug: newSlug });
    }

    const missingCloudflare = missingEntries([
      ["CLOUDFLARE_API_TOKEN", env.cloudflareToken],
      ["CLOUDFLARE_ZONE_ID", env.cloudflareZoneId],
    ]);

    if (missingCloudflare.length > 0) {
      console.error("Missing Cloudflare env vars:", missingCloudflare);
      return errorJson("Server configuration error: Missing Cloudflare credentials", 500, {
        missing: missingCloudflare,
      });
    }

    // ─── Ensure Wildcard DNS ───────────────────────────────────────
    if (action === "ensure_wildcard_dns") {
      const result = await ensureWildcardDns(env.cloudflareToken!, env.cloudflareZoneId!);
      if (result.error) return errorJson(result.error, 502);
      return json({ success: true, already_exists: result.already_exists, record_id: result.record_id });
    }

    // ─── Add Zone (Full DNS Control) ───────────────────────────────
    if (action === "add_zone") {
      const hostname = (body.hostname as string || "").toLowerCase().trim();
      if (!hostname || !hostname.includes(".")) return errorJson("Hostname inválido", 400);

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

      console.log("Cloudflare add_zone config:", JSON.stringify({
        rootDomain,
        hasAccountId: !!env.cloudflareAccountId,
      }));

      const checkRes = await fetch(`${CF_API}/zones?name=${encodeURIComponent(rootDomain)}`, {
        headers: { Authorization: `Bearer ${env.cloudflareToken!}` },
      });
      const { text: checkText, data: checkData } = await readJsonResponse(checkRes);
      console.log("CF zone lookup:", checkRes.status, checkText);

      if (!checkRes.ok || !checkData?.success) {
        return errorJson("Não foi possível consultar zonas no Cloudflare. Verifique as permissões do token.", 502, {
          cf_status: checkRes.status,
          details: checkData?.errors ?? [{ code: checkRes.status, message: checkText || checkRes.statusText }],
        });
      }

      let cfZoneResult: any;

      if (checkData.result?.length > 0) {
        cfZoneResult = checkData.result[0];
        console.log("Zone already exists:", cfZoneResult.id, cfZoneResult.status);
      } else {
        const createZonePayload: Record<string, unknown> = {
          name: rootDomain,
          type: "full",
        };

        if (env.cloudflareAccountId) {
          createZonePayload.account = { id: env.cloudflareAccountId };
        }

        const createRes = await fetch(`${CF_API}/zones`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.cloudflareToken!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createZonePayload),
        });
        const { text: createText, data: createData } = await readJsonResponse(createRes);
        console.log("CF zone create:", createRes.status, createText);

        if (!createRes.ok || !createData?.success) {
          return errorJson(
            buildCloudflareZoneCreateMessage(createRes.status, createData, !!env.cloudflareAccountId),
            502,
            {
              cf_status: createRes.status,
              details: createData?.errors ?? [{ code: createRes.status, message: createText || createRes.statusText }],
              hints: {
                needs_zone_edit_all_zones: true,
                has_account_id_configured: !!env.cloudflareAccountId,
              },
            }
          );
        }

        cfZoneResult = createData.result;
      }

      const nameservers = cfZoneResult.name_servers || [];
      const zoneId = cfZoneResult.id;
      const zoneStatus = cfZoneResult.status || "pending";

      try {
        const createHostnameDnsRes = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.cloudflareToken!}`,
            "Content-Type": "application/json",
          },
           body: JSON.stringify({
            type: "CNAME",
            name: hostname,
            content: LOVABLE_ORIGIN,
            proxied: true,
            comment: "Auto-created for platform site",
          }),
        });
        await createHostnameDnsRes.text();

        if (hostname.startsWith("www.")) {
          const createRootDnsRes = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.cloudflareToken!}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "CNAME",
              name: "@",
              content: PLATFORM_DOMAIN,
              proxied: true,
              comment: "Auto-created root for platform site",
            }),
          });
          await createRootDnsRes.text();
        }
      } catch (e) {
        console.warn("DNS record creation warning (may already exist):", e);
      }

      const { data: existingDomain } = await adminClient
        .from("tenant_domains")
        .select("id")
        .eq("hostname", hostname)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (existingDomain) {
        await adminClient.from("tenant_domains").update({
          cloudflare_zone_id: zoneId,
          zone_mode: "full_zone",
          nameservers,
          zone_status: zoneStatus,
          updated_at: new Date().toISOString(),
        }).eq("id", existingDomain.id);
      } else {
        const cfHostRes = await fetch(`${CF_API}/zones/${env.cloudflareZoneId!}/custom_hostnames`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.cloudflareToken!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hostname,
            ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
          }),
        });
        const { data: cfHostData } = await readJsonResponse(cfHostRes);
        const cfHostnameId = cfHostData?.success ? cfHostData.result?.id : null;

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
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", orgId)
        .single();
      if (!domain?.cloudflare_zone_id) return errorJson("Zona não encontrada", 404);

      const cfRes = await fetch(`${CF_API}/zones/${domain.cloudflare_zone_id}`, {
        headers: { Authorization: `Bearer ${env.cloudflareToken!}` },
      });
      const { data: cfData } = await readJsonResponse(cfRes);
      if (!cfData?.success) return errorJson("Erro ao consultar zona", 502, { details: cfData?.errors });

      const zoneStatus = cfData.result.status;
      const nameservers = cfData.result.name_servers || [];

      await adminClient.from("tenant_domains").update({
        zone_status: zoneStatus,
        nameservers,
        updated_at: new Date().toISOString(),
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

      const cfRes = await fetch(`${CF_API}/zones/${env.cloudflareZoneId!}/custom_hostnames`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.cloudflareToken!}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname,
          ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
        }),
      });
      const { text: cfText, data: cfData } = await readJsonResponse(cfRes);
      console.log("Cloudflare create response:", cfRes.status, cfText);

      if (!cfData?.success) return errorJson("Erro no Cloudflare", 502, { details: cfData?.errors });

      const cfHostname = cfData.result;
      const { data: domain, error: insertErr } = await adminClient.from("tenant_domains").insert({
        organization_id: orgId,
        hostname,
        cloudflare_hostname_id: cfHostname.id,
        ssl_status: cfHostname.ssl?.status || "pending",
        verification_status: cfHostname.status || "pending",
        zone_mode: "custom_hostname",
        is_active: false,
        created_by: userId,
      }).select().single();

      if (insertErr) return errorJson("Erro ao salvar domínio", 500);
      return json({ domain, instructions: `Aponte o CNAME de ${hostname} para ${PLATFORM_DOMAIN}` }, 201);
    }

    // ─── Check Status ──────────────────────────────────────────────
    if (action === "check_status") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", orgId)
        .single();
      if (!domain || !domain.cloudflare_hostname_id) return errorJson("Domínio não encontrado", 404);

      const cfRes = await fetch(`${CF_API}/zones/${env.cloudflareZoneId!}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
        headers: { Authorization: `Bearer ${env.cloudflareToken!}` },
      });
      const { data: cfData } = await readJsonResponse(cfRes);
      if (!cfData?.success) return errorJson("Erro ao consultar Cloudflare", 502, { details: cfData?.errors });

      const cfHostname = cfData.result;
      const sslStatus = cfHostname.ssl?.status || "unknown";
      const verificationStatus = cfHostname.status || "unknown";
      const isActive = verificationStatus === "active" && sslStatus === "active";

      await adminClient.from("tenant_domains").update({
        ssl_status: sslStatus,
        verification_status: verificationStatus,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }).eq("id", domainId);

      return json({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive });
    }

    // ─── Delete ────────────────────────────────────────────────────
    if (action === "delete") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", orgId)
        .single();
      if (!domain) return errorJson("Domínio não encontrado", 404);

      if (domain.cloudflare_hostname_id) {
        const delRes = await fetch(`${CF_API}/zones/${env.cloudflareZoneId!}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${env.cloudflareToken!}` },
        });
        console.log("CF hostname delete:", delRes.status, await delRes.text());
      }

      if ((domain as any).cloudflare_zone_id && (domain as any).zone_mode === "full_zone") {
        try {
          const delZoneRes = await fetch(`${CF_API}/zones/${(domain as any).cloudflare_zone_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${env.cloudflareToken!}` },
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
