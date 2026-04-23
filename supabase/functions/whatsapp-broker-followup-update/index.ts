import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

/**
 * whatsapp-broker-followup-update
 *
 * Updates broker follow-up status after send/respond/opt-out.
 * Mirror of whatsapp-followup-update but for channel_type='broker'.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = req.headers.get("X-Webhook-Secret") ?? req.headers.get("x-webhook-secret") ?? "";
  const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const hasValidSecret = expectedSecret && webhookSecret === expectedSecret;
  const hasServiceKey = serviceRoleKey && authHeader.includes(serviceRoleKey);

  if (!hasValidSecret && !hasServiceKey) return errorResponse("Unauthorized", 401);

  let body: { id?: string; action?: string; message_sent?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { id, action, message_sent } = body;
  if (!id || !action) return errorResponse("Missing id or action", 400);
  if (!["sent", "responded", "opted_out"].includes(action)) {
    return errorResponse("Invalid action. Use: sent, responded, opted_out", 400);
  }

  const sb = createServiceClient();

  if (action === "responded") {
    const { error } = await sb
      .from("follow_up_queue")
      .update({ status: "responded", last_inbound_at: new Date().toISOString() })
      .eq("id", id)
      .eq("channel_type", "broker");
    if (error) return errorResponse(error.message, 500);
    return json({ success: true, status: "responded" });
  }

  if (action === "opted_out") {
    const { error } = await sb
      .from("follow_up_queue")
      .update({ status: "opted_out", opted_out: true })
      .eq("id", id)
      .eq("channel_type", "broker");
    if (error) return errorResponse(error.message, 500);
    return json({ success: true, status: "opted_out" });
  }

  // action === "sent"
  const { data: record, error: fetchErr } = await sb
    .from("follow_up_queue")
    .select("attempt_count, org_id, lead_phone, broker_channel_id")
    .eq("id", id)
    .eq("channel_type", "broker")
    .single();

  if (fetchErr || !record) return errorResponse("Record not found", 404);

  // Get channel config for intervals and max
  const { data: ch } = await sb
    .from("broker_whatsapp_channels")
    .select("followup_intervals, followup_max_attempts")
    .eq("id", record.broker_channel_id)
    .single();

  const intervals = (ch?.followup_intervals as number[]) ?? [24, 48, 72];
  const maxAttempts = ch?.followup_max_attempts ?? 3;
  const newCount = record.attempt_count + 1;
  const isCompleted = newCount >= maxAttempts;

  const nextIntervalHours = intervals[newCount] ?? intervals[intervals.length - 1] ?? 72;
  const nextFollowup = new Date(Date.now() + nextIntervalHours * 3600 * 1000).toISOString();

  const { error: updateErr } = await sb
    .from("follow_up_queue")
    .update({
      attempt_count: newCount,
      status: isCompleted ? "completed" : "pending",
      next_followup_at: nextFollowup,
      last_outbound_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  // Log to follow_up_log
  if (message_sent) {
    await sb.from("follow_up_log").insert({
      queue_id: id,
      org_id: record.org_id,
      lead_phone: record.lead_phone,
      attempt_number: newCount,
      message_sent,
      message_source: "template",
    });
  }

  return json({ success: true, status: isCompleted ? "completed" : "sent" });
});
