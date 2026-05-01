import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  organization_id?: string;
  plan_slug?: string;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Authenticate the caller via JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }
  const userId = userData.user.id;

  // 2) Authorize: must be developer.
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: isDev, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: userId,
    _role: "developer",
  });
  if (roleErr) {
    return jsonResponse({ error: "Role check failed" }, 500);
  }
  if (isDev !== true) {
    return jsonResponse(
      { error: "Forbidden: only developers can assign internal plans" },
      403,
    );
  }

  // 3) Validate body.
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const orgId = body.organization_id?.trim();
  const planSlug = body.plan_slug?.trim();

  if (!orgId || !UUID_RE.test(orgId)) {
    return jsonResponse({ error: "organization_id must be a valid UUID" }, 400);
  }
  if (!planSlug || planSlug.length === 0 || planSlug.length > 100) {
    return jsonResponse({ error: "plan_slug is required" }, 400);
  }

  // 4) Resolve plan.
  const { data: planRow, error: planErr } = await adminClient
    .from("subscription_plans")
    .select("id, slug, name")
    .eq("slug", planSlug)
    .maybeSingle();

  if (planErr || !planRow) {
    return jsonResponse({ error: `Plan '${planSlug}' not found` }, 404);
  }

  // 5) Verify org exists.
  const { data: orgRow, error: orgErr } = await adminClient
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr || !orgRow) {
    return jsonResponse({ error: `Organization '${orgId}' not found` }, 404);
  }

  // 6) Upsert subscription. Use a long-lived period for the internal plan.
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 100);

  // Cancel any existing active sub for this org first (cleanest state).
  const { error: cancelErr } = await adminClient
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: now.toISOString() })
    .eq("organization_id", orgId)
    .in("status", ["active", "trial", "pending", "overdue"]);
  if (cancelErr) {
    console.error("[admin-set-org-plan] cancel error", cancelErr);
    // not fatal — continue
  }

  const { data: inserted, error: insertErr } = await adminClient
    .from("subscriptions")
    .insert({
      organization_id: orgId,
      plan_id: planRow.id,
      status: "active",
      billing_cycle: "monthly",
      provider: "internal",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[admin-set-org-plan] insert error", insertErr);
    return jsonResponse(
      { error: insertErr.message ?? "Failed to assign plan" },
      500,
    );
  }

  console.log(
    `[admin-set-org-plan] developer=${userId} assigned plan=${planSlug} to org=${orgId} subscription=${inserted.id}`,
  );

  return jsonResponse(
    {
      ok: true,
      subscription_id: inserted.id,
      plan: { slug: planRow.slug, name: planRow.name },
    },
    200,
  );
});
