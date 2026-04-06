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

  // Check if wildcard CNAME already exists
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
    console.log("Wildcard CNAME already exists:", searchData.result[0].id);
    return { already_exists: true, record_id: searchData.result[0].id };
  }

  // Create wildcard CNAME
  const createRes = await fetch(`${CF_API}/zones/${cfZone}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CNAME",
      name: "*",
      content: PLATFORM_DOMAIN,
      proxied: true,
      comment: "Auto-created wildcard for tenant subdomains",
    }),
  });
  const createData = await createRes.json();
  console.log("Cloudflare wildcard create response:", createRes.status, JSON.stringify(createData));

  if (!createData.success) {
    return { already_exists: false, error: createData.errors?.[0]?.message || "Failed to create wildcard DNS" };
  }

  return { already_exists: false, record_id: createData.result.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorJson("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error("Auth getUser error:", userErr?.message || "no user");
      return errorJson("Unauthorized", 401);
    }
    const userId = user.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isManager } = await adminClient.rpc("is_org_manager_or_above", { _user_id: userId });
    if (!isManager) {
      return errorJson("Forbidden", 403);
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.organization_id) {
      return errorJson("No organization", 400);
    }

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
      if (!newSlug || newSlug.length < 3) {
        return errorJson("Slug deve ter ao menos 3 caracteres (letras, números e hífens)", 400);
      }

      const { data: existing } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", newSlug)
        .neq("id", profile.organization_id)
        .maybeSingle();
      if (existing) {
        return errorJson("Este slug já está em uso por outra organização", 409);
      }

      const { error: updateErr } = await adminClient
        .from("organizations")
        .update({ slug: newSlug })
        .eq("id", profile.organization_id);
      if (updateErr) {
        console.error("Slug update error:", updateErr);
        return errorJson("Erro ao atualizar slug", 500);
      }

      // Ensure wildcard DNS exists (fire-and-forget, don't block slug update)
      const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
      const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID");
      if (CF_TOKEN && CF_ZONE) {
        const dnsResult = await ensureWildcardDns(CF_TOKEN, CF_ZONE);
        console.log("Wildcard DNS check during slug update:", JSON.stringify(dnsResult));
      }

      return json({ success: true, slug: newSlug });
    }

    // ─── Cloudflare secrets check ──────────────────────────────────
    const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID");

    if (!CF_TOKEN || !CF_ZONE) {
      console.error("Missing Cloudflare secrets. CF_TOKEN set:", !!CF_TOKEN, "CF_ZONE set:", !!CF_ZONE);
      return errorJson("Server configuration error: Missing Cloudflare credentials", 500);
    }

    // ─── Ensure Wildcard DNS ───────────────────────────────────────
    if (action === "ensure_wildcard_dns") {
      const result = await ensureWildcardDns(CF_TOKEN, CF_ZONE);
      if (result.error) {
        return errorJson(result.error, 502);
      }
      return json({
        success: true,
        already_exists: result.already_exists,
        record_id: result.record_id,
        message: result.already_exists
          ? "Wildcard CNAME already exists"
          : "Wildcard CNAME created successfully",
      });
    }

    // ─── Create Custom Hostname ────────────────────────────────────
    if (action === "create") {
      const hostname = (body.hostname as string || "").toLowerCase().trim();
      if (!hostname || !hostname.includes(".")) {
        return errorJson("Hostname inválido", 400);
      }

      const { data: existing } = await adminClient
        .from("tenant_domains")
        .select("id")
        .eq("hostname", hostname)
        .maybeSingle();
      if (existing) {
        return errorJson("Domínio já cadastrado", 409);
      }

      const cfRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname,
          ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
        }),
      });
      const cfText = await cfRes.text();
      console.log("Cloudflare create response:", cfRes.status, cfText);

      let cfData: any;
      try {
        cfData = JSON.parse(cfText);
      } catch {
        return errorJson("Cloudflare returned invalid JSON", 502, { cf_status: cfRes.status });
      }

      if (!cfData.success) {
        console.error("Cloudflare create error:", JSON.stringify(cfData.errors));
        return errorJson("Erro no Cloudflare", 502, { details: cfData.errors });
      }

      const cfHostname = cfData.result;
      const { data: domain, error: insertErr } = await adminClient
        .from("tenant_domains")
        .insert({
          organization_id: profile.organization_id,
          hostname,
          cloudflare_hostname_id: cfHostname.id,
          ssl_status: cfHostname.ssl?.status || "pending",
          verification_status: cfHostname.status || "pending",
          is_active: false,
          created_by: userId,
        })
        .select()
        .single();

      if (insertErr) {
        console.error("DB insert error:", insertErr);
        return errorJson("Erro ao salvar domínio", 500);
      }

      return json({
        domain,
        instructions: `Aponte o CNAME do domínio ${hostname} para ${PLATFORM_DOMAIN}`,
      }, 201);
    }

    // ─── Check Status ──────────────────────────────────────────────
    if (action === "check_status") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!domain || !domain.cloudflare_hostname_id) {
        return errorJson("Domínio não encontrado", 404);
      }

      const cfRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const cfText = await cfRes.text();
      console.log("Cloudflare check_status response:", cfRes.status, cfText);

      let cfData: any;
      try {
        cfData = JSON.parse(cfText);
      } catch {
        return errorJson("Cloudflare returned invalid JSON", 502, { cf_status: cfRes.status });
      }

      if (!cfData.success) {
        return errorJson("Erro ao consultar Cloudflare", 502, { details: cfData.errors });
      }

      const cfHostname = cfData.result;
      const sslStatus = cfHostname.ssl?.status || "unknown";
      const verificationStatus = cfHostname.status || "unknown";
      const isActive = verificationStatus === "active" && sslStatus === "active";

      await adminClient
        .from("tenant_domains")
        .update({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", domainId);

      return json({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive });
    }

    // ─── Delete ────────────────────────────────────────────────────
    if (action === "delete") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!domain) {
        return errorJson("Domínio não encontrado", 404);
      }

      if (domain.cloudflare_hostname_id) {
        const delRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${CF_TOKEN}` },
        });
        console.log("Cloudflare delete response:", delRes.status, await delRes.text());
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
