import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: accept X-Webhook-Secret (from n8n) or service role key
    const webhookSecret = req.headers.get("X-Webhook-Secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isWebhook = webhookSecret && expectedSecret && webhookSecret === expectedSecret;
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;

    if (!isWebhook && !isServiceRole) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { call_id, organization_id } = body;

    if (!call_id || !organization_id) {
      return new Response(JSON.stringify({ error: "call_id e organization_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // 1. Get call data
    const { data: call, error: callErr } = await supabase
      .from("voice_calls")
      .select("*")
      .eq("call_id", call_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (callErr || !call) {
      return new Response(JSON.stringify({ error: "Chamada não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get org config
    const { data: config } = await supabase
      .from("retell_agent_config")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!config?.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "Agent not enabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = (call as any).transcript;
    if (!transcript) {
      return new Response(JSON.stringify({ skipped: true, reason: "No transcript" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. AI Analysis of transcript
    const analysisPrompt = config.post_call_analysis_prompt ||
      "Analise a transcrição e extraia: nome, telefone, orcamento, regiao, tipo_imovel, prazo, interesse (1-10). Retorne JSON.";

    const scoreCriteria = config.score_criteria || {};
    const qualificationPrompt = config.qualification_prompt || "";

    const systemMessage = `Você é um analista de vendas imobiliárias. ${qualificationPrompt}

${analysisPrompt}

Critérios de pontuação (pesos):
${Object.entries(scoreCriteria).map(([k, v]) => `- ${k}: peso ${v}`).join("\n")}

Retorne APENAS um JSON válido com esta estrutura:
{
  "lead_name": "string ou null",
  "lead_phone": "string ou null",
  "lead_email": "string ou null",
  "budget": "string ou null",
  "region": "string ou null",
  "property_type": "string ou null",
  "timeline": "string ou null",
  "interest_level": 1-10,
  "score": 0-100,
  "summary": "resumo em 2 frases",
  "qualified": true/false,
  "extracted_data": {}
}`;

    // Use AI router or direct OpenAI
    let analysis: Record<string, unknown> | null = null;

    try {
      const aiResponse = await supabase.functions.invoke("ai-router", {
        body: {
          task_type: "qualification",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: `Transcrição da chamada:\n\n${transcript}` },
          ],
          organization_id,
          user_id: "system",
        },
      });

      if (aiResponse.data?.text) {
        const jsonMatch = aiResponse.data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (aiErr) {
      console.error("AI analysis failed:", aiErr);
    }

    if (!analysis) {
      return new Response(JSON.stringify({ error: "Falha na análise da transcrição" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Update voice_calls with analysis
    await supabase
      .from("voice_calls")
      .update({
        metadata: { ...((call as any).metadata || {}), analysis },
        sentiment: analysis.interest_level && (analysis.interest_level as number) >= 7
          ? "positive"
          : (analysis.interest_level as number) <= 3
            ? "negative"
            : "neutral",
      })
      .eq("call_id", call_id);

    // 5. Create lead in CRM if enabled
    let leadId: string | null = (call as any).lead_id;

    if (config.auto_create_leads && analysis.lead_name && !leadId) {
      // Get first stage
      const { data: firstStage } = await supabase
        .from("lead_stages")
        .select("id")
        .eq("organization_id", organization_id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Fallback created_by: any admin of the org
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      const createdBy = adminRole?.user_id || null;

      if (firstStage && createdBy) {
        const { data: newLead, error: leadErr } = await supabase
          .from("leads")
          .insert({
            organization_id,
            created_by: createdBy,
            name: analysis.lead_name as string,
            phone: (analysis.lead_phone as string) || null,
            email: (analysis.lead_email as string) || null,
            source: "voice_call",
            temperature: (analysis.score as number) >= 70 ? "quente" : (analysis.score as number) >= 40 ? "morno" : "frio",
            lead_stage_id: firstStage.id,
            score: analysis.score as number || 0,
            notes: `Qualificado via chamada de voz. ${analysis.summary || ""}`,
          })
          .select("id")
          .maybeSingle();

        if (!leadErr && newLead) {
          leadId = newLead.id;
          // Link call to lead
          await supabase
            .from("voice_calls")
            .update({ lead_id: leadId })
            .eq("call_id", call_id);
        }
      }
    }

    // 6. Assign broker if configured
    let assignedBrokerId: string | null = null;

    if (config.broker_assignment_mode === "round_robin" && leadId) {
      // Find brokers via user_roles (RBAC)
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "corretor");

      const brokerIds = (roleRows || []).map((r: any) => r.user_id);
      if (brokerIds.length) {
        // Filter to brokers in this org via profiles
        const { data: orgProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("organization_id", organization_id)
          .in("user_id", brokerIds);

        if (orgProfiles?.length) {
          assignedBrokerId = orgProfiles[0].user_id;
          await supabase
            .from("leads")
            .update({ broker_id: assignedBrokerId })
            .eq("id", leadId);
        }
      }
    }

    // Return result for n8n to use in notification
    const result = {
      success: true,
      call_id,
      lead_id: leadId,
      assigned_broker_id: assignedBrokerId,
      analysis,
      notification_template_broker: config.notification_template_broker,
      notification_template_client: config.notification_template_client,
      organization_id,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retell-qualify-call error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
