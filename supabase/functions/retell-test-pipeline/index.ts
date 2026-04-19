// Endpoint de teste ponta-a-ponta do pipeline Retell.
// POST { phone, name?, dry_run? }
// Restrito a admin/sub_admin/developer da organização.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateRetellConfig } from "../_shared/retellConfigCheck.ts";
import { resolveVoiceConsent, maskPhone } from "../_shared/voiceConsent.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "retell.test", event, ...data }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const timeline: Array<{ step: string; ok: boolean; data?: any; error?: string }> = [];
  const push = (step: string, ok: boolean, extra: Record<string, unknown> = {}) => {
    timeline.push({ step, ok, ...extra });
    log(step, { ok, ...extra });
  };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await sb
      .from("profiles")
      .select("organization_id, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = profile.organization_id;

    // Authz: admin / sub_admin / developer
    const { data: roles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const rs = (roles || []).map((r: any) => r.role);
    const allowed = rs.some((r: string) => ["admin", "sub_admin", "developer"].includes(r));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const name = String(body.name || "Teste Retell").trim();
    const dryRun = !!body.dry_run;

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("start", { org_id: orgId, user_id: user.id, phone: maskPhone(phone), dry_run: dryRun });

    // 1. Config check
    const { data: cfg } = await sb
      .from("retell_agent_config")
      .select("enabled, auto_outbound_enabled, agent_id, retell_from_number, working_hours_start, working_hours_end, max_call_attempts")
      .eq("organization_id", orgId)
      .maybeSingle();
    const cfgCheck = validateRetellConfig(cfg);
    push("config_check", cfgCheck.ok, cfgCheck.ok ? {} : { reason: cfgCheck.reason });
    if (!cfgCheck.ok) {
      return new Response(JSON.stringify({ ok: false, timeline }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Stage
    const { data: stages } = await sb
      .from("lead_stages")
      .select("id")
      .eq("organization_id", orgId)
      .order("position", { ascending: true })
      .limit(1);
    const stageId = stages?.[0]?.id || null;

    // 3. Insert lead
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        name,
        phone,
        source: "test_retell",
        stage: "novo",
        lead_stage_id: stageId,
        notes: "[Teste pipeline Retell]",
        consent_voice_call: resolveVoiceConsent({ source: "test_retell", explicit: true, hasPhone: true }),
      })
      .select("id")
      .single();

    if (leadErr || !lead) {
      push("lead_created", false, { error: leadErr?.message });
      return new Response(JSON.stringify({ ok: false, timeline }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    push("lead_created", true, { lead_id: lead.id });

    // 4. Wait + check queue
    await sleep(2000);
    const { data: queueRow } = await sb
      .from("voice_call_queue")
      .select("id, status, attempt_count, last_error, next_attempt_at, call_id")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    push("queue_lookup", !!queueRow, { queue: queueRow });

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, lead_id: lead.id, timeline }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Trigger directly (não esperar cron de 1min)
    const triggerRes = await fetch(`${SUPABASE_URL}/functions/v1/retell-trigger-outbound-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        lead_id: lead.id,
        organization_id: orgId,
        phone,
        queue_id: queueRow?.id ?? null,
      }),
    });
    const triggerData = await triggerRes.json().catch(() => ({}));
    push("trigger_call", triggerRes.ok && !!triggerData?.call_id, {
      status: triggerRes.status,
      call_id: triggerData?.call_id,
      error: triggerData?.error,
      reason: triggerData?.reason,
    });

    // 6. Mark queue done if exists
    if (queueRow?.id && triggerData?.call_id) {
      await sb.from("voice_call_queue").update({
        status: "done",
        attempt_count: (queueRow.attempt_count ?? 0) + 1,
        call_id: triggerData.call_id,
      }).eq("id", queueRow.id);
    }

    return new Response(JSON.stringify({
      ok: triggerRes.ok && !!triggerData?.call_id,
      lead_id: lead.id,
      call_id: triggerData?.call_id ?? null,
      timeline,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("internal_error", { error: String(err) });
    timeline.push({ step: "internal_error", ok: false, error: String(err) });
    return new Response(JSON.stringify({ ok: false, timeline, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
