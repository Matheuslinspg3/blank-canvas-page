import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseHost = (() => {
  try {
    return new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname;
  } catch {
    return "";
  }
})();

const ALLOWED_HOSTS = [supabaseHost, "res.cloudinary.com"].filter(Boolean);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

const EXTRACT_PROMPT = `Você é um extrator de dados de imóveis. Analise o PDF/tabela de imóveis em anexo e retorne APENAS um JSON válido (sem markdown, sem comentários) no formato:
{
  "properties": [
    {
      "title": "string",
      "type": "Apartamento|Casa|Terreno|Comercial|Rural|Cobertura",
      "purpose": "venda|aluguel",
      "price": number,
      "address": "string",
      "neighborhood": "string",
      "city": "string",
      "state": "string (UF)",
      "bedrooms": number,
      "bathrooms": number,
      "parking_spaces": number,
      "area_total": number,
      "area_built": number,
      "description": "string",
      "code": "string (código do imóvel)"
    }
  ]
}
Se algum campo não estiver disponível, omita-o. Extraia TODOS os imóveis listados. Valores em BRL como números (sem R$, sem pontos de milhar).`;

async function processInBackground(jobId: string, signedUrl: string, fileName: string, authHeader: string, sb: any, supabaseUrl: string) {
  try {
    // Baixa o PDF
    const pdfResp = await fetch(signedUrl);
    if (!pdfResp.ok) throw new Error(`Falha ao baixar PDF: ${pdfResp.status}`);
    const pdfBuffer = await pdfResp.arrayBuffer();

    // Converte para base64 em chunks (evita stack overflow)
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    console.log(`[extract-pdf] Job ${jobId}: PDF baixado (${(pdfBuffer.byteLength / 1024).toFixed(1)} KB), chamando ai-router...`);

    // Chama ai-router com task_type pdf_extract
    const routerResp = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "pdf_extract",
        prompt: EXTRACT_PROMPT,
        image_base64: pdfBase64,
        file_mime_type: "application/pdf",
      }),
    });

    const routerResult = await routerResp.json();
    console.log(`[extract-pdf] Job ${jobId}: ai-router respondeu success=${routerResult?.success} provider=${routerResult?.provider}`);

    if (!routerResult?.success) {
      throw new Error(routerResult?.error || "AI Router falhou");
    }

    const text = routerResult.text || "";
    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { properties: [] };
    } catch {
      throw new Error("Resposta da IA não é JSON válido");
    }

    if (!Array.isArray(parsed.properties)) {
      parsed.properties = [];
    }

    await sb.from("pdf_extract_jobs").update({
      status: "complete",
      result: parsed,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`[extract-pdf] Job ${jobId}: completo, ${parsed.properties.length} imóveis extraídos via ${routerResult.provider}`);
  } catch (err) {
    console.error(`[extract-pdf] Job ${jobId} falhou:`, err);
    await sb.from("pdf_extract_jobs").update({
      status: "failed",
      error: err instanceof Error ? err.message : "Erro desconhecido",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const jobId = url.searchParams.get("job_id");
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "complete") {
        return new Response(JSON.stringify({ success: true, status: "complete", data: job.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "failed") {
        return new Response(JSON.stringify({
          success: false,
          status: "failed",
          error: job.error || "Falha na extração",
          fallback: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await sb
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Nenhum arquivo enviado");
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo > 50MB");

      fileName = file.name;
      const tempPath = `pdf-extract/${userId}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await sb.storage
        .from("temp-uploads")
        .upload(tempPath, await file.arrayBuffer(), { contentType: "application/pdf" });

      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

      const { data: signedData } = await sb.storage.from("temp-uploads").createSignedUrl(tempPath, 3600);
      if (!signedData?.signedUrl) throw new Error("Falha ao gerar URL assinada");

      storageUrl = signedData.signedUrl;
    } else {
      throw new Error("Content-Type não suportado");
    }

    const { data: job, error: jobError } = await sb
      .from("pdf_extract_jobs")
      .insert({
        organization_id: profile.organization_id,
        user_id: userId,
        status: "processing",
        file_name: fileName,
      })
      .select("id")
      .single();

    if (jobError || !job) throw new Error("Falha ao criar job");

    // Processa em background via AI Router (Gemini → Claude fallback)
    EdgeRuntime.waitUntil(
      processInBackground(job.id, storageUrl, fileName, authHeader, sb, supabaseUrl),
    );

    return new Response(JSON.stringify({ job_id: job.id, status: "processing" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-pdf] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
