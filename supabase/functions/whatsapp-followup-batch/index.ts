import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  // Auth: require webhook secret or service_role key
  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = req.headers.get("X-Webhook-Secret") ?? "";
  const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") ?? "";

  if (!webhookSecret && !authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__")) {
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return errorResponse("Unauthorized", 401);
    }
  }

  const sb = createServiceClient();

  // Get all configs with followup enabled
  const { data: configs, error: cfgErr } = await sb
    .from("whatsapp_agent_config")
    .select("organization_id, instance_name, followup_enabled, followup_intervals, followup_max_attempts, followup_business_hours, followup_template_1, followup_template_3, followup_ai_prompt, followup_templates")
    .eq("followup_enabled", true);

  if (cfgErr) return errorResponse(cfgErr.message, 500);
  if (!configs || configs.length === 0) return json({ items: [], count: 0 });

  // Check business hours for each org (America/Sao_Paulo)
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentHHMM = `${String(spNow.getHours()).padStart(2, "0")}:${String(spNow.getMinutes()).padStart(2, "0")}`;

  const eligibleOrgs = new Map<string, any>();
  for (const cfg of configs) {
    const bh = cfg.followup_business_hours as { start: string; end: string } | null;
    const start = bh?.start ?? "08:00";
    const end = bh?.end ?? "18:00";
    if (currentHHMM >= start && currentHHMM <= end) {
      eligibleOrgs.set(cfg.organization_id, cfg);
    }
  }

  if (eligibleOrgs.size === 0) return json({ items: [], count: 0 });

  const orgIds = Array.from(eligibleOrgs.keys());

  // Query pending follow-ups
  const { data: queue, error: qErr } = await sb
    .from("follow_up_queue")
    .select("*")
    .in("org_id", orgIds)
    .eq("status", "pending")
    .eq("opted_out", false)
    .lte("next_followup_at", now.toISOString())
    .order("next_followup_at", { ascending: true })
    .limit(100);

  if (qErr) return errorResponse(qErr.message, 500);
  if (!queue || queue.length === 0) return json({ items: [], count: 0 });

  // Filter by max_attempts per org and limit 5 per org, 20 total
  const orgCounts: Record<string, number> = {};
  const items: any[] = [];

  for (const row of queue) {
    if (items.length >= 20) break;
    const cfg = eligibleOrgs.get(row.org_id);
    if (!cfg) continue;

    const maxAttempts = cfg.followup_max_attempts ?? 3;
    if (row.attempt_count >= maxAttempts) continue;

    const orgCount = orgCounts[row.org_id] ?? 0;
    if (orgCount >= 5) continue;

    orgCounts[row.org_id] = orgCount + 1;
    items.push({
      id: row.id,
      org_id: row.org_id,
      lead_phone: row.lead_phone,
      lead_name: row.lead_name,
      property_interest: row.property_interest,
      conversation_context: row.conversation_context,
      instance_name: row.instance_name,
      attempt_count: row.attempt_count,
      template_1: cfg.followup_template_1,
      template_3: cfg.followup_template_3,
      ai_prompt: cfg.followup_ai_prompt,
      intervals: cfg.followup_intervals,
    });
  }

  return json({ items, count: items.length });
});
