import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known free models per provider
const GROQ_FREE = true; // All Groq models are free
const GEMINI_FREE_PATTERNS = ["flash", "gemma", "learnlm"];
const OPENAI_FREE = false; // All OpenAI models are paid

interface DiscoveredModel {
  id: string;
  name: string;
  is_free: boolean;
  supports_image_input: boolean;
  supports_image_output: boolean;
  context_window?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { provider_type, api_key } = await req.json();
    if (!provider_type || !api_key) throw new Error("provider_type and api_key are required");

    let models: DiscoveredModel[] = [];

    switch (provider_type) {
      case "groq": {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${api_key}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        models = (data.data || [])
          .filter((m: any) => m.active !== false)
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            is_free: GROQ_FREE,
            supports_image_input: m.id.includes("vision") || m.id.includes("llava"),
            supports_image_output: false,
            context_window: m.context_window || null,
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        break;
      }

      case "gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        models = (data.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => {
            const id = m.name?.replace("models/", "") || m.name;
            const isFree = GEMINI_FREE_PATTERNS.some(p => id.toLowerCase().includes(p));
            return {
              id,
              name: m.displayName || id,
              is_free: isFree,
              supports_image_input: m.supportedGenerationMethods?.includes("generateContent") &&
                (id.includes("pro") || id.includes("flash") || id.includes("gemini")),
              supports_image_output: id.includes("imagen") || (id.includes("flash") && id.includes("2.0")),
              context_window: m.inputTokenLimit || null,
            };
          })
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        break;
      }

      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${api_key}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        models = (data.data || [])
          .filter((m: any) => m.id.startsWith("gpt-") || m.id.startsWith("o") || m.id.startsWith("dall-e") || m.id.startsWith("chatgpt"))
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            is_free: OPENAI_FREE,
            supports_image_input: m.id.includes("gpt-4") || m.id.includes("o1") || m.id.includes("o3") || m.id.includes("o4"),
            supports_image_output: m.id.includes("dall-e"),
            context_window: null,
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        break;
      }

      default:
        throw new Error(`Unknown provider_type: ${provider_type}`);
    }

    return new Response(
      JSON.stringify({ ok: true, models, count: models.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message || "Failed to list models" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
