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
    ) {
      return false;
    }

    return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function getWebhookFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return `Webhook n8n falhou: ${status}. Verifique a autenticação do webhook no n8n.`;
  }

  if (status === 404) {
    return `Webhook n8n falhou: ${status}. Verifique a URL configurada e se o workflow está ativo.`;
  }

  return `Webhook n8n falhou: ${status}`;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

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

    const n8nWebhookUrl = Deno.env.get("N8N_PDF_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      await sb.from("pdf_extract_jobs").update({
        status: "failed",
        error: "N8N_PDF_WEBHOOK_URL não configurado",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      throw new Error("Webhook de processamento não configurado");
    }

    const webhookSecret = Deno.env.get("WHATSAPP_AGENT_SECRET") || "";
    const webhookToken = Deno.env.get("N8N_PDF_WEBHOOK_TOKEN") || webhookSecret;

    EdgeRuntime.waitUntil(
      fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
          ...(webhookToken ? { token: webhookToken } : {}),
        },
        body: JSON.stringify({
          job_id: job.id,
          signed_url: storageUrl,
          file_name: fileName,
          org_id: profile.organization_id,
          user_id: userId,
          timestamp: new Date().toISOString(),
          supabase_url: supabaseUrl,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error(`[extract-pdf] n8n webhook failed: ${res.status} ${text}`);

            await sb.from("pdf_extract_jobs").update({
              status: "failed",
              error: getWebhookFailureMessage(res.status),
              updated_at: new Date().toISOString(),
            }).eq("id", job.id);
          }
        })
        .catch(async (err) => {
          console.error("[extract-pdf] n8n webhook error:", err);
          await sb.from("pdf_extract_jobs").update({
            status: "failed",
            error: `Erro ao contactar n8n: ${err.message}`,
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);
        }),
    );

    return new Response(JSON.stringify({ job_id: job.id, status: "processing" }), {
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