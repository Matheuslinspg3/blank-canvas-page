import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const rateLimited = await checkAiRateLimitRedis(user.id, "analyze-photo-quality", corsHeaders);
    if (rateLimited) return rateLimited;

    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch image and convert to base64
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error("Failed to fetch image");
    const imgBuffer = await imgResp.arrayBuffer();
    const bytes = new Uint8Array(imgBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, bytes.length);
      for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j]);
    }
    const imgBase64 = btoa(binary);

    const promptText = 'Analise a qualidade desta foto para uso em arte de anúncio imobiliário. Responda APENAS com JSON: { "quality": "good" ou "low", "reason": "motivo curto em PT-BR" }. Critérios: resolução, iluminação, enquadramento, nitidez.';

    // Call ai-router
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "analyze_photo",
        prompt: promptText,
        image_base64: imgBase64,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    if (!aiResult.success) {
      return new Response(JSON.stringify({ quality: "unknown", message: "Análise indisponível" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = aiResult.text || "";
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({
          quality: parsed.quality || "unknown",
          message: parsed.reason || "Análise concluída",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* fallback below */ }

    return new Response(JSON.stringify({ quality: "unknown", message: "Análise inconclusiva" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-photo-quality error:", error);
    return new Response(JSON.stringify({ quality: "unknown", message: "Análise indisponível" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
