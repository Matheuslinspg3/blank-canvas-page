import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  formal: "Use linguagem formal, técnica e profissional. Sem gírias ou emojis no portal.",
  emocional: "Use linguagem envolvente, emocional e inspiradora. Faça o leitor se imaginar morando lá.",
  direto: "Seja extremamente direto e objetivo. Vá direto ao ponto sem rodeios.",
  luxo: "Use linguagem sofisticada, elegante e exclusiva. Transmita luxo e exclusividade.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rateLimited = await checkAiRateLimit(user.id, "generate-ad-content", corsHeaders);
    if (rateLimited) return rateLimited;

    const { formData, leadName, tone, channel } = await req.json();
    if (!formData?.tipo || !formData?.finalidade || !formData?.bairro_cidade) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await serviceClient.from("profiles").select("organization_id").eq("user_id", user.id).single();

    const propertyDesc = buildPropertyDescription(formData);
    const toneInstruction = TONE_INSTRUCTIONS[tone || "formal"] || TONE_INSTRUCTIONS.formal;

    const channelInstruction = channel && channel !== "all"
      ? `\n\nGere APENAS a versão para ${channel}. Retorne um JSON com apenas o campo "${channel}".`
      : `\n\nRetorne um JSON com os campos: portal, instagram, whatsapp, image_prompts (array de 3 prompts em inglês para gerar imagens).`;

    const systemPrompt = `You are a professional real estate copywriter specialized in high-conversion property advertisements.

GOAL: Generate persuasive marketing text for a real estate advertisement.

STYLE: ${toneInstruction}

CONSTRAINTS:
- Keep total output under 1,200 characters per platform
- Avoid repeating information across platforms
- For Portal: HEADLINE, SUBHEADLINE, SHORT DESCRIPTION, BULLET HIGHLIGHTS, CTA
- For Instagram: engaging copy with emojis and hashtags
- For WhatsApp: max 80 words, direct CTA

Respond with ONLY a valid JSON object (no markdown, no code blocks). LANGUAGE: Brazilian Portuguese (pt-BR).`;

    const userPrompt = `Gere ${channel && channel !== "all" ? `a versão ${channel} do` : "3 versões de"} anúncio para este imóvel:\n\n${propertyDesc}\n\n${leadName ? `Cliente alvo: ${leadName}` : ""}${channelInstruction}`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "ad_text",
        prompt: userPrompt,
        system_prompt: systemPrompt,
        organization_id: profile?.organization_id || undefined,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de IA falharam: " + (aiResult.error || "Unknown") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI text response as JSON
    let result: any = null;
    const aiText = aiResult.text || "";
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch { /* */ }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "AI não retornou dados estruturados" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.image_prompts) result.image_prompts = [];
    return new Response(JSON.stringify({ ...result, _ai_provider: aiResult.provider, _ai_model: aiResult.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ad-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPropertyDescription(data: any): string {
  const parts = [
    `Tipo: ${data.tipo}`,
    `Finalidade: ${data.finalidade}`,
    `Localização: ${data.bairro_cidade}`,
  ];
  if (data.valor) parts.push(`Valor: R$ ${Number(data.valor).toLocaleString("pt-BR")}`);
  if (data.metragem) parts.push(`Metragem: ${data.metragem} m²`);
  if (data.quartos) parts.push(`Quartos: ${data.quartos}`);
  if (data.suites) parts.push(`Suítes: ${data.suites}`);
  if (data.vagas) parts.push(`Vagas: ${data.vagas}`);
  if (data.diferenciais) parts.push(`Diferenciais: ${data.diferenciais}`);
  return parts.join("\n");
}
