import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // User-context client for RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user via getUser
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error("Auth getUser error:", userErr?.message || "no user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    // Service-role client for admin ops
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check manager role
    const { data: isManager } = await adminClient.rpc("is_org_manager_or_above", { _user_id: userId });
    if (!isManager) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Get user's org
    const { data: profile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 400, headers: corsHeaders });
    }

    const body = await req.json();
    const action = body.action as string;

    // ─── Update Slug ───────────────────────────────────────────────
    if (action === "update_slug") {
      const newSlug = (body.slug as string || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
      if (!newSlug || newSlug.length < 3) {
        return new Response(JSON.stringify({ error: "Slug deve ter ao menos 3 caracteres (letras, números e hífens)" }), { status: 400, headers: corsHeaders });
      }

      // Check uniqueness
      const { data: existing } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", newSlug)
        .neq("id", profile.organization_id)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Este slug já está em uso por outra organização" }), { status: 409, headers: corsHeaders });
      }

      const { error: updateErr } = await adminClient
        .from("organizations")
        .update({ slug: newSlug })
        .eq("id", profile.organization_id);
      if (updateErr) {
        console.error("Slug update error:", updateErr);
        return new Response(JSON.stringify({ error: "Erro ao atualizar slug" }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, slug: newSlug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Cloudflare Domain Actions ─────────────────────────────────
    const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
    const CF_ZONE = Deno.env.get("CLOUDFLARE_ZONE_ID")!;

    if (action === "create") {
      const hostname = (body.hostname as string || "").toLowerCase().trim();
      if (!hostname || !hostname.includes(".")) {
        return new Response(JSON.stringify({ error: "Hostname inválido" }), { status: 400, headers: corsHeaders });
      }

      const { data: existing } = await adminClient
        .from("tenant_domains")
        .select("id")
        .eq("hostname", hostname)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Domínio já cadastrado" }), { status: 409, headers: corsHeaders });
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
      const cfData = await cfRes.json();

      if (!cfData.success) {
        console.error("Cloudflare error:", JSON.stringify(cfData.errors));
        return new Response(JSON.stringify({ error: "Erro no Cloudflare", details: cfData.errors }), {
          status: 502, headers: corsHeaders,
        });
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
        return new Response(JSON.stringify({ error: "Erro ao salvar domínio" }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        domain,
        instructions: `Aponte o CNAME do domínio ${hostname} para portadocorretor.com.br`,
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_status") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!domain || !domain.cloudflare_hostname_id) {
        return new Response(JSON.stringify({ error: "Domínio não encontrado" }), { status: 404, headers: corsHeaders });
      }

      const cfRes = await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const cfData = await cfRes.json();

      if (!cfData.success) {
        return new Response(JSON.stringify({ error: "Erro ao consultar Cloudflare" }), { status: 502, headers: corsHeaders });
      }

      const cfHostname = cfData.result;
      const sslStatus = cfHostname.ssl?.status || "unknown";
      const verificationStatus = cfHostname.status || "unknown";
      const isActive = verificationStatus === "active" && sslStatus === "active";

      await adminClient
        .from("tenant_domains")
        .update({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", domainId);

      return new Response(JSON.stringify({ ssl_status: sslStatus, verification_status: verificationStatus, is_active: isActive }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const domainId = body.domain_id as string;
      const { data: domain } = await adminClient
        .from("tenant_domains")
        .select("*")
        .eq("id", domainId)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!domain) {
        return new Response(JSON.stringify({ error: "Domínio não encontrado" }), { status: 404, headers: corsHeaders });
      }

      if (domain.cloudflare_hostname_id) {
        await fetch(`${CF_API}/zones/${CF_ZONE}/custom_hostnames/${domain.cloudflare_hostname_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${CF_TOKEN}` },
        });
      }

      await adminClient.from("tenant_domains").delete().eq("id", domainId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error("manage-custom-domain error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
