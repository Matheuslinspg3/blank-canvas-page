import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Hybrid auth: X-Webhook-Secret (n8n) or SERVICE_ROLE_KEY
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET");
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isWebhookAuth = webhookSecret && expectedSecret && webhookSecret === expectedSecret;
    const isServiceAuth = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isWebhookAuth && !isServiceAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { job_id, status, extracted_data, error_message } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!status || !["complete", "failed"].includes(status)) {
      return new Response(JSON.stringify({ error: "status deve ser 'complete' ou 'failed'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "complete" && !extracted_data) {
      return new Response(JSON.stringify({ error: "extracted_data é obrigatório quando status é 'complete'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Verify job exists and is still processing
    const { data: existingJob, error: fetchErr } = await sb
      .from("pdf_extract_jobs")
      .select("id, status")
      .eq("id", job_id)
      .single();

    if (fetchErr || !existingJob) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingJob.status !== "processing") {
      return new Response(JSON.stringify({ error: `Job já finalizado com status: ${existingJob.status}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update job
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "complete") {
      updatePayload.result = extracted_data;
    } else {
      updatePayload.error = error_message || "Erro desconhecido no processamento";
    }

    const { error: updateErr } = await sb
      .from("pdf_extract_jobs")
      .update(updatePayload)
      .eq("id", job_id);

    if (updateErr) {
      console.error("[pdf-job-complete] Update error:", updateErr);
      return new Response(JSON.stringify({ error: "Falha ao atualizar job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pdf-job-complete] Job ${job_id} → ${status}`);

    return new Response(JSON.stringify({ success: true, job_id, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[pdf-job-complete] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
