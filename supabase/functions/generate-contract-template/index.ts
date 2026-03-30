import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowlist-based HTML sanitizer for contract templates
const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "b", "i", "u",
  "ol", "ul", "li",
  "br", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div", "blockquote",
]);

function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove style tags and their content
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove all event handlers (on* attributes) - handles quoted, unquoted, backtick
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi, "");
  // Remove javascript: URIs in any attribute
  cleaned = cleaned.replace(/\s+(href|src|action|formaction|data)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|javascript:[^\s>]+)/gi, "");
  // Remove dangerous tags not in allowlist (svg, iframe, object, embed, form, input, img with potential XSS)
  cleaned = cleaned.replace(/<\/?(?!(?:p|h[1-6]|strong|em|b|i|u|ol|ul|li|br|hr|table|thead|tbody|tr|th|td|span|div|blockquote)\b)[a-z][a-z0-9]*(?:\s[^>]*)?\/?>/gi, "");
  return cleaned.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const rateLimited = await checkAiRateLimitRedis(user.id, "generate-contract-template", corsHeaders);
    if (rateLimited) return rateLimited;

    const { contractType, templateName, description } = await req.json();
    const typeLabel = contractType === "locacao" ? "Locação" : contractType === "ambos" ? "Venda e Locação" : "Venda";

    const systemPrompt = `Você é um advogado imobiliário brasileiro especialista em redigir contratos.
Gere um modelo de contrato de ${typeLabel} completo e profissional em HTML.

REGRAS:
- Use as seguintes variáveis dinâmicas onde apropriado (NÃO invente outras):
  {{nome_cliente}}, {{cpf_cliente}}, {{email_cliente}}, {{telefone_cliente}},
  {{endereco_imovel}}, {{codigo_imovel}}, {{titulo_imovel}},
  {{valor_contrato}}, {{tipo_contrato}}, {{data_inicio}}, {{data_fim}},
  {{corretor_nome}}, {{comissao}}, {{dia_pagamento}}, {{indice_reajuste}}, {{data_atual}}
- Use tags HTML simples: <p>, <h2>, <h3>, <strong>, <em>, <ol>, <ul>, <li>
- NÃO use <html>, <head>, <body>, <style> ou CSS inline
- Inclua cláusulas padrão: objeto, preço, pagamento, obrigações, rescisão, foro
- Para locação inclua: prazo, reajuste, garantias, vistoria
- Seja formal e juridicamente correto
- Retorne APENAS o HTML do corpo do contrato, sem explicações`;

    const userPrompt = templateName
      ? `Gere um contrato com o título "${templateName}"${description ? `. Detalhes: ${description}` : ""}.`
      : `Gere um contrato padrão de ${typeLabel} para imóveis.`;

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "contract_template",
        prompt: userPrompt,
        system_prompt: systemPrompt,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) throw new Error(aiResult.error || "AI Router failed");

    let html = aiResult.text || "";
    html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
    // Server-side allowlist-based sanitization
    html = sanitizeHtml(html);

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-contract-template error:", err);
    const message = err?.message || "Erro ao gerar template";
    const status = message.includes("429") ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
