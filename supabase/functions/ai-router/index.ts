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
  routing_mode: string; // 'auto' | 'manual'
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
  last_error_at: string | null;
  rate_limit_rpd: number | null;
  rate_limit_rpm: number | null;
}

interface ProviderStats {
  provider_key: string;
  task_type: string | null;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  requests_today: number;
  rate_limit_hits: number;
  quality_score: number | null;
}

interface RouterRequest {
  task_type: string;
  prompt: string;
  system_prompt?: string;
  image_base64?: string;
  image_size?: string; // e.g. "1024x1024", "1024x1536", "1536x1024"
  organization_id?: string;
  user_id?: string;
  max_tokens?: number;
  temperature?: number;
  force_provider?: string;
}

interface ProviderScore {
  provider_key: string;
  score: number;
  breakdown: { cost: number; speed: number; reliability: number; quality: number; penalties: number };
}

// ── Score calculation ──

function calculateProviderScore(
  provider: Provider,
  stats: ProviderStats | null,
): ProviderScore {
  const breakdown = { cost: 0, speed: 0, reliability: 0, quality: 0, penalties: 0 };

  // COST (40% weight)
  breakdown.cost = provider.is_free ? 40 : 8;

  // SPEED (25% weight) — based on avg latency
  const avgLatency = stats?.avg_latency_ms || 2000;
  if (avgLatency < 500) breakdown.speed = 25;
  else if (avgLatency < 1000) breakdown.speed = 20;
  else if (avgLatency < 3000) breakdown.speed = 15;
  else if (avgLatency < 10000) breakdown.speed = 10;
  else breakdown.speed = 5;

  // RELIABILITY (25% weight) — success rate
  const totalReqs = stats?.total_requests || 0;
  const successRate = totalReqs > 10
    ? (stats!.successful_requests / totalReqs)
    : 0.95;
  if (successRate > 0.99) breakdown.reliability = 25;
  else if (successRate > 0.95) breakdown.reliability = 20;
  else if (successRate > 0.90) breakdown.reliability = 15;
  else if (successRate > 0.80) breakdown.reliability = 10;
  else breakdown.reliability = 0;

  // QUALITY (10% weight) — feedback score
  const qualityScore = stats?.quality_score || 3.5;
  if (qualityScore > 4.0) breakdown.quality = 10;
  else if (qualityScore > 3.0) breakdown.quality = 7;
  else breakdown.quality = 3;

  // PENALTIES
  const rpd = provider.rate_limit_rpd || 10000;
  const usedToday = stats?.requests_today || 0;
  if (usedToday >= rpd) {
    return { provider_key: provider.provider_key, score: -1, breakdown };
  }
  if (usedToday > rpd * 0.8) breakdown.penalties -= 15;

  if (provider.consecutive_errors > 0) {
    breakdown.penalties -= Math.min(provider.consecutive_errors * 5, 30);
  }

  // Auto-disable cooldown
  if (provider.consecutive_errors >= 10) {
    const lastError = provider.last_error_at ? new Date(provider.last_error_at) : null;
    const cooldownMs = Math.min(provider.consecutive_errors * 10 * 60 * 1000, 4 * 3600 * 1000);
    if (lastError && (Date.now() - lastError.getTime()) < cooldownMs) {
      return { provider_key: provider.provider_key, score: -1, breakdown };
    }
  }

  const total = Math.max(
    breakdown.cost + breakdown.speed + breakdown.reliability + breakdown.quality + breakdown.penalties,
    0
  );
  return { provider_key: provider.provider_key, score: total, breakdown };
}

// ── Provider call implementations ──

async function callGroq(
  provider: Provider, apiKey: string, prompt: string, systemPrompt: string | null,
  maxTokens: number, temperature: number, _imageBase64?: string, signal?: AbortSignal
) {
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(provider.api_base_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ model: provider.model_id, messages, max_tokens: maxTokens, temperature }),
  });

  if (!res.ok) {
    const body = await res.text();
    const is429 = res.status === 429;
    throw Object.assign(new Error(`Groq ${res.status}: ${body.slice(0, 300)}`), { is429 });
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    tokens_input: data.usage?.prompt_tokens || 0,
    tokens_output: data.usage?.completion_tokens || 0,
  };
}

async function callGemini(
  provider: Provider, apiKey: string, prompt: string, systemPrompt: string | null,
  maxTokens: number, temperature: number, imageBase64?: string, signal?: AbortSignal
) {
  const imageGenModels = ["imagen", "image-generation", "gemini-2.0-flash-exp-image"];
  const isImageGen = provider.supports_image_output && imageGenModels.some(m => provider.model_id.includes(m));
  const url = `${provider.api_base_url}/models/${provider.model_id}:generateContent?key=${apiKey}`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64 && provider.supports_image_input) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: maxTokens, temperature },
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
    const is429 = res.status === 429;
    throw Object.assign(new Error(`Gemini ${res.status}: ${errBody.slice(0, 300)}`), { is429 });
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
  provider: Provider, apiKey: string, prompt: string, systemPrompt: string | null,
  maxTokens: number, temperature: number, imageBase64?: string, signal?: AbortSignal,
  imageSize?: string,
) {
  const isImageModel = provider.supports_image_output && (
    provider.model_id.includes("dall-e") || provider.model_id.includes("gpt-image")
  );

  if (isImageModel) {
    const size = imageSize || "1024x1024";

    // If we have a base image, use the /images/edits endpoint to preserve the original photo
    if (imageBase64) {
      const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const imageBlob = new Blob([imageBytes], { type: "image/png" });

      const formData = new FormData();
      formData.append("image", imageBlob, "photo.png");
      formData.append("prompt", prompt);
      formData.append("model", provider.model_id);
      formData.append("size", size);
      formData.append("response_format", "b64_json");

      console.log(`[ai-router] OpenAI image EDIT (${provider.model_id}, ${size})`);

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(`OpenAI image-edit ${res.status}: ${body.slice(0, 300)}`), { is429: res.status === 429 });
      }
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI image edit: no image data returned");
      return { image_base64: `data:image/png;base64,${b64}`, text: "", tokens_input: 0, tokens_output: 0 };
    }

    // No base image → generate from scratch
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ model: provider.model_id, prompt, n: 1, size, quality: "standard" }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw Object.assign(new Error(`OpenAI DALL-E ${res.status}: ${body.slice(0, 300)}`), { is429: res.status === 429 });
    }
    const data = await res.json();
    return { image_url: data.data?.[0]?.url || "", text: "", tokens_input: 0, tokens_output: 0 };
  }

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  if (imageBase64 && provider.supports_image_input) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const res = await fetch(provider.api_base_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ model: provider.model_id, messages, max_tokens: maxTokens, temperature }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`), { is429: res.status === 429 });
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    tokens_input: data.usage?.prompt_tokens || 0,
    tokens_output: data.usage?.completion_tokens || 0,
  };
}

// ── Cost estimation ──

function estimateCost(providerKey: string, providerType: string, tokensIn: number, tokensOut: number): number {
  if (providerType === "groq") return 0;
  if (providerType === "gemini") return 0;
  if (providerKey === "openai_dalle") return 0.04;
  if (providerKey === "openai_mini") return (tokensIn * 0.15 + tokensOut * 0.6) / 1_000_000;
  return 0;
}

// ── Stats tracking via atomic DB function ──

async function trackStats(
  supabase: any,
  providerKey: string,
  taskType: string,
  latencyMs: number,
  success: boolean,
  is429: boolean,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
) {
  try {
    await supabase.rpc("upsert_ai_router_stats", {
      p_provider_key: providerKey,
      p_task_type: taskType,
      p_latency_ms: Math.round(latencyMs),
      p_success: success,
      p_is_429: is429,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost_usd: costUsd,
    });
  } catch (e) {
    console.warn("[ai-router] stats tracking error:", e);
  }
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
    const { task_type, prompt, image_base64, image_size, force_provider } = body;

    if (!task_type || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "task_type and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for DB reads/writes
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch config, providers, and today's stats in parallel
    const today = new Date().toISOString().slice(0, 10);
    const [configRes, providersRes, statsRes] = await Promise.all([
      supabase
        .from("ai_router_config")
        .select("task_type, display_name, complexity, provider_chain, system_prompt, max_tokens, temperature, is_active, requires_image, routing_mode")
        .eq("task_type", task_type)
        .eq("is_active", true)
        .single(),
      supabase
        .from("ai_router_providers")
        .select("provider_key, provider_type, model_id, env_secret_name, api_base_url, api_key, is_free, is_active, supports_image_input, supports_image_output, consecutive_errors, last_error_at, rate_limit_rpd, rate_limit_rpm"),
      supabase
        .from("ai_router_provider_stats")
        .select("provider_key, task_type, total_requests, successful_requests, failed_requests, avg_latency_ms, requests_today, rate_limit_hits, quality_score")
        .eq("period_date", today),
    ]);

    if (configRes.error || !configRes.data) {
      return new Response(
        JSON.stringify({ success: false, error: `Task '${task_type}' not found or inactive` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configRes.data as TaskConfig;
    const allProviders = (providersRes.data || []) as Provider[];
    const allStats = (statsRes.data || []) as ProviderStats[];

    // Build stats lookup: prefer task-specific, fallback to global (null)
    const statsMap = new Map<string, ProviderStats>();
    for (const s of allStats) {
      if (s.task_type === null) {
        if (!statsMap.has(s.provider_key)) statsMap.set(s.provider_key, s);
      }
    }
    for (const s of allStats) {
      if (s.task_type === task_type) {
        statsMap.set(s.provider_key, s); // override global with task-specific
      }
    }

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

    const routingMode = config.routing_mode || "auto";

    // Determine provider order
    let orderedProviders: { provider: Provider; score: ProviderScore }[];
    let scores: ProviderScore[] = [];

    if (force_provider) {
      // Force specific provider
      const p = providerMap.get(force_provider);
      if (p) {
        orderedProviders = [{ provider: p, score: { provider_key: force_provider, score: 100, breakdown: { cost: 0, speed: 0, reliability: 0, quality: 0, penalties: 0 } } }];
      } else {
        orderedProviders = [];
      }
    } else if (routingMode === "auto") {
      // AUTO-ROUTING: score-based selection
      const eligible = allProviders.filter(p => {
        if (!p.is_active) return false;
        const apiKey = p.api_key || Deno.env.get(p.env_secret_name || '');
        if (!apiKey) return false;
        if (config.requires_image && !p.supports_image_input) return false;
        if (config.complexity === "image" && !p.supports_image_output) return false;
        return true;
      });

      console.log(`[ai-router] Auto-routing for '${task_type}': ${allProviders.length} total, ${eligible.length} eligible`);

      scores = eligible.map(p => calculateProviderScore(p, statsMap.get(p.provider_key) || null));
      scores = scores.filter(s => s.score >= 0).sort((a, b) => b.score - a.score);

      console.log(`[ai-router] Scores:`, scores.map(s => `${s.provider_key}=${s.score}`).join(', '));

      orderedProviders = scores.map(s => ({
        provider: providerMap.get(s.provider_key)!,
        score: s,
      }));
    } else {
      // MANUAL: use provider_chain
      const chain = Array.isArray(config.provider_chain)
        ? config.provider_chain
        : JSON.parse(config.provider_chain as unknown as string);
      orderedProviders = chain
        .map((key: string) => {
          const p = providerMap.get(key);
          return p ? { provider: p, score: { provider_key: key, score: 0, breakdown: { cost: 0, speed: 0, reliability: 0, quality: 0, penalties: 0 } } } : null;
        })
        .filter(Boolean) as any[];
    }

    const providersAttempted: string[] = [];
    let lastError = "";

    for (const { provider, score } of orderedProviders) {
      if (!provider.is_active && !force_provider) continue;
      if (provider.consecutive_errors > 10 && !force_provider) {
        // Check cooldown
        const lastErr = provider.last_error_at ? new Date(provider.last_error_at) : null;
        const cooldownMs = Math.min(provider.consecutive_errors * 10 * 60 * 1000, 4 * 3600 * 1000);
        if (lastErr && (Date.now() - lastErr.getTime()) < cooldownMs) continue;
      }

      const apiKey = provider.api_key || Deno.env.get(provider.env_secret_name || '');
      if (!apiKey) {
        console.warn(`[ai-router] No API key for ${provider.provider_key}`);
        continue;
      }

      providersAttempted.push(provider.provider_key);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        let result: { text?: string; image_url?: string; image_base64?: string; tokens_input: number; tokens_output: number };
        const callArgs = [provider, apiKey, prompt, systemPrompt, maxTokens, temperature, image_base64, controller.signal, image_size] as const;

        switch (provider.provider_type) {
          case "groq": result = await callGroq(...callArgs); break;
          case "gemini": result = await callGemini(...callArgs); break;
          case "openai": result = await callOpenAI(...callArgs); break;
          default:
            lastError = `Unknown provider_type: ${provider.provider_type}`;
            continue;
        }

        clearTimeout(timeout);
        const latencyMs = Date.now() - startMs;
        const costUsd = estimateCost(provider.provider_key, provider.provider_type, result.tokens_input, result.tokens_output);

        // Reset consecutive errors on success
        const wasInCooldown = provider.consecutive_errors >= 10;
        supabase.from("ai_router_providers").update({ consecutive_errors: 0, last_error_at: null }).eq("provider_key", provider.provider_key).then(() => {});

        // Track stats (fire and forget)
        trackStats(supabase, provider.provider_key, task_type, latencyMs, true, false, result.tokens_input, result.tokens_output, costUsd);

        // Log success
        const logNote = wasInCooldown ? "auto-healed after cooldown" : null;
        supabase.from("ai_router_logs").insert({
          organization_id: orgId, user_id: userId, task_type,
          prompt_preview: prompt.slice(0, 200),
          providers_attempted: providersAttempted,
          provider_used: provider.provider_key,
          model_used: provider.model_id,
          tokens_input: result.tokens_input, tokens_output: result.tokens_output,
          latency_ms: latencyMs, is_free: provider.is_free,
          estimated_cost_usd: costUsd, success: true,
          error_message: logNote,
        }).then(() => {});

        const response = {
          success: true,
          text: result.text || undefined,
          image_url: result.image_url || undefined,
          image_base64: result.image_base64 || undefined,
          provider: provider.provider_key,
          model: provider.model_id,
          tokens_input: result.tokens_input,
          tokens_output: result.tokens_output,
          latency_ms: latencyMs,
          is_free: provider.is_free,
          estimated_cost_usd: costUsd,
          _routing: {
            mode: routingMode,
            scores: scores.slice(0, 10).map(s => ({
              provider: s.provider_key,
              score: s.score,
              breakdown: s.breakdown,
            })),
            selected: provider.provider_key,
            attempts: providersAttempted.length,
            fallback: providersAttempted.length > 1,
          },
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        clearTimeout(timeout);
        const errMsg = err?.message || String(err);
        const is429 = err?.is429 === true;
        lastError = `${provider.provider_key}: ${errMsg.slice(0, 200)}`;
        console.error(`[ai-router] ${lastError}`);

        const latencyMs = Date.now() - startMs;
        const costUsd = 0;

        // Increment consecutive errors
        supabase.from("ai_router_providers").update({
          consecutive_errors: (provider.consecutive_errors || 0) + 1,
          last_error_at: new Date().toISOString(),
        }).eq("provider_key", provider.provider_key).then(() => {});

        // Track stats for failure
        trackStats(supabase, provider.provider_key, task_type, latencyMs, false, is429, 0, 0, costUsd);
      }
    }

    // All providers failed
    const latencyMs = Date.now() - startMs;
    supabase.from("ai_router_logs").insert({
      organization_id: orgId, user_id: userId, task_type,
      prompt_preview: prompt.slice(0, 200),
      providers_attempted: providersAttempted,
      provider_used: null, model_used: null,
      tokens_input: 0, tokens_output: 0,
      latency_ms: latencyMs, is_free: true,
      estimated_cost_usd: 0, success: false,
      error_message: lastError.slice(0, 500),
    }).then(() => {});

    // Use 200 when force_provider so the SDK can parse the error message
    const statusCode = force_provider ? 200 : 502;
    return new Response(
      JSON.stringify({
        success: false, error: force_provider
          ? `Provider "${force_provider}" falhou: ${lastError || "sem resposta"}`
          : "Todos os providers falharam",
        tokens_input: 0, tokens_output: 0, latency_ms: latencyMs, is_free: true, estimated_cost_usd: 0,
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[ai-router] fatal:", e);
    return new Response(
      JSON.stringify({
        success: false, error: e?.message || "Internal error",
        tokens_input: 0, tokens_output: 0, latency_ms: Date.now() - startMs, is_free: true, estimated_cost_usd: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
