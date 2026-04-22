import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PropertyData {
  id: string;
  title: string;
  description: string | null;
  property_type: { name: string } | null;
  transaction_type: string;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  amenities: string[] | null;
  condominium_fee: number | null;
  iptu: number | null;
  floor: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rateLimited = await checkAiRateLimitRedis(user.id, "generate-landing-content", corsHeaders);
    if (rateLimited) return rateLimited;

    const { propertyId, forceRegenerate = false } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache
    if (!forceRegenerate) {
      const { data: existingContent } = await supabase
        .from("property_landing_content").select("*").eq("property_id", propertyId).single();
      if (existingContent) {
        const hoursDiff = (Date.now() - new Date(existingContent.generated_at).getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          return new Response(JSON.stringify({ content: existingContent, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Fetch property data
    const { data: property, error: propertyError } = await supabase
      .from("properties").select(`*, property_type:property_types(name)`).eq("id", propertyId).single();
    if (propertyError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prop = property as PropertyData;
    const propertyContext = buildPropertyContext(prop);

    const systemPrompt = `Você é um copywriter especializado em marketing imobiliário de alto padrão no Brasil.
Crie textos persuasivos e únicos para landing pages que convertem visitantes em leads.

Diretrizes:
- Use linguagem emocional que evoque desejo e urgência
- Destaque os diferenciais únicos do imóvel
- Crie headlines impactantes e memoráveis
- Use AIDA (Atenção, Interesse, Desejo, Ação)
- NUNCA invente informações não fornecidas

Responda APENAS com JSON válido (sem markdown): {
  "headline": "título impactante (máx 80 chars)",
  "subheadline": "subtítulo (máx 120 chars)",
  "description_persuasive": "descrição 100-180 palavras, 2-3 parágrafos",
  "key_features": [{"icon": "nome ícone Lucide", "title": "diferencial", "description": "benefício"}],
  "cta_primary": "call to action principal",
  "cta_secondary": "call to action secundário",
  "seo_title": "título SEO (máx 60 chars)",
  "seo_description": "meta description (máx 160 chars)"
}`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "landing_page",
        prompt: propertyContext,
        system_prompt: systemPrompt,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) {
      return new Response(
        JSON.stringify({ error: "Todas as chaves de IA estão indisponíveis. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON response
    const aiText = (aiResult.text || "").trim();
    let generatedContent: any;
    try {
      // Strip markdown code fences if present
      let cleaned = aiText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // Find the outermost JSON object by matching balanced braces
      const startIdx = cleaned.indexOf("{");
      if (startIdx === -1) throw new Error("No JSON object found");

      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
      }
      if (endIdx === -1) throw new Error("Unbalanced JSON braces");

      const jsonStr = cleaned.substring(startIdx, endIdx + 1);

      try {
        generatedContent = JSON.parse(jsonStr);
      } catch {
        // Fix trailing commas and control chars
        const fixed = jsonStr
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, (c) => c === "\n" || c === "\t" ? c : "");
        generatedContent = JSON.parse(fixed);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiText.substring(0, 500));
      throw new Error("Invalid AI response format");
    }

    // Fix: sometimes key_features comes as string
    if (typeof generatedContent.key_features === "string") {
      try { generatedContent.key_features = JSON.parse(generatedContent.key_features); } catch { generatedContent.key_features = []; }
    }

    // Upsert content
    const { data: savedContent, error: saveError } = await supabase
      .from("property_landing_content")
      .upsert({
        property_id: propertyId,
        headline: generatedContent.headline,
        subheadline: generatedContent.subheadline,
        description_persuasive: generatedContent.description_persuasive,
        key_features: generatedContent.key_features,
        cta_primary: generatedContent.cta_primary,
        cta_secondary: generatedContent.cta_secondary || null,
        seo_title: generatedContent.seo_title,
        seo_description: generatedContent.seo_description,
        generated_at: new Date().toISOString(),
        model_used: `${aiResult.provider}/${aiResult.model}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "property_id" })
      .select().single();

    if (saveError) {
      console.error("Error saving content:", saveError);
      return new Response(JSON.stringify({ content: generatedContent, cached: false, saveError: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content: savedContent, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-landing-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPropertyContext(prop: PropertyData): string {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  const transactionTypeLabels: Record<string, string> = { venda: "Venda", aluguel: "Aluguel", ambos: "Venda ou Aluguel" };

  let context = `Gere conteúdo de marketing para esta landing page de imóvel:

## DADOS DO IMÓVEL
**Título Original:** ${prop.title}
**Tipo:** ${prop.property_type?.name || "Imóvel"}
**Transação:** ${transactionTypeLabels[prop.transaction_type] || prop.transaction_type}
`;
  if (prop.sale_price) context += `**Preço de Venda:** ${formatPrice(prop.sale_price)}\n`;
  if (prop.rent_price) context += `**Preço de Aluguel:** ${formatPrice(prop.rent_price)}/mês\n`;
  context += `
## CARACTERÍSTICAS
- Quartos: ${prop.bedrooms || 0}${prop.suites ? ` (${prop.suites} suíte${prop.suites > 1 ? "s" : ""})` : ""}
- Banheiros: ${prop.bathrooms || 0}
- Vagas: ${prop.parking_spots || 0}
- Área Total: ${prop.area_total || "Não informada"}m²
${prop.area_built ? `- Área Construída: ${prop.area_built}m²` : ""}
${prop.floor ? `- Andar: ${prop.floor}º` : ""}
`;
  if (prop.condominium_fee || prop.iptu) {
    context += `\n## CUSTOS MENSAIS\n`;
    if (prop.condominium_fee) context += `- Condomínio: ${formatPrice(prop.condominium_fee)}/mês\n`;
    if (prop.iptu) context += `- IPTU: ${formatPrice(prop.iptu)}/ano\n`;
  }
  if (prop.address_neighborhood || prop.address_city) {
    context += `\n## LOCALIZAÇÃO\n- ${[prop.address_neighborhood, prop.address_city, prop.address_state].filter(Boolean).join(", ")}\n`;
  }
  if (prop.amenities?.length) {
    context += `\n## COMODIDADES\n`;
    prop.amenities.forEach((a) => (context += `- ${a}\n`));
  }
  if (prop.description) {
    context += `\n## DESCRIÇÃO ORIGINAL\n${prop.description}\n`;
  }
  context += `\n## INSTRUÇÕES\n- Descrição máx 180 palavras, 2-3 parágrafos curtos\n- Headline memorável\n- Priorize qualidade sobre quantidade`;
  return context;
}
