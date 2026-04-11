import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

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

/** Extract hyperlinks from raw PDF bytes using TextDecoder (O(n)). */
function extractPdfHyperlinks(bytes: Uint8Array): string[] {
  const raw = new TextDecoder("latin1").decode(bytes);
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

// ── Background processor (runs via EdgeRuntime.waitUntil) ──────────────
async function processInBackground(
  jobId: string,
  storageUrl: string,
  fileName: string,
  authHeader: string,
  userId: string,
  organizationId: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1. Download PDF
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let bytes: Uint8Array;
    try {
      const res = await fetch(storageUrl, { signal: controller.signal, redirect: "error" });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 10 * 1024 * 1024) throw new Error("Arquivo > 10MB");
    } finally { clearTimeout(timeout); }

    // 2. Extract hyperlinks (fast, native TextDecoder)
    const hyperlinks = extractPdfHyperlinks(bytes);
    const photoLinks = hyperlinks.filter(url =>
      url.includes("drive.google.com") || url.includes("docs.google.com") ||
      url.includes("onedrive.live.com") || url.includes("1drv.ms") ||
      url.includes("photos.google.com") || url.includes("dropbox.com")
    );

    // 3. Encode base64 (native Deno std)
    const base64 = base64Encode(bytes);

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

    // 4. Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: "pdf_extract",
        prompt: promptText,
        system_prompt: systemPrompt,
        image_base64: base64,
        user_id: userId,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) throw new Error("IA indisponível");

    // 5. Parse result
    const aiText = aiResult.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não retornou JSON válido");
    const extractedData = JSON.parse(jsonMatch[0]);

    // 6. Update job as complete
    await sb.from("pdf_extract_jobs").update({
      status: "complete",
      result: extractedData,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

  } catch (error) {
    console.error("[extract-pdf bg] Error:", error instanceof Error ? error.message : "unknown");
    await sb.from("pdf_extract_jobs").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Erro desconhecido",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

// ── Main handler ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── GET: Poll job status ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const jobId = url.searchParams.get("job_id");
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: job } = await anonClient
        .from("pdf_extract_jobs")
        .select("status, result, error")
        .eq("id", jobId)
        .single();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "complete") {
        return new Response(JSON.stringify({ success: true, data: job.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (job.status === "failed") {
        return new Response(JSON.stringify({ error: job.error || "Falha na extração" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Still processing
      return new Response(JSON.stringify({ status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: Create job ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Rate limit
    const rateLimited = await checkAiRateLimitRedis(userId, "extract-property-pdf", corsHeaders);
    if (rateLimited) return rateLimited;

    // Get org
    const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await sb.from("profiles").select("organization_id").eq("user_id", userId).single();
    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body — only JSON with storage_url supported now
    const contentType = req.headers.get("content-type") || "";
    let storageUrl: string;
    let fileName: string;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      storageUrl = body.storage_url;
      fileName = body.file_name || "document.pdf";
      if (!storageUrl) throw new Error("storage_url é obrigatório");
      if (!isAllowedUrl(storageUrl)) throw new Error("URL não permitida.");
    } else if (contentType.includes("multipart/form-data")) {
      // For small files sent as FormData, upload to temp storage first
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Nenhum arquivo enviado");
      if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo > 10MB");
      fileName = file.name;

      // Upload to temp storage
      const tempPath = `pdf-extract/${userId}/${Date.now()}_${fileName}`;
      const { error: upErr } = await sb.storage.from("temp-uploads").upload(tempPath, await file.arrayBuffer(), {
        contentType: "application/pdf",
      });
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
      const { data: signedData } = await sb.storage.from("temp-uploads").createSignedUrl(tempPath, 600);
      if (!signedData?.signedUrl) throw new Error("Falha ao gerar URL assinada");
      storageUrl = signedData.signedUrl;
    } else {
      throw new Error("Content-Type não suportado");
    }

    // Create job record
    const { data: job, error: jobErr } = await sb.from("pdf_extract_jobs").insert({
      organization_id: profile.organization_id,
      user_id: userId,
      status: "processing",
      file_name: fileName,
    }).select("id").single();

    if (jobErr || !job) throw new Error("Falha ao criar job");

    // Start background processing (non-blocking)
    EdgeRuntime.waitUntil(
      processInBackground(job.id, storageUrl, fileName, authHeader, userId, profile.organization_id)
    );

    // Return immediately with job ID
    return new Response(JSON.stringify({ job_id: job.id, status: "processing" }), {
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
