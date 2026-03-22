import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimit } from "../_shared/ai-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitResp = await checkAiRateLimit(user.id, "validate-document", corsHeaders);
    if (rateLimitResp) return rateLimitResp;

    const { document_id, storage_path, expected_type } = await req.json();
    if (!document_id || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: signedData, error: signedError } = await supabase.storage
      .from("lead-documents")
      .createSignedUrl(storage_path, 300);

    if (signedError || !signedData?.signedUrl) {
      throw new Error("Failed to get signed URL");
    }

    const isImage = storage_path.match(/\.(jpg|jpeg|png)$/i);
    let aiResult: any;

    if (isImage) {
      // Fetch image and convert to base64
      const imgResp = await fetch(signedData.signedUrl);
      if (!imgResp.ok) throw new Error("Failed to fetch image");
      const imgBuffer = await imgResp.arrayBuffer();
      const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));

      const promptText = `Analise este documento e identifique o tipo. É esperado ser um documento pessoal ou imobiliário.${expected_type ? ` Tipo esperado: ${expected_type}.` : ""} Responda APENAS com JSON: { detected_type: string, confidence: number 0-1, valid: boolean, observation: string }. Em português.`;

      // Call ai-router
      const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_type: "validate_document",
          prompt: promptText,
          image_base64: imgBase64,
          user_id: user.id,
        }),
      });

      const routerResult = await routerResponse.json();
      if (!routerResult.success) {
        aiResult = { valid: false, detected_type: "desconhecido", confidence: 0, observation: "Não foi possível validar automaticamente" };
      } else {
        const content = routerResult.text || "";
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          aiResult = jsonMatch
            ? JSON.parse(jsonMatch[0])
            : { valid: false, detected_type: "desconhecido", confidence: 0, observation: content.slice(0, 200) };
        } catch {
          aiResult = { valid: false, detected_type: "desconhecido", confidence: 0, observation: content.slice(0, 200) };
        }
      }
    } else {
      aiResult = { valid: true, detected_type: "PDF", confidence: 0.5, observation: "Documento PDF — verificação manual recomendada" };
    }

    await supabase.from("lead_documents").update({ ai_validation: aiResult }).eq("id", document_id);

    return new Response(JSON.stringify(aiResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
