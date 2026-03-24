import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

async function verifyAdmin(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = roles?.some((r: any) => r.role === "developer" || r.role === "admin");
  return isAdmin ? user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const user = await verifyAdmin(supabaseAdmin, req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET") {
      // Fetch all organizations with their users and subscriptions
      const { data: orgs, error: orgsError } = await supabaseAdmin
        .from("organizations")
        .select("id, name, is_active, trial_started_at, trial_ends_at, created_at")
        .order("created_at", { ascending: false });

      if (orgsError) throw orgsError;

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, email:id, organization_id, phone");

      if (profilesError) throw profilesError;

      // Get subscriptions with plan info
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("id, organization_id, plan_id, status, billing_cycle, current_period_end, trial_end");

      // Get plans
      const { data: plans } = await supabaseAdmin
        .from("subscription_plans")
        .select("id, name, slug, price_monthly")
        .eq("is_active", true);

      // Get user emails from auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      authUsers?.users?.forEach((u: any) => { emailMap[u.id] = u.email || ""; });

      const result = orgs?.map((org: any) => {
        const sub = subs?.find((s: any) => s.organization_id === org.id);
        const plan = sub ? plans?.find((p: any) => p.id === sub.plan_id) : null;
        return {
          ...org,
          subscription: sub ? {
            id: sub.id,
            plan_id: sub.plan_id,
            plan_name: plan?.name || "—",
            plan_slug: plan?.slug || "—",
            status: sub.status,
            billing_cycle: sub.billing_cycle,
            current_period_end: sub.current_period_end,
            trial_end: sub.trial_end,
          } : null,
          users: profiles
            ?.filter((p: any) => p.organization_id === org.id)
            .map((p: any) => ({
              user_id: p.user_id,
              full_name: p.full_name,
              email: emailMap[p.user_id] || "",
              phone: p.phone,
            })) || [],
        };
      });

      // Also return available plans
      return new Response(JSON.stringify({ organizations: result, plans: plans || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const { org_id, trial_ends_at, trial_started_at, plan_id, status, current_period_end } = body;

      // Update organization trial dates if provided
      if (trial_ends_at !== undefined) {
        const updateData: Record<string, string | null> = { trial_ends_at };
        if (trial_started_at) updateData.trial_started_at = trial_started_at;
        const { error } = await supabaseAdmin.from("organizations").update(updateData).eq("id", org_id);
        if (error) throw error;
      }

      // Update subscription plan/status if provided
      if (plan_id || status || current_period_end) {
        const subUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
        if (plan_id) subUpdate.plan_id = plan_id;
        if (status) subUpdate.status = status;
        if (current_period_end) subUpdate.current_period_end = current_period_end;

        // Check if subscription exists
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("organization_id", org_id)
          .limit(1)
          .single();

        if (existingSub) {
          const { error } = await supabaseAdmin.from("subscriptions").update(subUpdate).eq("organization_id", org_id);
          if (error) throw error;
        } else if (plan_id) {
          // Create subscription if none exists
          const { error } = await supabaseAdmin.from("subscriptions").insert({
            organization_id: org_id,
            plan_id,
            status: status || "active",
            billing_cycle: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: current_period_end || "2099-12-31T23:59:59Z",
          });
          if (error) throw error;
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE") {
      const { org_id } = await req.json();
      if (!org_id) {
        return new Response(JSON.stringify({ error: "org_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify org has no users
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("organization_id", org_id);

      if (profiles && profiles.length > 0) {
        return new Response(JSON.stringify({ error: "Organização possui usuários vinculados" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Delete related data in order
      await supabaseAdmin.from("subscriptions").delete().eq("organization_id", org_id);
      await supabaseAdmin.from("brand_settings").delete().eq("organization_id", org_id);
      const { error } = await supabaseAdmin.from("organizations").delete().eq("id", org_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
