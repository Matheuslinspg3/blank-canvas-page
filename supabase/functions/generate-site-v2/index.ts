import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

const SECTION_CATALOG = [
  { id: "hero-split", category: "hero", label: "Hero dividido com texto e imagem" },
  { id: "hero-image-bg", category: "hero", label: "Hero com imagem de fundo full" },
  { id: "hero-minimal", category: "hero", label: "Hero minimalista centralizado" },
  { id: "about-centered", category: "about", label: "Sobre centralizado" },
  { id: "about-with-image", category: "about", label: "Sobre com imagem lateral" },
  { id: "properties-grid", category: "properties", label: "Grid de imóveis" },
  { id: "properties-carousel", category: "properties", label: "Carrossel de imóveis" },
  { id: "contact-split", category: "contact", label: "Contato dividido com mapa" },
  { id: "contact-cta", category: "contact", label: "Contato com CTA" },
  { id: "cta-banner", category: "cta", label: "Banner de chamada" },
  { id: "footer-three-col", category: "footer", label: "Rodapé 3 colunas" },
  { id: "footer-minimal", category: "footer", label: "Rodapé minimalista" },
];

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user, error: authErr } = await getAuthenticatedUser(req);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const rl = await checkAiRateLimitRedis(user.id, "generate-site-v2", corsHeaders, 5, 3600);
    if (rl) return rl;

    const body = await req.json();
    const { mode, answers } = body as {
      mode: "text_only" | "full_layout";
      answers: Record<string, string>;
    };

    const supabase = createServiceClient();

    // Get user org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) return errorResponse("Organização não encontrada", 404);
    const orgId = profile.organization_id;

    // Fetch org data in parallel
    const [orgRes, brandRes, propsRes] = await Promise.all([
      supabase.from("organizations").select("name, slug").eq("id", orgId).single(),
      supabase.from("brand_settings").select("*").eq("organization_id", orgId).single(),
      supabase.from("properties")
        .select("title, transaction_type, sale_price, rent_price, address_city, address_neighborhood, bedrooms, area_total, images")
        .eq("organization_id", orgId)
        .eq("status", "disponivel")
        .limit(12),
    ]);

    const org = orgRes.data;
    const brand = brandRes.data;
    const properties = propsRes.data || [];

    // Build context
    const cities = [...new Set(properties.map((p: any) => p.address_city).filter(Boolean))];
    const neighborhoods = [...new Set(properties.map((p: any) => p.address_neighborhood).filter(Boolean))].slice(0, 8);
    const priceRange = properties.reduce((acc: any, p: any) => {
      const price = p.sale_price || p.rent_price || 0;
      if (price > 0) { acc.min = Math.min(acc.min, price); acc.max = Math.max(acc.max, price); }
      return acc;
    }, { min: Infinity, max: 0 });

    const toneMap: Record<string, string> = {
      profissional: "profissional e confiável",
      acolhedor: "acolhedor e próximo do cliente",
      luxo: "sofisticado e premium",
      jovem: "moderno, jovem e dinâmico",
      tecnico: "técnico e informativo",
    };
    const toneDesc = toneMap[answers?.tone || "profissional"] || "profissional";

    const contextBlock = `
Imobiliária: ${org?.name || "Imobiliária"}
Cores da marca: primária ${brand?.primary_color || "#2563eb"}, secundária ${brand?.secondary_color || "#1e293b"}, destaque ${brand?.accent_color || "#f59e0b"}
Logo: ${brand?.logo_url || "sem logo"}
Slogan: ${brand?.slogan || "sem slogan"}
Total imóveis: ${properties.length}
Cidades: ${cities.join(", ") || "não informado"}
Bairros: ${neighborhoods.join(", ") || "não informado"}
Faixa de preço: ${priceRange.min < Infinity ? `R$ ${priceRange.min.toLocaleString("pt-BR")} a R$ ${priceRange.max.toLocaleString("pt-BR")}` : "variada"}
Público-alvo: ${answers?.target_audience || "geral"}
Diferenciais: ${answers?.differentials || "não informado"}
Tom: ${toneDesc}
Região: ${answers?.region_focus || "não especificada"}
Info extra: ${answers?.extra_info || "nenhuma"}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY não configurada", 503);

    if (mode === "text_only") {
      // Generate just text content
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Você é um copywriter especialista em marketing imobiliário brasileiro. Responda usando a ferramenta fornecida." },
            { role: "user", content: `Gere conteúdo textual completo para o site desta imobiliária.\n${contextBlock}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "site_content",
              description: "Conteúdo textual para o site da imobiliária",
              parameters: {
                type: "object",
                properties: {
                  hero_title: { type: "string", description: "Título impactante do hero (max 60 chars)" },
                  hero_subtitle: { type: "string", description: "Subtítulo do hero (max 120 chars)" },
                  about_text: { type: "string", description: "Texto institucional de 3-4 parágrafos" },
                  meta_title: { type: "string", description: "Título SEO (max 60 chars)" },
                  meta_description: { type: "string", description: "Descrição SEO (max 155 chars)" },
                  whatsapp_message: { type: "string", description: "Mensagem padrão para WhatsApp" },
                  cta_text: { type: "string", description: "Texto do botão CTA principal" },
                  cta_subtitle: { type: "string", description: "Subtítulo do banner CTA" },
                },
                required: ["hero_title", "hero_subtitle", "about_text", "meta_title", "meta_description", "whatsapp_message", "cta_text", "cta_subtitle"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "site_content" } },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI error:", resp.status, t);
        if (resp.status === 429) return errorResponse("Limite de requisições atingido. Tente novamente em alguns minutos.", 429);
        if (resp.status === 402) return errorResponse("Créditos de IA esgotados.", 402);
        return errorResponse("Erro ao gerar conteúdo", 502);
      }

      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return errorResponse("IA não retornou conteúdo", 502);

      const content = JSON.parse(toolCall.function.arguments);
      return json({ mode: "text_only", content });
    }

    // ── FULL LAYOUT MODE ──
    const sectionCatalogStr = SECTION_CATALOG.map(s => `- ${s.id} (${s.category}): ${s.label}`).join("\n");

    const fullPrompt = `Você é um web designer e copywriter especialista em sites imobiliários brasileiros.
Monte um site completo escolhendo seções do catálogo e preenchendo todo o conteúdo.

CATÁLOGO DE SEÇÕES:
${sectionCatalogStr}

DADOS DA IMOBILIÁRIA:
${contextBlock}

REGRAS:
1. Escolha 5-7 seções que façam sentido para esta imobiliária
2. Sempre inclua: 1 hero, 1 about, 1 properties, 1 footer
3. Preencha TODOS os textos de forma personalizada e realista
4. Use o tom "${toneDesc}" em todos os textos
5. Os textos devem parecer escritos por um profissional de marketing
6. Adapte o hero_image_description ao tipo de imobiliária`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Você é um web designer especialista em sites imobiliários. Use a ferramenta para retornar o layout." },
          { role: "user", content: fullPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_site_layout",
            description: "Gera o layout completo do site com seções e conteúdo personalizado",
            parameters: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      template_id: { type: "string", description: "ID do template do catálogo" },
                      content: {
                        type: "object",
                        properties: {
                          heading: { type: "string" },
                          subheading: { type: "string" },
                          paragraph: { type: "string" },
                          button_text: { type: "string" },
                          button_link: { type: "string" },
                        },
                      },
                    },
                    required: ["template_id", "content"],
                    additionalProperties: false,
                  },
                },
                meta: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                  additionalProperties: false,
                },
                whatsapp_message: { type: "string" },
              },
              required: ["sections", "meta", "whatsapp_message"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_site_layout" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      if (resp.status === 429) return errorResponse("Limite de requisições atingido.", 429);
      if (resp.status === 402) return errorResponse("Créditos de IA esgotados.", 402);
      return errorResponse("Erro ao gerar layout", 502);
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return errorResponse("IA não retornou layout", 502);

    const aiLayout = JSON.parse(toolCall.function.arguments);

    // Build SiteLayoutV2 from AI response using section templates
    const theme = {
      primaryColor: brand?.primary_color || "#2563eb",
      secondaryColor: brand?.secondary_color || "#1e293b",
      accentColor: brand?.accent_color || "#f59e0b",
      fontFamily: brand?.font_family || "Inter",
    };

    // We return the AI layout data + theme for the frontend to build
    // The frontend has access to SectionTemplateRegistry and will assemble the sections
    return json({
      mode: "full_layout",
      aiLayout,
      theme,
      orgName: org?.name || "Imobiliária",
    });
  } catch (err) {
    console.error("[generate-site-v2] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
