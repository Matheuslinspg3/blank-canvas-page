import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth via webhook secret (N8N) or Bearer token
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

    // Check if this phone already has messages (not a new contact)
    if (phone) {
      const { count } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("phone", phone.replace("@s.whatsapp.net", ""))
        .gt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (count && count > 1) {
        return new Response(JSON.stringify({ message: null, reason: "returning_contact" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // Update index and usage count atomically
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
    ]);

    return new Response(JSON.stringify({ message: finalMessage, message_id: selected.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-get-welcome error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
