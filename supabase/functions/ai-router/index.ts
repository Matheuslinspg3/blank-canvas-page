import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TaskConfig {
  task_type: string;
  display_name: string;
  complexity: string;
  provider_chain: string[];
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  requires_image: boolean;
}

interface Provider {
  provider_key: string;
  provider_type: string;
  model_id: string;
  env_secret_name: string;
  api_base_url: string;
  api_key: string | null;
  is_free: boolean;
  is_active: boolean;
  supports_image_input: boolean;
  supports_image_output: boolean;
  consecutive_errors: number;
}

interface RouterRequest {
  task_type: string;
  prompt: string;
  system_prompt?: string;
  image_base64?: string;
  organization_id?: string;
  user_id?: string;
  max_tokens?: number;
  temperature?: number;
  force_provider?: string;
}

interface RouterResponse {
  success: boolean;
  text?: string;
  image_url?: string;
  image_base64?: string;
  provider?: string;
  model?: string;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number;
  is_free: boolean;
  estimated_cost_usd: number;
  error?: string;
}

// ── Provider call implementations ──

async function callGroq(
  provider: Provider,
  apiKey: string,
  prompt: string,
  systemPrompt: string | null,
  maxTokens: number,
  temperature: number,
  _imageBase64?: string,
  signal?: AbortSignal
) {
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(provider.api_base_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: provider.model_id,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    tokens_input: data.usage?.prompt_tokens || 0,
    tokens_output: data.usage?.completion_tokens || 0,
  };
}

async function callGemini(
  provider: Provider,
  apiKey: string,
  prompt: string,
  systemPrompt: string | null,
  maxTokens: number,
  temperature: number,
  imageBase64?: string,
  signal?: AbortSignal
) {
  const isImageGen = provider.supports_image_output;
  const url = `${provider.api_base_url}/models/${provider.model_id}:generateContent?key=${apiKey}`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64 && provider.supports_image_input) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: imageBase64 },
    });
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  };

  if (systemPrompt && !isImageGen) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  if (isImageGen) {
    body.generationConfig.responseModalities = ["TEXT", "IMAGE"];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidateParts = data.candidates?.[0]?.content?.parts || [];

  const textPart = candidateParts.find((p: any) => p.text);
  const imagePart = candidateParts.find((p: any) => p.inlineData);

  return {
    text: textPart?.text || "",
    image_base64: imagePart?.inlineData
      ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
      : undefined,
    tokens_input: data.usageMetadata?.promptTokenCount || 0,
    tokens_output: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

async function callOpenAI(
  provider: Provider,
  apiKey: string,
  prompt: string,
  systemPrompt: string | null,
  maxTokens: number,
  temperature: number,
  imageBase64?: string,
  signal?: AbortSignal
) {
  // DALL-E image generation
  if (provider.provider_key === "openai_dalle") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI DALL-E ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    return {
      image_url: data.data?.[0]?.url || "",
      text: "",
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  // Text / vision completion
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  if (imageBase64 && provider.supports_image_input) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const res = await fetch(provider.api_base_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: provider.model_id,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    tokens_input: data.usage?.prompt_tokens || 0,
    tokens_output: data.usage?.completion_tokens || 0,
  };
}

// ── Cost estimation ──

function estimateCost(
  providerKey: string,
  providerType: string,
  tokensIn: number,
  tokensOut: number
): number {
  if (providerType === "groq") return 0;
  if (providerType === "gemini") return 0;
  if (providerKey === "openai_dalle") return 0.04;
  if (providerKey === "openai_mini") {
    return (tokensIn * 0.15 + tokensOut * 0.6) / 1_000_000;
  }
  return 0;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authUserId = claims.claims.sub as string;

    // Parse body
    const body: RouterRequest = await req.json();
    const { task_type, prompt, image_base64, force_provider } = body;

    if (!task_type || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "task_type and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for DB reads/writes
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch config and providers in parallel (cache for this request)
    const [configRes, providersRes] = await Promise.all([
      supabase
        .from("ai_router_config")
        .select("task_type, display_name, complexity, provider_chain, system_prompt, max_tokens, temperature, is_active, requires_image")
        .eq("task_type", task_type)
        .eq("is_active", true)
        .single(),
      supabase
        .from("ai_router_providers")
        .select("provider_key, provider_type, model_id, env_secret_name, api_base_url, api_key, is_free, is_active, supports_image_input, supports_image_output, consecutive_errors"),
    ]);

    if (configRes.error || !configRes.data) {
      return new Response(
        JSON.stringify({ success: false, error: `Task '${task_type}' not found or inactive` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configRes.data as TaskConfig;
    const allProviders = (providersRes.data || []) as Provider[];

    // Build provider lookup map
    const providerMap = new Map<string, Provider>();
    for (const p of allProviders) {
      providerMap.set(p.provider_key, p);
    }

    // Resolve overrides
    const systemPrompt = body.system_prompt ?? config.system_prompt;
    const maxTokens = body.max_tokens ?? config.max_tokens;
    const temperature = body.temperature ?? config.temperature;
    const orgId = body.organization_id || null;
    const userId = body.user_id || authUserId;

    // Provider chain — respect force_provider if set
    let chain: string[];
    if (force_provider) {
      chain = [force_provider];
    } else {
      chain = Array.isArray(config.provider_chain)
        ? config.provider_chain
        : JSON.parse(config.provider_chain as unknown as string);
    }

    const providersAttempted: string[] = [];
    let lastError = "";

    for (const providerKey of chain) {
      const provider = providerMap.get(providerKey);
      if (!provider) continue;
      if (!provider.is_active) continue;
      if (provider.consecutive_errors > 10) continue;

      // Check API key: prefer api_key from DB, fallback to env secret
      const apiKey = provider.api_key || Deno.env.get(provider.env_secret_name || '');
      if (!apiKey) {
        console.warn(`[ai-router] No API key for ${providerKey} (db or env:${provider.env_secret_name})`);
        continue;
      }

      providersAttempted.push(providerKey);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        let result: {
          text?: string;
          image_url?: string;
          image_base64?: string;
          tokens_input: number;
          tokens_output: number;
        };

        const callArgs = [
          provider,
          apiKey,
          prompt,
          systemPrompt,
          maxTokens,
          temperature,
          image_base64,
          controller.signal,
        ] as const;

        switch (provider.provider_type) {
          case "groq":
            result = await callGroq(...callArgs);
            break;
          case "gemini":
            result = await callGemini(...callArgs);
            break;
          case "openai":
            result = await callOpenAI(...callArgs);
            break;
          default:
            lastError = `Unknown provider_type: ${provider.provider_type}`;
            continue;
        }

        clearTimeout(timeout);

        const latencyMs = Date.now() - startMs;
        const costUsd = estimateCost(
          providerKey,
          provider.provider_type,
          result.tokens_input,
          result.tokens_output
        );

        // Reset consecutive errors on success
        supabase
          .from("ai_router_providers")
          .update({ consecutive_errors: 0, last_error_at: null })
          .eq("provider_key", providerKey)
          .then(() => {});

        // Log success (fire and forget)
        supabase
          .from("ai_router_logs")
          .insert({
            organization_id: orgId,
            user_id: userId,
            task_type,
            prompt_preview: prompt.slice(0, 200),
            providers_attempted: providersAttempted,
            provider_used: providerKey,
            model_used: provider.model_id,
            tokens_input: result.tokens_input,
            tokens_output: result.tokens_output,
            latency_ms: latencyMs,
            is_free: provider.is_free,
            estimated_cost_usd: costUsd,
            success: true,
          })
          .then(() => {});

        const response: RouterResponse = {
          success: true,
          text: result.text || undefined,
          image_url: result.image_url || undefined,
          image_base64: result.image_base64 || undefined,
          provider: providerKey,
          model: provider.model_id,
          tokens_input: result.tokens_input,
          tokens_output: result.tokens_output,
          latency_ms: latencyMs,
          is_free: provider.is_free,
          estimated_cost_usd: costUsd,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        clearTimeout(timeout);
        const errMsg = err?.message || String(err);
        lastError = `${providerKey}: ${errMsg.slice(0, 200)}`;
        console.error(`[ai-router] ${lastError}`);

        // Increment consecutive errors (fire and forget)
        supabase.rpc("increment_provider_errors", { p_key: providerKey }).then(() => {});
        // Fallback: direct update if RPC doesn't exist
        supabase
          .from("ai_router_providers")
          .update({
            consecutive_errors: (provider.consecutive_errors || 0) + 1,
            last_error_at: new Date().toISOString(),
          })
          .eq("provider_key", providerKey)
          .then(() => {});
      }
    }

    // All providers failed
    const latencyMs = Date.now() - startMs;

    // Log failure
    supabase
      .from("ai_router_logs")
      .insert({
        organization_id: orgId,
        user_id: userId,
        task_type,
        prompt_preview: prompt.slice(0, 200),
        providers_attempted: providersAttempted,
        provider_used: null,
        model_used: null,
        tokens_input: 0,
        tokens_output: 0,
        latency_ms: latencyMs,
        is_free: true,
        estimated_cost_usd: 0,
        success: false,
        error_message: lastError.slice(0, 500),
      })
      .then(() => {});

    return new Response(
      JSON.stringify({
        success: false,
        error: "Todos os providers falharam",
        tokens_input: 0,
        tokens_output: 0,
        latency_ms: latencyMs,
        is_free: true,
        estimated_cost_usd: 0,
      } as RouterResponse),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[ai-router] fatal:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e?.message || "Internal error",
        tokens_input: 0,
        tokens_output: 0,
        latency_ms: Date.now() - startMs,
        is_free: true,
        estimated_cost_usd: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
