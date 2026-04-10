import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

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

    const { instance_name, phone, contact_name } = await req.json();
    if (!instance_name) {
      return new Response(JSON.stringify({ error: "instance_name required" }), { status: 400, headers: corsHeaders });
    }

    // Resolve org from instance
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
      // Check the most recent welcome log for this contact
      const { data: lastWelcome } = await supabase
        .from("whatsapp_welcome_log")
        .select("*")
        .eq("organization_id", orgId)
        .eq("phone", cleanPhone)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWelcome) {
        // Case 1: Had real dialogue (2+ responses after welcome) → returning contact
        if (lastWelcome.had_dialogue) {
          // But if last activity was > 30 days ago, treat as dormant → resend
          const daysSinceActivity = lastWelcome.last_activity_at
            ? (Date.now() - new Date(lastWelcome.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
            : 999;

          if (daysSinceActivity < 30) {
            return new Response(JSON.stringify({ message: null, reason: "returning_contact_with_dialogue" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // > 30 days dormant → fall through to resend welcome
        }

        // Case 2: Welcome sent recently (< 24h), no dialogue yet → don't spam
        const hoursSinceSent = (Date.now() - new Date(lastWelcome.sent_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceSent < 24) {
          return new Response(JSON.stringify({ message: null, reason: "recent_welcome_no_spam" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Case 3: Welcome sent > 24h ago, responded but no real dialogue → they said "oi" again
        // We resend to re-engage them
        // Case 4: Welcome sent > 24h ago, never responded → resend to try again
        // Both cases: fall through to send a new welcome
      }
      // No log entry → first contact ever → fall through to send welcome
    }

    // Get active welcome messages ordered by position
    const { data: messages } = await supabase
      .from("whatsapp_welcome_messages")
      .select("id, message, position, usage_count")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: null, reason: "no_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current index from agent config
    const { data: config } = await supabase
      .from("whatsapp_agent_config")
      .select("welcome_next_index")
      .eq("organization_id", orgId)
      .single();

    const currentIndex = config?.welcome_next_index ?? 0;
    const selectedIndex = currentIndex % messages.length;
    const selected = messages[selectedIndex];

    // Replace {{nome}} placeholder
    let finalMessage = selected.message;
    if (contact_name) {
      finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, contact_name);
    } else {
      finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, "").replace(/\s{2,}/g, " ").trim();
    }

    // Update index, usage count, and log the welcome send
    const nextIndex = (currentIndex + 1) % messages.length;

    await Promise.all([
      supabase
        .from("whatsapp_agent_config")
        .update({ welcome_next_index: nextIndex })
        .eq("organization_id", orgId),
      supabase
        .from("whatsapp_welcome_messages")
        .update({ usage_count: selected.usage_count + 1 })
        .eq("id", selected.id),
      // Log the welcome send for tracking
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

    return new Response(JSON.stringify({ message: finalMessage, message_id: selected.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-get-welcome error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
