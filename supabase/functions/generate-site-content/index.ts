import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    // Auth
    const { user, error: authErr } = await getAuthenticatedUser(req);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    // Rate limit
    const rl = await checkAiRateLimitRedis(user.id, "generate-site-content", corsHeaders, 10, 3600);
    if (rl) return rl;

    const supabase = createServiceClient();

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) return errorResponse("Organização não encontrada", 404);

    const orgId = profile.organization_id;

    // Fetch org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name, slug")
      .eq("id", orgId)
      .single();

    // Fetch a sample of properties for context
    const { data: properties } = await supabase
      .from("properties")
      .select("title, transaction_type, sale_price, rent_price, address_city, address_neighborhood, bedrooms, area_total")
      .eq("organization_id", orgId)
      .eq("status", "disponivel")
      .limit(30);

    // Build context about properties
    const cities = [...new Set((properties || []).map(p => p.address_city).filter(Boolean))];
    const neighborhoods = [...new Set((properties || []).map(p => p.address_neighborhood).filter(Boolean))].slice(0, 10);
    const types = [...new Set((properties || []).map(p => p.transaction_type).filter(Boolean))];
    const priceRange = (properties || []).reduce((acc, p) => {
      const price = p.sale_price || p.rent_price || 0;
      if (price > 0) {
        acc.min = Math.min(acc.min, price);
        acc.max = Math.max(acc.max, price);
      }
      return acc;
    }, { min: Infinity, max: 0 });
    const totalCount = (properties || []).length;

    const prompt = `Você é um copywriter especialista em marketing imobiliário brasileiro. 
Gere conteúdo completo para o site da imobiliária "${org?.name || 'Imobiliária'}".

Contexto:
- Nome: ${org?.name}
- Total de imóveis disponíveis: ${totalCount}
- Cidades: ${cities.join(", ") || "não informado"}
- Bairros: ${neighborhoods.join(", ") || "não informado"}
- Tipos de transação: ${types.join(", ") || "venda e aluguel"}
- Faixa de preço: ${priceRange.min < Infinity ? `R$ ${priceRange.min.toLocaleString()} a R$ ${priceRange.max.toLocaleString()}` : "variada"}

Gere um JSON com EXATAMENTE estas chaves (em português do Brasil, tom profissional e persuasivo):
{
  "hero_title": "título impactante para o hero (max 60 chars)",
  "hero_subtitle": "subtítulo complementar (max 120 chars)",
  "about_text": "texto de 3-4 parágrafos sobre a imobiliária (profissional, destacando experiência e diferenciais)",
  "meta_title": "título SEO otimizado (max 60 chars)",
  "meta_description": "descrição SEO otimizada (max 155 chars)",
  "whatsapp_message": "mensagem padrão curta e convidativa para WhatsApp"
}

IMPORTANTE: Retorne APENAS o JSON válido, sem markdown, sem blocos de código.`;

    // Try Google AI first (keys available), then Groq
    const aiKeys = [
      { key: Deno.env.get("GOOGLE_AI_KEY_1"), provider: "google" },
      { key: Deno.env.get("GOOGLE_AI_KEY_2"), provider: "google" },
      { key: Deno.env.get("GROQ_API_KEY_1"), provider: "groq" },
    ].filter(k => !!k.key);

    if (aiKeys.length === 0) {
      return errorResponse("Nenhuma chave de IA configurada. Configure GOOGLE_AI_KEY_1 ou GROQ_API_KEY_1.", 503);
    }

    let aiResult: string | null = null;

    for (const { key, provider } of aiKeys) {
      try {
        if (provider === "google") {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: "application/json" },
              }),
            }
          );
          if (!resp.ok) continue;
          const data = await resp.json();
          aiResult = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiResult) break;
        } else if (provider === "groq") {
          const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: "Você é um copywriter imobiliário. Responda apenas com JSON válido." },
                { role: "user", content: prompt },
              ],
              temperature: 0.7,
              max_tokens: 1024,
              response_format: { type: "json_object" },
            }),
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          aiResult = data?.choices?.[0]?.message?.content;
          if (aiResult) break;
        }
      } catch (e) {
        console.error(`[generate-site-content] Provider ${provider} failed:`, e);
        continue;
      }
    }

    if (!aiResult) {
      return errorResponse("Não foi possível gerar conteúdo. Tente novamente.", 502);
    }

    // Sanitize and parse
    let cleaned = aiResult.trim();
    cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return errorResponse("Resposta da IA inválida", 502);

    const parsed = JSON.parse(match[0]);

    return json({
      hero_title: parsed.hero_title || "",
      hero_subtitle: parsed.hero_subtitle || "",
      about_text: parsed.about_text || "",
      meta_title: parsed.meta_title || "",
      meta_description: parsed.meta_description || "",
      whatsapp_message: parsed.whatsapp_message || "",
    });
  } catch (err) {
    console.error("[generate-site-content] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
