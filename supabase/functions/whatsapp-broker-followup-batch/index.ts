import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

/**
 * whatsapp-broker-followup-batch
 *
 * Returns pending broker follow-ups ready to be sent.
 * Called by n8n cron. Does NOT use AI — sends fixed templates only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = req.headers.get("X-Webhook-Secret") ?? req.headers.get("x-webhook-secret") ?? "";
  const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const hasValidSecret = expectedSecret && webhookSecret === expectedSecret;
  const hasServiceKey = serviceRoleKey && authHeader.includes(serviceRoleKey);

  if (!hasValidSecret && !hasServiceKey) return errorResponse("Unauthorized", 401);

  const sb = createServiceClient();

  // Get all broker channels with followup enabled
  const { data: channels, error: chErr } = await sb
    .from("broker_whatsapp_channels")
    .select("id, organization_id, user_id, instance_name, followup_enabled, followup_intervals, followup_max_attempts, followup_business_hours")
    .eq("followup_enabled", true)
    .eq("status", "connected");

  if (chErr) return errorResponse(chErr.message, 500);
  if (!channels || channels.length === 0) return json({ items: [], count: 0 });

  // Check business hours (America/Sao_Paulo)
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentHHMM = `${String(spNow.getHours()).padStart(2, "0")}:${String(spNow.getMinutes()).padStart(2, "0")}`;

  const eligibleChannels = new Map<string, any>();
  for (const ch of channels) {
    const bh = ch.followup_business_hours as { start: string; end: string } | null;
    const start = bh?.start ?? "08:00";
    const end = bh?.end ?? "18:00";
    if (currentHHMM >= start && currentHHMM <= end) {
      eligibleChannels.set(ch.id, ch);
    }
  }

  if (eligibleChannels.size === 0) return json({ items: [], count: 0 });

  const channelIds = Array.from(eligibleChannels.keys());

  // Query pending broker follow-ups
  const { data: queue, error: qErr } = await sb
    .from("follow_up_queue")
    .select("*")
    .in("broker_channel_id", channelIds)
    .eq("channel_type", "broker")
    .eq("status", "pending")
    .eq("opted_out", false)
    .lte("next_followup_at", now.toISOString())
    .order("next_followup_at", { ascending: true })
    .limit(100);

  if (qErr) return errorResponse(qErr.message, 500);
  if (!queue || queue.length === 0) return json({ items: [], count: 0 });

  // Get follow-up templates for each user
  const userIds = [...new Set(Array.from(eligibleChannels.values()).map((c: any) => c.user_id))];
  const { data: templates } = await sb
    .from("broker_message_templates")
    .select("id, user_id, name, category, body")
    .in("user_id", userIds)
    .eq("category", "followup")
    .eq("is_active", true);

  const templatesByUser = new Map<string, any[]>();
  for (const t of templates ?? []) {
    const list = templatesByUser.get(t.user_id) ?? [];
    list.push(t);
    templatesByUser.set(t.user_id, list);
  }

  // Filter by max_attempts, limit 5 per channel, 20 total
  const channelCounts: Record<string, number> = {};
  const items: any[] = [];

  for (const row of queue) {
    if (items.length >= 20) break;
    const ch = eligibleChannels.get(row.broker_channel_id);
    if (!ch) continue;

    const maxAttempts = ch.followup_max_attempts ?? 3;
    if (row.attempt_count >= maxAttempts) continue;

    const chCount = channelCounts[ch.id] ?? 0;
    if (chCount >= 5) continue;

    channelCounts[ch.id] = chCount + 1;

    const userTemplates = templatesByUser.get(ch.user_id) ?? [];
    // Pick template by attempt index or last available
    const templateIndex = Math.min(row.attempt_count, userTemplates.length - 1);
    const template = userTemplates[templateIndex] ?? null;

    items.push({
      id: row.id,
      org_id: row.org_id,
      lead_phone: row.lead_phone,
      lead_name: row.lead_name,
      property_interest: row.property_interest,
      conversation_context: row.conversation_context,
      instance_name: ch.instance_name,
      broker_channel_id: ch.id,
      broker_user_id: ch.user_id,
      attempt_count: row.attempt_count,
      intervals: ch.followup_intervals,
      template_body: template?.body ?? null,
      template_name: template?.name ?? null,
    });
  }

  return json({ items, count: items.length });
});
