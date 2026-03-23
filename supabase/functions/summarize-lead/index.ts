import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimit } from "../_shared/ai-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const rateLimited = await checkAiRateLimit(userId, "summarize-lead", corsHeaders);
    if (rateLimited) return rateLimited;

    const { lead_id, force_refresh } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: corsHeaders });
    }

    // Get lead data
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, email, phone, estimated_value, temperature, score, source, notes, lead_stage_id, ai_summary, ai_summary_at")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), { status: 404, headers: corsHeaders });
    }

    // COST OPT: Return cached summary if it's less than 24h old and no force_refresh.
    if (!force_refresh && lead.ai_summary && lead.ai_summary_at) {
      const cacheAge = Date.now() - new Date(lead.ai_summary_at).getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ summary: lead.ai_summary, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let stageName = "Sem estágio";
    if (lead.lead_stage_id) {
      const { data: stage } = await supabase.from("lead_stages").select("name").eq("id", lead.lead_stage_id).single();
      if (stage) stageName = stage.name;
    }

    const { data: events } = await supabase
      .from("lead_score_events")
      .select("event_type, score_delta, created_at, metadata")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const eventsText = (events || [])
      .map((e) => `- ${e.event_type} (${e.score_delta > 0 ? "+" : ""}${e.score_delta} pts) em ${new Date(e.created_at).toLocaleDateString("pt-BR")}`)
      .join("\n");

    const prompt = `Analise este lead e gere um resumo conciso (máximo 3 frases) com recomendação de próxima ação.

Lead: ${lead.name}
Score: ${lead.score || 0}/100
Temperatura: ${lead.temperature || "frio"}
Estágio: ${stageName}
Valor estimado: ${lead.estimated_value ? `R$ ${lead.estimated_value.toLocaleString("pt-BR")}` : "Não informado"}
Origem: ${lead.source || "Desconhecida"}
Notas: ${lead.notes || "Nenhuma"}

Últimos eventos:
${eventsText || "Nenhum evento registrado"}

Gere o resumo em português brasileiro, direto e prático.`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "summarize",
        prompt,
        user_id: userId,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) {
      return new Response(JSON.stringify({ error: "Erro ao gerar resumo" }), { status: 500, headers: corsHeaders });
    }

    const summary = aiResult.text || "Não foi possível gerar resumo.";

    // Save summary to lead
    await supabase.from("leads").update({ ai_summary: summary, ai_summary_at: new Date().toISOString() }).eq("id", lead_id);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("summarize-lead error:", err);
    return new Response(JSON.stringify({ error: "Erro ao gerar resumo" }), { status: 500, headers: corsHeaders });
  }
});
