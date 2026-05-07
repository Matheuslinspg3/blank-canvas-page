import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

/**
 * Auto-enqueue stale WhatsApp conversations into follow_up_queue.
 * Called by N8N cron or pg_cron every 15 minutes.
 *
 * Logic:
 * 1. For each org with followup_enabled=true, find conversations where:
 *    - Last message was outbound (from_me=true, sender_type in ['agent','human'])
 *    - No inbound reply after that outbound message
 *    - Time since last outbound >= first interval (e.g. 24h)
 *    - Contact NOT already in follow_up_queue with status 'pending'
 * 2. Insert into follow_up_queue with status='pending', attempt_count=0
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Auth: accept webhook secret OR service_role key
  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = req.headers.get("X-Webhook-Secret") ?? req.headers.get("x-webhook-secret") ?? "";
  const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const hasValidSecret = expectedSecret && webhookSecret === expectedSecret;
  const hasServiceKey = serviceRoleKey && authHeader.includes(serviceRoleKey);

  if (!hasValidSecret && !hasServiceKey) {
    return errorResponse("Unauthorized", 401);
  }

  const sb = createServiceClient();

  // Get all orgs with followup enabled
  const { data: configs, error: cfgErr } = await sb
    .from("whatsapp_agent_config")
    .select("organization_id, instance_name, followup_enabled, followup_intervals, followup_business_hours")
    .eq("followup_enabled", true);

  if (cfgErr) return errorResponse(cfgErr.message, 500);
  if (!configs || configs.length === 0) return json({ enqueued: 0 });

  let totalEnqueued = 0;

  for (const cfg of configs) {
    const orgId = cfg.organization_id;
    const intervals = (cfg.followup_intervals as number[]) ?? [24, 48, 72];
    const firstIntervalHours = intervals[0] ?? 24;
    const cutoffTime = new Date(Date.now() - firstIntervalHours * 3600 * 1000).toISOString();

    // Find conversations where last message is outbound and older than cutoff
    // Using raw SQL via rpc would be ideal, but let's use client queries
    
    // Get all recent messages for this org, grouped by remote_jid
    // IMPORTANT: Filter by channel_type = 'org' to avoid picking up broker/individual channel conversations
    const { data: messages } = await sb
      .from("whatsapp_messages")
      .select("remote_jid, from_me, sender_type, timestamp")
      .eq("organization_id", orgId)
      .eq("channel_type", "org")
      .order("timestamp", { ascending: false })
      .limit(2000);

    if (!messages || messages.length === 0) continue;

    // Group by remote_jid and find the last message per contact
    const contactLastMsg = new Map<string, { from_me: boolean; sender_type: string; timestamp: string }>();
    for (const msg of messages) {
      if (!contactLastMsg.has(msg.remote_jid)) {
        contactLastMsg.set(msg.remote_jid, {
          from_me: msg.from_me,
          sender_type: msg.sender_type,
          timestamp: msg.timestamp,
        });
      }
    }

    // Filter: last message is outbound AND older than cutoff
    const staleContacts: string[] = [];
    for (const [jid, last] of contactLastMsg) {
      if (
        last.from_me &&
        (last.sender_type === "agent" || last.sender_type === "human") &&
        last.timestamp < cutoffTime
      ) {
        // Ignore group chats
        if (!jid.includes("@g.us")) {
          staleContacts.push(jid);
        }
      }
    }

    if (staleContacts.length === 0) continue;

    // Check which are already in follow_up_queue
    const { data: existing } = await sb
      .from("follow_up_queue")
      .select("lead_phone")
      .eq("org_id", orgId)
      .in("status", ["pending", "responded"])
      .in("lead_phone", staleContacts);

    const existingSet = new Set((existing ?? []).map((e: any) => e.lead_phone));
    const toEnqueue = staleContacts.filter((jid) => !existingSet.has(jid));

    if (toEnqueue.length === 0) continue;

    // Get lead names from last messages
    const { data: nameMessages } = await sb
      .from("whatsapp_messages")
      .select("remote_jid, message_text")
      .eq("organization_id", orgId)
      .eq("from_me", false)
      .in("remote_jid", toEnqueue)
      .order("timestamp", { ascending: false })
      .limit(500);

    const leadNames = new Map<string, string>();
    if (nameMessages) {
      for (const m of nameMessages) {
        if (!leadNames.has(m.remote_jid) && m.message_text) {
          // Use first few words as a hint — real name comes from CRM or N8N
          leadNames.set(m.remote_jid, m.remote_jid.replace("@s.whatsapp.net", ""));
        }
      }
    }

    // Calculate first follow-up time
    const nextFollowup = new Date().toISOString();

    // Insert into queue (max 10 per org per run)
    const rows = toEnqueue.slice(0, 10).map((jid) => ({
      org_id: orgId,
      lead_phone: jid,
      lead_name: leadNames.get(jid) ?? jid.replace("@s.whatsapp.net", ""),
      instance_name: cfg.instance_name ?? "",
      status: "pending",
      attempt_count: 0,
      next_followup_at: nextFollowup,
      opted_out: false,
    }));

    const { error: insertErr } = await sb
      .from("follow_up_queue")
      .upsert(rows, { onConflict: "org_id,lead_phone", ignoreDuplicates: true });

    if (!insertErr) {
      totalEnqueued += rows.length;
    }
  }

  return json({ enqueued: totalEnqueued });
});
