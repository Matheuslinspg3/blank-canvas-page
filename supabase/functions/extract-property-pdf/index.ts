import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// A07: SSRF protection
const supabaseHost = (() => {
  try { return new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname; } catch { return ""; }
})();
const ALLOWED_HOSTS = [supabaseHost, "res.cloudinary.com"].filter(Boolean);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" ||
        hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.") ||
        hostname === "169.254.169.254" || hostname.endsWith(".internal") || hostname.endsWith(".local")) return false;
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch { return false; }
}

function encodeBase64Chunked(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j]);
  }
  return btoa(binary);
}

function extractPdfHyperlinks(bytes: Uint8Array): string[] {
  let raw = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) raw += String.fromCharCode(bytes[j]);
  }
  const urls = new Set<string>();
  const parenPattern = /\/URI\s*\(([^)]+)\)/gi;
  let match;
  while ((match = parenPattern.exec(raw)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http")) urls.add(url);
  }
  const hexPattern = /\/URI\s*<([0-9A-Fa-f]+)>/gi;
  while ((match = hexPattern.exec(raw)) !== null) {
    try {
      const hex = match[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) decoded += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
      if (decoded.startsWith("http")) urls.add(decoded);
    } catch { /* skip */ }
  }
  return Array.from(urls);
}

async function getPdfBytes(req: Request): Promise<{ bytes: Uint8Array; fileName: string }> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const { storage_url, file_name } = body;
    if (!storage_url) throw new Error("storage_url é obrigatório");
    if (!isAllowedUrl(storage_url)) throw new Error("URL não permitida.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const pdfResponse = await fetch(storage_url, { signal: controller.signal, redirect: "error" });
      if (!pdfResponse.ok) throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
      const arrayBuffer = await pdfResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      if (bytes.length > 20 * 1024 * 1024) throw new Error("Arquivo muito grande. Limite: 20MB.");
      return { bytes, fileName: file_name || "document.pdf" };
    } finally { clearTimeout(timeout); }
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Nenhum arquivo enviado");
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo muito grande. Limite: 20MB.");
  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), fileName: file.name };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Clone req for getPdfBytes since body can only be read once
    const { bytes, fileName } = await getPdfBytes(req);

    const hyperlinks = extractPdfHyperlinks(bytes);
    const photoLinks = hyperlinks.filter(url =>
      url.includes("drive.google.com") || url.includes("docs.google.com") ||
      url.includes("onedrive.live.com") || url.includes("1drv.ms") ||
      url.includes("photos.google.com") || url.includes("dropbox.com")
    );

    const base64 = encodeBase64Chunked(bytes);

    const hyperlinksContext = photoLinks.length > 0
      ? `\n\nLINKS DE FOTOS EXTRAÍDOS DO PDF:\n${photoLinks.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}\nUse esses links no campo photos_url.`
      : "";

    const systemPrompt = `Você é um especialista em extração de dados imobiliários de PDFs.
Extraia TODOS os imóveis listados.

Regras:
- Preços são números (sem R$). Ex: 450000
- transaction_type: "venda", "aluguel" ou "ambos"
- property_condition: "novo" ou "usado"
- Amenidades são array de strings
- Se não constar, omita o campo
- is_sold = true se marcado vendido
- is_reserved = true se reservado${hyperlinksContext}

Responda com JSON: { "properties": [{ unit_identifier, property_type, transaction_type, sale_price, rent_price, bedrooms, suites, bathrooms, parking_spots, area_total, area_built, address_neighborhood, address_city, address_state, description, amenities, ... }] }`;

    const promptText = `Extraia TODOS os imóveis deste documento PDF (o conteúdo está em base64 inline). O PDF contém ${(bytes.length / 1024).toFixed(0)}KB de dados.`;

    // Call ai-router with base64 PDF as image (Gemini supports PDF via inlineData)
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "pdf_extract",
        prompt: promptText,
        system_prompt: systemPrompt,
        image_base64: base64,
        user_id: claimsData.claims.sub,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) {
      return new Response(
        JSON.stringify({ error: "Todas as chaves de IA estão indisponíveis. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse structured data from text response
    const aiText = aiResult.text || "";
    let extractedData: any;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      extractedData = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados do PDF" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-pdf] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
