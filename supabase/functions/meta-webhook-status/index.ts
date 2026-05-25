import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) return json({ error: "No organization found" }, 400);
    const orgId = profile.organization_id;

    const { data: account } = await admin
      .from("ad_accounts")
      .select("id, external_account_id, name, status, auth_payload, updated_at")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .eq("is_active", true)
      .maybeSingle();

    // Stats from ad_webhook_logs (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await admin
      .from("ad_webhook_logs")
      .select("id, status, created_at, error_message, payload, external_lead_id")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: lastReceived } = await admin
      .from("ad_webhook_logs")
      .select("created_at")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: failures } = await admin
      .from("meta_lead_failures")
      .select("id, page_id, form_id, leadgen_id, reason, attempt_count, created_at, resolved_at, status")
      .eq("organization_id", orgId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const total = logs?.length ?? 0;
    const errors = logs?.filter(l => l.status === "error").length ?? 0;
    const processed = logs?.filter(l => l.status === "processed").length ?? 0;
    const received = logs?.filter(l => l.status === "received").length ?? 0;

    let pages: Array<any> = [];
    let metaError: any = null;
    let needsReconnect = false;

    const accessToken = account?.auth_payload?.access_token;
    if (accessToken) {
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();
        if (pagesData.error) {
          metaError = { code: pagesData.error.code, message: pagesData.error.message };
          needsReconnect = [190, 200, 10, 100].includes(pagesData.error.code);
        } else {
          for (const p of (pagesData.data || [])) {
            let leadgenSubscribed = false;
            let appName: string | null = null;
            let pageError: string | null = null;
            if (p.access_token) {
              try {
                const subRes = await fetch(
                  `https://graph.facebook.com/v21.0/${p.id}/subscribed_apps?access_token=${p.access_token}`
                );
                const subData = await subRes.json();
                if (subData.error) {
                  pageError = subData.error.message;
                } else {
                  const apps = subData.data || [];
                  for (const app of apps) {
                    const fields: string[] = app.subscribed_fields || [];
                    if (fields.includes("leadgen")) {
                      leadgenSubscribed = true;
                      appName = app.name || app.category || null;
                      break;
                    }
                  }
                }
              } catch (e: any) {
                pageError = e.message;
              }
            } else {
              pageError = "No page access token";
            }
            pages.push({
              id: p.id,
              name: p.name,
              leadgen_subscribed: leadgenSubscribed,
              app_name: appName,
              error: pageError,
            });
          }
        }
      } catch (e: any) {
        metaError = { message: e.message };
      }
    }

    return json({
      account: account ? {
        id: account.id,
        name: account.name,
        external_account_id: account.external_account_id,
        status: account.status,
        meta_realtime: account.auth_payload?.meta_realtime ?? null,
        updated_at: account.updated_at,
      } : null,
      pages,
      meta_error: metaError,
      needs_reconnect: needsReconnect,
      stats_7d: { total, processed, errors, received },
      last_received_at: lastReceived?.created_at ?? null,
      recent_logs: logs ?? [],
      open_failures: failures ?? [],
      checked_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("meta-webhook-status error:", err);
    return json({ error: "Internal server error", details: err.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
