import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JOB_NAME = "meta-ads-auto-sync";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT via getUser
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      console.error("[meta-cron-config] Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET: return current cron job status ──
    if (req.method === "GET") {
      const { data: jobs, error: jobErr } = await supabase.rpc("get_cron_job_status", {
        p_job_name: JOB_NAME,
      });

      if (jobErr) {
        console.error("[meta-cron-config] Error fetching cron job:", jobErr);
        return new Response(
          JSON.stringify({ enabled: true, schedule: "*/15 * * * *", interval_minutes: 15 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const job = jobs?.[0];
      if (!job) {
        return new Response(
          JSON.stringify({ enabled: false, schedule: null, interval_minutes: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const match = job.schedule?.match(/^\*\/(\d+) \* \* \* \*$/);
      const intervalMinutes = match ? parseInt(match[1], 10) : null;

      return new Response(
        JSON.stringify({
          enabled: job.active ?? true,
          schedule: job.schedule,
          interval_minutes: intervalMinutes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST: update cron config ──
    const body = await req.json();
    const { enabled, interval_minutes } = body;

    if (enabled === false) {
      await supabase.rpc("manage_cron_job", {
        p_action: "disable",
        p_job_name: JOB_NAME,
      });

      return new Response(
        JSON.stringify({ success: true, enabled: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const minutes = Math.max(5, Math.min(interval_minutes || 15, 60));
    const schedule = `*/${minutes} * * * *`;

    await supabase.rpc("manage_cron_job", {
      p_action: "upsert",
      p_job_name: JOB_NAME,
      p_schedule: schedule,
      p_command: `SELECT net.http_post(url := '${SUPABASE_URL}/functions/v1/meta-sync-leads', headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${ANON_KEY}"}'::jsonb, body := '{"auto_sync": true}'::jsonb) AS request_id;`,
    });

    return new Response(
      JSON.stringify({ success: true, enabled: true, schedule, interval_minutes: minutes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[meta-cron-config] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
