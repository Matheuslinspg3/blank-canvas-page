import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

/**
 * whatsapp-broker-followup-executor
 *
 * Cron-triggered function that:
 * 1. Fetches pending broker follow-ups (respecting business hours, intervals, max attempts)
 * 2. Sends follow-up messages via Evolution API using broker templates
 * 3. Updates follow_up_queue and logs in follow_up_log
 *
 * No AI — uses fixed templates with placeholder replacement only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Accept POST (cron) or GET (manual trigger)
  if (req.method !== "POST" && req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  // Auth: service_role key (from cron) or webhook secret
  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret =
    req.headers.get("X-Webhook-Secret") ??
    req.headers.get("x-webhook-secret") ??
    "";
  const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const hasValidSecret = expectedSecret && webhookSecret === expectedSecret;
  const hasServiceKey =
    serviceRoleKey && authHeader.includes(serviceRoleKey);
  const hasAnonKey = anonKey && authHeader.includes(anonKey);

  console.log(`[broker-followup-executor] Auth: method=${req.method}`);

  if (!hasValidSecret && !hasServiceKey && !hasAnonKey) {
    return errorResponse("Unauthorized", 401);
  }

  const EVOLUTION_API_URL = (
    Deno.env.get("EVOLUTION_API_URL") ?? ""
  ).replace(/\/$/, "");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY") ?? "";

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return errorResponse("Evolution API not configured", 500);
  }

  const sb = createServiceClient();

  // ── 1. Get connected broker channels with followup enabled ──
  const { data: channels, error: chErr } = await sb
    .from("broker_whatsapp_channels")
    .select(
      "id, organization_id, user_id, instance_name, followup_enabled, followup_intervals, followup_max_attempts, followup_business_hours"
    )
    .eq("followup_enabled", true)
    .eq("status", "connected");

  if (chErr) return errorResponse(chErr.message, 500);
  if (!channels || channels.length === 0) {
    return json({ processed: 0, skipped: "no_channels" });
  }

  // ── 2. Filter by business hours (America/Sao_Paulo) ──
  const now = new Date();
  const spNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const currentHHMM = `${String(spNow.getHours()).padStart(2, "0")}:${String(
    spNow.getMinutes()
  ).padStart(2, "0")}`;

  const eligibleChannels = new Map<string, any>();
  for (const ch of channels) {
    const bh = ch.followup_business_hours as {
      start: string;
      end: string;
    } | null;
    const start = bh?.start ?? "08:00";
    const end = bh?.end ?? "18:00";
    if (currentHHMM >= start && currentHHMM <= end) {
      eligibleChannels.set(ch.id, ch);
    }
  }

  if (eligibleChannels.size === 0) {
    return json({ processed: 0, skipped: "outside_business_hours" });
  }

  const channelIds = Array.from(eligibleChannels.keys());

  // ── 3. Fetch pending follow-ups ──
  const { data: queue, error: qErr } = await sb
    .from("follow_up_queue")
    .select("*")
    .in("broker_channel_id", channelIds)
    .eq("channel_type", "broker")
    .eq("status", "pending")
    .eq("opted_out", false)
    .lte("next_followup_at", now.toISOString())
    .order("next_followup_at", { ascending: true })
    .limit(50);

  if (qErr) return errorResponse(qErr.message, 500);
  if (!queue || queue.length === 0) {
    return json({ processed: 0, skipped: "no_pending" });
  }

  // ── 4. Load follow-up templates and broker profiles per user ──
  const userIds = [
    ...new Set(
      Array.from(eligibleChannels.values()).map((c: any) => c.user_id)
    ),
  ];

  // Load broker names
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const brokerNameByUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    brokerNameByUserId.set(p.user_id, p.full_name ?? "");
  }
  const { data: templates } = await sb
    .from("broker_message_templates")
    .select("id, user_id, name, body")
    .in("user_id", userIds)
    .eq("category", "followup")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const templatesByUser = new Map<string, any[]>();
  for (const t of templates ?? []) {
    const list = templatesByUser.get(t.user_id) ?? [];
    list.push(t);
    templatesByUser.set(t.user_id, list);
  }

  // ── 5. Process each follow-up ──
  let sent = 0;
  let skipped = 0;
  let completed = 0;
  const channelCounts: Record<string, number> = {};

  for (const row of queue) {
    const ch = eligibleChannels.get(row.broker_channel_id);
    if (!ch) {
      skipped++;
      continue;
    }

    const maxAttempts = ch.followup_max_attempts ?? 3;

    // Already at max — mark completed
    if (row.attempt_count >= maxAttempts) {
      await sb
        .from("follow_up_queue")
        .update({ status: "completed" })
        .eq("id", row.id);
      completed++;
      continue;
    }

    // Rate-limit per channel (max 5 per batch)
    const chCount = channelCounts[ch.id] ?? 0;
    if (chCount >= 5) {
      skipped++;
      continue;
    }
    channelCounts[ch.id] = chCount + 1;

    // Pick template by attempt index
    const userTemplates = templatesByUser.get(ch.user_id) ?? [];
    const templateIndex = Math.min(
      row.attempt_count,
      userTemplates.length - 1
    );
    const template = userTemplates[templateIndex] ?? null;

    if (!template?.body) {
      console.warn(
        `[broker-followup-executor] No template for user ${ch.user_id}, attempt ${row.attempt_count}`
      );
      skipped++;
      continue;
    }

    // Replace all supported placeholders
    const leadName = row.lead_name ?? "";
    const leadPhone = row.lead_phone ?? "";
    const propertyInterest = row.property_interest ?? "";
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const messageText = template.body
      .replace(/\{nome\}/gi, leadName)
      .replace(/\{lead\.name\}/gi, leadName)
      .replace(/\{imovel\}/gi, propertyInterest)
      .replace(/\{telefone\}/gi, leadPhone)
      .replace(/\{corretor\}/gi, brokerNameByUserId.get(ch.user_id) ?? "")
      .replace(/\{data\}/gi, today)
      .replace(/\{tentativa\}/gi, String(row.attempt_count + 1))
      .trim();

    if (!messageText) {
      skipped++;
      continue;
    }

    // ── Send via Evolution API ──
    const remoteJid = row.lead_phone.includes("@")
      ? row.lead_phone
      : `${row.lead_phone}@s.whatsapp.net`;

    try {
      const sendRes = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${ch.instance_name}`,
        {
          method: "POST",
          headers: {
            apikey: EVOLUTION_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ number: remoteJid, text: messageText }),
        }
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text().catch(() => "unknown");
        console.error(
          `[broker-followup-executor] Send failed for ${row.lead_phone}: ${sendRes.status} ${errText}`
        );
        skipped++;
        continue;
      }

      const sendData = await sendRes.json();
      const msgId = sendData?.key?.id ?? crypto.randomUUID();

      // Persist outbound message
      await sb.from("whatsapp_messages").insert({
        organization_id: ch.organization_id,
        instance_name: ch.instance_name,
        remote_jid: remoteJid,
        from_me: true,
        message_id: msgId,
        message_type: "text",
        message_text: messageText,
        sender_type: "system",
        timestamp: new Date().toISOString(),
        channel_type: "broker",
        broker_channel_id: ch.id,
      });

      // ── Update follow_up_queue ──
      const newCount = row.attempt_count + 1;
      const isCompleted = newCount >= maxAttempts;
      const intervals = (ch.followup_intervals as number[]) ?? [24, 48, 72];
      const nextIntervalHours =
        intervals[newCount] ?? intervals[intervals.length - 1] ?? 72;
      const nextFollowup = new Date(
        Date.now() + nextIntervalHours * 3600 * 1000
      ).toISOString();

      await sb
        .from("follow_up_queue")
        .update({
          attempt_count: newCount,
          status: isCompleted ? "completed" : "pending",
          next_followup_at: isCompleted ? row.next_followup_at : nextFollowup,
          last_outbound_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      // Log in follow_up_log
      await sb.from("follow_up_log").insert({
        queue_id: row.id,
        org_id: ch.organization_id,
        lead_phone: row.lead_phone,
        attempt_number: newCount,
        message_sent: messageText,
        message_source: "template",
      });

      if (isCompleted) completed++;
      sent++;

      console.log(
        `[broker-followup-executor] Sent attempt ${newCount}/${maxAttempts} to ${row.lead_phone} via ${ch.instance_name}`
      );
    } catch (sendErr) {
      console.error(
        `[broker-followup-executor] Error sending to ${row.lead_phone}:`,
        sendErr
      );
      skipped++;
    }
  }

  console.log(
    `[broker-followup-executor] Done: sent=${sent}, skipped=${skipped}, completed=${completed}`
  );

  return json({ processed: sent, skipped, completed });
});
