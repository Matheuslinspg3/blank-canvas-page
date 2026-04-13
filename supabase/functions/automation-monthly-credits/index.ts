import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Cron job: Credits automation_credit_wallets monthly based on plan allowance.
 * Should be called monthly via pg_cron.
 */
serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active subscriptions with their plan's automation allowance
    const { data: subscriptions, error: subErr } = await supabase
      .from("subscriptions")
      .select("organization_id, plan_id, subscription_plans!inner(automation_allowance_brl, name)")
      .eq("status", "active");

    if (subErr) throw subErr;

    let credited = 0;
    let skipped = 0;

    for (const sub of subscriptions ?? []) {
      const plan = (sub as any).subscription_plans;
      const allowance = Number(plan?.automation_allowance_brl ?? 0);
      if (allowance <= 0) {
        skipped++;
        continue;
      }

      // Check if addon-automations is active for this org (adds extra credits)
      const { data: addonSubs } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans!inner(slug, automation_allowance_brl)")
        .eq("organization_id", sub.organization_id)
        .eq("status", "active")
        .eq("subscription_plans.slug", "addon-automations");

      const addonAllowance = Number((addonSubs?.[0] as any)?.subscription_plans?.automation_allowance_brl ?? 0);
      const totalAllowance = allowance + addonAllowance;

      // Add credits via RPC
      const { error: addErr } = await supabase.rpc("add_automation_credits", {
        p_organization_id: sub.organization_id,
        p_amount_brl: totalAllowance,
        p_description: `Crédito mensal do plano ${plan.name}${addonAllowance > 0 ? ' + Addon Automações' : ''}`,
        p_type: "plan_monthly",
      });

      if (addErr) {
        console.error(`Failed to credit org ${sub.organization_id}:`, addErr);
      } else {
        credited++;
      }
    }

    console.log(`Monthly credits: ${credited} credited, ${skipped} skipped`);

    return new Response(JSON.stringify({ ok: true, credited, skipped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("automation-monthly-credits error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
