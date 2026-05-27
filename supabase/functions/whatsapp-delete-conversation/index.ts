import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Normalize phone/jid: keep only digits, strip @s.whatsapp.net etc
function normalizeNumber(input: string): { digits: string; jid: string } {
  const raw = String(input || "").trim();
  const digits = raw.split("@")[0].replace(/\D/g, "");
  const jid = raw.includes("@") ? raw : `${digits}@s.whatsapp.net`;
  return { digits, jid };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const instance_name: string | undefined = body.instance_name?.trim();
    const number: string | undefined = body.number || body.phone || body.remote_jid;
    let orgId: string | null = body.organization_id || null;

    // Auth: webhook-secret (server-to-server) OR user JWT
    const reqSecret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    const authHeader = req.headers.get("Authorization");

    if (WEBHOOK_SECRET && reqSecret && reqSecret === WEBHOOK_SECRET) {
      // server-to-server: organization_id must come from body OR be resolved via instance_name
      if (!orgId && instance_name) {
        const { data: conn } = await admin
          .from("whatsapp_connections")
          .select("organization_id")
          .eq("instance_name", instance_name)
          .maybeSingle();
        orgId = conn?.organization_id ?? null;
        if (!orgId) {
          const { data: agent } = await admin
            .from("whatsapp_agent_config")
            .select("organization_id")
            .eq("instance_name", instance_name)
            .maybeSingle();
          orgId = agent?.organization_id ?? null;
        }
      }
      if (!orgId) return json({ ok: false, error: "organization_id não pôde ser resolvido" }, 400);
    } else {
      if (!authHeader) return json({ ok: false, error: "Missing Authorization or X-Webhook-Secret" }, 401);
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);
      const { data: profile } = await admin
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.organization_id) return json({ ok: false, error: "No organization" }, 400);
      orgId = profile.organization_id as string;
    }

    if (!instance_name) return json({ ok: false, error: "instance_name é obrigatório" }, 400);
    if (!number) return json({ ok: false, error: "number é obrigatório" }, 400);


    const { digits, jid } = normalizeNumber(number);
    if (!digits || digits.length < 8) return json({ ok: false, error: "Número inválido" }, 400);

    const jidVariants = [
      jid,
      `${digits}@s.whatsapp.net`,
      `${digits}@c.us`,
      digits,
    ];

    const results: Record<string, number> = {};

    // whatsapp_messages
    {
      const { data, error } = await admin
        .from("whatsapp_messages")
        .delete({ count: "exact" })
        .eq("organization_id", orgId)
        .eq("instance_name", instance_name)
        .or(
          `remote_jid.in.(${jidVariants.map((v) => `"${v}"`).join(",")}),phone.eq.${digits}`,
        )
        .select("id");
      if (error) throw new Error(`whatsapp_messages: ${error.message}`);
      results.whatsapp_messages = data?.length ?? 0;
    }

    // whatsapp_ai_usage
    {
      const { data, error } = await admin
        .from("whatsapp_ai_usage")
        .delete({ count: "exact" })
        .eq("organization_id", orgId)
        .eq("instance_name", instance_name)
        .in("remote_jid", jidVariants)
        .select("id");
      if (error) throw new Error(`whatsapp_ai_usage: ${error.message}`);
      results.whatsapp_ai_usage = data?.length ?? 0;
    }

    // whatsapp_welcome_log (no instance_name col)
    {
      const { data, error } = await admin
        .from("whatsapp_welcome_log")
        .delete({ count: "exact" })
        .eq("organization_id", orgId)
        .eq("phone", digits)
        .select("id");
      if (error) throw new Error(`whatsapp_welcome_log: ${error.message}`);
      results.whatsapp_welcome_log = data?.length ?? 0;
    }

    return json({ ok: true, instance_name, number: digits, jid, deleted: results });
  } catch (err) {
    console.error("[whatsapp-delete-conversation]", err);
    return json({ ok: false, error: String((err as Error).message || err) }, 500);
  }
});
