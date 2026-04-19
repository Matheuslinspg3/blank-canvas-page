// Cron worker: process voice_call_queue rows that are due.
// Respects working hours and max_call_attempts; uses exponential backoff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateRetellConfig } from "../_shared/retellConfigCheck.ts";
import { maskPhone } from "../_shared/voiceConsent.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET") || Deno.env.get("WEBHOOK_SECRET") || "";

const BACKOFF_MIN = [30, 120, 360]; // 30 min, 2h, 6h

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "retell.worker", event, ...data }));
}

function withinWorkingHours(start: string, end: string): boolean {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 3600 * 1000);
  const hh = brt.getUTCHours();
  const mm = brt.getUTCMinutes();
  const cur = hh * 60 + mm;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return cur >= s && cur <= e;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: rows, error } = await supabase
      .from("voice_call_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("batch_picked", { count: rows.length });

    let processed = 0;
    for (const row of rows) {
      const ctx = { queue_id: row.id, lead_id: row.lead_id, org_id: row.organization_id, attempt: (row.attempt_count ?? 0) + 1 };
      log("picked_up", ctx);

      const { error: lockErr } = await supabase
        .from("voice_call_queue")
        .update({ status: "calling" })
        .eq("id", row.id)
        .eq("status", "pending");
      if (lockErr) {
        log("lock_failed", { ...ctx, error: lockErr.message });
        continue;
      }

      const { data: cfg } = await supabase
        .from("retell_agent_config")
        .select("working_hours_start, working_hours_end, max_call_attempts, enabled, auto_outbound_enabled, agent_id, retell_from_number")
        .eq("organization_id", row.organization_id)
        .maybeSingle();

      const cfgCheck = validateRetellConfig(cfg);
      if (!cfgCheck.ok) {
        log("cancelled", { ...ctx, reason: cfgCheck.reason });
        await supabase.from("voice_call_queue").update({
          status: "cancelled", last_error: `config_invalid:${cfgCheck.reason}`,
        }).eq("id", row.id);
        continue;
      }

      if (!withinWorkingHours(cfg!.working_hours_start || "08:00", cfg!.working_hours_end || "18:00")) {
        const next = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        log("postponed", { ...ctx, reason: "outside_working_hours", next_attempt_at: next });
        await supabase.from("voice_call_queue").update({
          status: "pending",
          next_attempt_at: next,
        }).eq("id", row.id);
        continue;
      }

      const maxAttempts = cfg!.max_call_attempts ?? 3;
      const attempt = ctx.attempt;

      try {
        log("triggering", { ...ctx, phone: maskPhone(row.phone_e164) });
        const res = await fetch(`${SUPABASE_URL}/functions/v1/retell-trigger-outbound-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            "X-Webhook-Secret": WEBHOOK_SECRET,
          },
          body: JSON.stringify({
            lead_id: row.lead_id,
            organization_id: row.organization_id,
            phone: row.phone_e164,
            queue_id: row.id,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.call_id) {
          log("triggered_ok", { ...ctx, call_id: data.call_id });
          await supabase.from("voice_call_queue").update({
            status: "done",
            attempt_count: attempt,
            call_id: data.call_id,
          }).eq("id", row.id);
          processed++;
        } else {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        const errMsg = String(err).slice(0, 500);
        if (attempt >= maxAttempts) {
          log("failed_final", { ...ctx, error: errMsg });
          await supabase.from("voice_call_queue").update({
            status: "failed", attempt_count: attempt, last_error: errMsg,
          }).eq("id", row.id);
        } else {
          const backoffMin = BACKOFF_MIN[attempt - 1] ?? 360;
          const next = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
          log("failed_retry", { ...ctx, error: errMsg, next_attempt_at: next, backoff_min: backoffMin });
          await supabase.from("voice_call_queue").update({
            status: "pending",
            attempt_count: attempt,
            last_error: errMsg,
            next_attempt_at: next,
          }).eq("id", row.id);
        }
      }
    }

    return new Response(JSON.stringify({ processed, total: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("worker_error", { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
