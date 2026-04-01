import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
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

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { id, action } = body;
  if (!id || !action) return errorResponse("Missing id or action", 400);
  if (!["sent", "responded", "opted_out"].includes(action)) {
    return errorResponse("Invalid action. Use: sent, responded, opted_out", 400);
  }

  const sb = createServiceClient();

  if (action === "responded") {
    const { error } = await sb
      .from("follow_up_queue")
      .update({ status: "responded", last_inbound_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return errorResponse(error.message, 500);
    return json({ success: true, status: "responded" });
  }

  if (action === "opted_out") {
    const { error } = await sb
      .from("follow_up_queue")
      .update({ status: "opted_out", opted_out: true })
      .eq("id", id);
    if (error) return errorResponse(error.message, 500);
    return json({ success: true, status: "opted_out" });
  }

  // action === "sent"
  // Get current record to calculate next interval
  const { data: record, error: fetchErr } = await sb
    .from("follow_up_queue")
    .select("attempt_count, org_id")
    .eq("id", id)
    .single();

  if (fetchErr || !record) return errorResponse("Record not found", 404);

  // Get org config for intervals and max
  const { data: cfg } = await sb
    .from("whatsapp_agent_config")
    .select("followup_intervals, followup_max_attempts")
    .eq("organization_id", record.org_id)
    .single();

  const intervals = (cfg?.followup_intervals as number[]) ?? [24, 48, 72];
  const maxAttempts = cfg?.followup_max_attempts ?? 3;
  const newCount = record.attempt_count + 1;
  const isCompleted = newCount >= maxAttempts;

  // Calculate next followup time
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

  return json({ success: true, status: isCompleted ? "completed" : "sent" });
});
