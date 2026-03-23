import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiRateLimit } from "../_shared/ai-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Não autorizado");

    const rateLimited = await checkAiRateLimit(user.id, "contract-ai-fill", corsHeaders);
    if (rateLimited) return rateLimited;

    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new Error("Organização não encontrada");

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      throw new Error("Prompt inválido");
    }

    // COST OPT: Limit context size to reduce AI input tokens (~70% token reduction).
    // 500 leads+props = ~18k tokens in context; 100+200 = ~7k tokens.
    // Order by recency so the most relevant records appear first.
    const [leadsRes, propertiesRes, brokersRes] = await Promise.all([
      supabase.from("leads").select("id, name, email, phone, estimated_value").eq("organization_id", profile.organization_id).eq("is_active", true).order("updated_at", { ascending: false }).limit(100),
      supabase.from("properties").select("id, title, property_code, sale_price, rent_price, transaction_type, address_city, address_neighborhood, status").eq("organization_id", profile.organization_id).eq("status", "disponivel").order("updated_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("user_id, full_name").eq("organization_id", profile.organization_id).limit(100),
    ]);

    const leads = leadsRes.data || [];
    const properties = propertiesRes.data || [];
    const brokers = brokersRes.data || [];

    const systemPrompt = `Você é um assistente de contratos imobiliários. O usuário vai descrever um contrato de forma livre. Você deve identificar os dados e retornar o preenchimento do contrato.

DADOS DISPONÍVEIS:
Clientes: ${JSON.stringify(leads.map((l) => ({ id: l.id, name: l.name, email: l.email })))}
Imóveis: ${JSON.stringify(properties.map((p) => ({ id: p.id, title: p.title, code: p.property_code, sale_price: p.sale_price, rent_price: p.rent_price, type: p.transaction_type, city: p.address_city })))}
Corretores: ${JSON.stringify(brokers.map((b) => ({ id: b.user_id, name: b.full_name })))}

REGRAS:
- Match fuzzy pelo nome do cliente
- Match pelo código do imóvel (property_code)
- Se venda, use sale_price; se locação, use rent_price
- Determine tipo do contrato pelo transaction_type do imóvel
- Data início padrão: hoje (${new Date().toISOString().split("T")[0]})

Responda APENAS com JSON: { type: "venda"|"locacao", property_id, lead_id, broker_id, value, commission_percentage, start_date, end_date, payment_day, readjustment_index, notes, summary }`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "contract_fill",
        prompt,
        system_prompt: systemPrompt,
        organization_id: profile.organization_id,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) throw new Error(aiResult.error || "AI Router failed");

    // Parse JSON from text response
    const aiText = aiResult.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não retornou dados estruturados");

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contract-ai-fill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
