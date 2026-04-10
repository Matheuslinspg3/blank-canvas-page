import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function getTimePeriod(): string {
  const hour = new Date().getUTCHours() - 3; // BRT = UTC-3
  const h = hour < 0 ? hour + 24 : hour;
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

function weightedRandomSelect(messages: any[]): any {
  // 20% exploration (random), 80% exploitation (weighted by reply_rate)
  if (Math.random() < 0.2 || messages.every((m: any) => (m.reply_rate ?? 0) === 0)) {
    return messages[Math.floor(Math.random() * messages.length)];
  }
  const totalRate = messages.reduce((sum: number, m: any) => sum + Math.max(m.reply_rate ?? 0, 0.1), 0);
  let rand = Math.random() * totalRate;
  for (const m of messages) {
    rand -= Math.max(m.reply_rate ?? 0, 0.1);
    if (rand <= 0) return m;
  }
  return messages[messages.length - 1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (webhookSecret !== expectedSecret) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { instance_name, phone, contact_name, is_lead, campaign_tag } = await req.json();

    if (!instance_name) {
      return new Response(JSON.stringify({ error: "instance_name required" }), { status: 400, headers: corsHeaders });
    }

    // Resolve org
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("organization_id")
      .eq("instance_name", instance_name)
      .single();

    if (!instance?.organization_id) {
      return new Response(JSON.stringify({ message: null, reason: "no_org" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = instance.organization_id;
    const cleanPhone = phone ? phone.replace("@s.whatsapp.net", "") : null;

    // ── Smart welcome logic using welcome_log ──
    if (cleanPhone) {
      const { data: lastWelcome } = await supabase
        .from("whatsapp_welcome_log")
        .select("*")
        .eq("organization_id", orgId)
        .eq("phone", cleanPhone)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWelcome) {
        if (lastWelcome.had_dialogue) {
          const daysSinceActivity = lastWelcome.last_activity_at
            ? (Date.now() - new Date(lastWelcome.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
            : 999;
          if (daysSinceActivity < 30) {
            return new Response(JSON.stringify({ message: null, reason: "returning_contact_with_dialogue" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        const hoursSinceSent = (Date.now() - new Date(lastWelcome.sent_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceSent < 24) {
          return new Response(JSON.stringify({ message: null, reason: "recent_welcome_no_spam" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Get config for A/B test and delay settings
    const { data: config } = await supabase
      .from("whatsapp_agent_config")
      .select("welcome_next_index, welcome_ab_test, welcome_delay_min, welcome_delay_max")
      .eq("organization_id", orgId)
      .single();

    const abTest = config?.welcome_ab_test ?? false;
    const delayMin = config?.welcome_delay_min ?? 3;
    const delayMax = config?.welcome_delay_max ?? 8;

    // Get active welcome messages
    const { data: allMessages } = await supabase
      .from("whatsapp_welcome_messages")
      .select("id, message, position, usage_count, time_period, media_url, media_type, target_audience, campaign_tag, reply_count, reply_rate")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (!allMessages || allMessages.length === 0) {
      return new Response(JSON.stringify({ message: null, reason: "no_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by time period
    const currentPeriod = getTimePeriod();
    let filtered = allMessages.filter(
      (m: any) => !m.time_period || m.time_period === "all" || m.time_period === currentPeriod
    );

    // Filter by target audience
    if (is_lead === true) {
      filtered = filtered.filter((m: any) => !m.target_audience || m.target_audience === "all" || m.target_audience === "leads_only");
    } else if (is_lead === false) {
      filtered = filtered.filter((m: any) => !m.target_audience || m.target_audience === "all" || m.target_audience === "new_only");
    }

    // Filter/prioritize by campaign tag
    if (campaign_tag) {
      const campaignMatches = filtered.filter((m: any) => m.campaign_tag === campaign_tag);
      if (campaignMatches.length > 0) {
        filtered = campaignMatches;
      }
    }

    // Fallback to all messages if filters removed everything
    if (filtered.length === 0) {
      filtered = allMessages;
    }

    // Select message: A/B weighted or round-robin
    let selected: any;
    if (abTest) {
      selected = weightedRandomSelect(filtered);
    } else {
      const currentIndex = config?.welcome_next_index ?? 0;
      const selectedIndex = currentIndex % filtered.length;
      selected = filtered[selectedIndex];
    }

    // Replace {{nome}}
    let finalMessage = selected.message;
    if (contact_name) {
      finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, contact_name);
    } else {
      finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, "").replace(/\s{2,}/g, " ").trim();
    }

    // Calculate delay
    const delaySeconds = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

    // Update index, usage count, and log
    const nextIndex = ((config?.welcome_next_index ?? 0) + 1) % allMessages.length;

    await Promise.all([
      supabase
        .from("whatsapp_agent_config")
        .update({ welcome_next_index: nextIndex })
        .eq("organization_id", orgId),
      supabase
        .from("whatsapp_welcome_messages")
        .update({ usage_count: selected.usage_count + 1 })
        .eq("id", selected.id),
      ...(cleanPhone
        ? [
            supabase.from("whatsapp_welcome_log").insert({
              organization_id: orgId,
              phone: cleanPhone,
              welcome_message_id: selected.id,
            }),
          ]
        : []),
    ]);

    return new Response(
      JSON.stringify({
        message: finalMessage,
        message_id: selected.id,
        media_url: selected.media_url || null,
        media_type: selected.media_type || null,
        delay_seconds: delaySeconds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("whatsapp-get-welcome error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
