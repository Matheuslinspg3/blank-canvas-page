import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const callData = body.call ?? body.data ?? body;

    console.log("Retell webhook event:", event, "call_id:", callData?.call_id);

    if (!callData?.call_id) {
      return new Response(JSON.stringify({ error: "call_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updates: Record<string, unknown> = {};

    if (event === "call_started") {
      updates.call_status = "in_progress";
      updates.started_at = callData.start_timestamp
        ? new Date(callData.start_timestamp).toISOString()
        : new Date().toISOString();
    } else if (event === "call_ended") {
      updates.call_status = "ended";
      updates.ended_at = callData.end_timestamp
        ? new Date(callData.end_timestamp).toISOString()
        : new Date().toISOString();
      updates.duration_ms = callData.duration_ms ?? callData.call_duration_ms ?? null;
      updates.recording_url = callData.recording_url ?? null;
      updates.transcript = callData.transcript ?? null;
    } else if (event === "call_analyzed") {
      updates.call_status = "analyzed";
      updates.sentiment = callData.call_analysis?.user_sentiment ?? callData.sentiment ?? null;
      updates.transcript = callData.transcript ?? updates.transcript ?? null;
      updates.recording_url = callData.recording_url ?? null;
      if (callData.call_analysis) {
        updates.metadata = callData.call_analysis;
      }
    }

    // Get organization_id from existing call record
    let organizationId: string | null = null;
    const { data: existingCall } = await supabase
      .from("voice_calls")
      .select("organization_id")
      .eq("call_id", callData.call_id)
      .maybeSingle();

    organizationId = existingCall?.organization_id ?? null;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("voice_calls")
        .update(updates)
        .eq("call_id", callData.call_id);

      if (error) {
        console.error("Error updating voice_calls:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Trigger n8n workflow after call_ended or call_analyzed (when transcript is available)
    if ((event === "call_ended" || event === "call_analyzed") && organizationId) {
      try {
        // Get org config to check for n8n webhook URL
        const { data: config } = await supabase
          .from("retell_agent_config")
          .select("n8n_webhook_url, enabled")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (config?.enabled && config?.n8n_webhook_url) {
          const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
          const n8nPayload = {
            event,
            call_id: callData.call_id,
            organization_id: organizationId,
            transcript: callData.transcript ?? null,
            duration_ms: callData.duration_ms ?? null,
            sentiment: callData.call_analysis?.user_sentiment ?? null,
          };

          console.log("Triggering n8n webhook for call:", callData.call_id);

          const n8nResponse = await fetch(config.n8n_webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
            },
            body: JSON.stringify(n8nPayload),
          });

          console.log("n8n webhook response:", n8nResponse.status);
        }
      } catch (n8nErr) {
        // Don't fail the webhook response if n8n trigger fails
        console.error("n8n webhook trigger failed:", n8nErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retell-webhook error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
