import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";

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

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  source: "primary" | "secondary";
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
  file_mime_type?: string; // e.g. "application/pdf" — overrides default "image/jpeg"
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

function getCloudinaryConfigs(): CloudinaryConfig[] {
  const configs: CloudinaryConfig[] = [];

  const primaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const primaryApiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const primaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (primaryCloudName && primaryApiKey && primaryApiSecret) {
    configs.push({
      cloudName: primaryCloudName,
      apiKey: primaryApiKey,
      apiSecret: primaryApiSecret,
      source: "primary",
    });
  }

  const secondaryCloudName = Deno.env.get("CLOUDINARY2_CLOUD_NAME");
  const secondaryApiKey = Deno.env.get("CLOUDINARY2_API_KEY");
  const secondaryApiSecret = Deno.env.get("CLOUDINARY2_API_SECRET");
  if (secondaryCloudName && secondaryApiKey && secondaryApiSecret) {
    configs.push({
      cloudName: secondaryCloudName,
      apiKey: secondaryApiKey,
      apiSecret: secondaryApiSecret,
      source: "secondary",
    });
  }

  return configs;
}

function ensureCloudinaryPngUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("res.cloudinary.com")) return url;
    parsed.pathname = parsed.pathname.replace("/upload/", "/upload/f_png/fl_png32/");
    return parsed.toString();
  } catch {
    return url;
  }
}

async function uploadDataUrlToCloudinary(dataUrl: string, folder: string, publicId: string): Promise<string | null> {
  const configs = getCloudinaryConfigs();
  if (configs.length === 0) return null;

  for (const cfg of configs) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;

      const encoder = new TextEncoder();
      const data = encoder.encode(paramsToSign + cfg.apiSecret);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const formData = new FormData();
      formData.append("file", dataUrl);
      formData.append("folder", folder);
      formData.append("public_id", publicId);
      formData.append("timestamp", timestamp);
      formData.append("api_key", cfg.apiKey);
      formData.append("signature", signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[ai-router] Cloudinary upload failed (${cfg.source}): ${errText.slice(0, 300)}`);
        continue;
      }

      const result = await res.json();
      return result.secure_url || null;
    } catch (e) {
      console.error(`[ai-router] Cloudinary upload exception (${cfg.source}):`, e);
    }
  }

  return null;
}

async function convertSourceImageToPng(imageBase64: string, mimeType: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
  const folder = "habitae/ai-router/source-conversions";
  const publicId = `src_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const uploadedUrl = await uploadDataUrlToCloudinary(dataUrl, folder, publicId);
  if (!uploadedUrl) return null;

  const pngUrl = ensureCloudinaryPngUrl(uploadedUrl);
  const res = await fetch(pngUrl);
  if (!res.ok) {
    console.error(`[ai-router] Cloudinary PNG fetch failed: ${res.status}`);
    return null;
  }

  const convertedBytes: Uint8Array<ArrayBuffer> = new Uint8Array(await res.arrayBuffer());
  const isPng = convertedBytes.length >= 4
    && convertedBytes[0] === 0x89
    && convertedBytes[1] === 0x50
    && convertedBytes[2] === 0x4E
    && convertedBytes[3] === 0x47;

  return isPng ? convertedBytes : null;
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
  if (provider.consecutive_errors > 10) {
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
  maxTokens: number, temperature: number, _imageBase64?: string, signal?: AbortSignal, _imageSize?: string,
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
  maxTokens: number, temperature: number, imageBase64?: string, signal?: AbortSignal, _imageSize?: string,
  fileMimeType?: string,
) {
  const imageGenModels = ["imagen", "image-generation", "gemini-2.0-flash-exp-image"];
  const isImageGen = provider.supports_image_output && imageGenModels.some(m => provider.model_id.includes(m));
  const url = `${provider.api_base_url}/models/${provider.model_id}:generateContent?key=${apiKey}`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64 && provider.supports_image_input) {
    const mimeType = fileMimeType || "image/jpeg";
    parts.push({ inlineData: { mimeType, data: imageBase64 } });
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

async function callAnthropic(
  provider: Provider, apiKey: string, prompt: string, systemPrompt: string | null,
  maxTokens: number, temperature: number, imageBase64?: string, signal?: AbortSignal, _imageSize?: string,
  fileMimeType?: string,
) {
  const content: any[] = [];

  if (imageBase64 && provider.supports_image_input) {
    if (fileMimeType === "application/pdf") {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: imageBase64,
        },
      });
    } else {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: fileMimeType || "image/jpeg",
          data: imageBase64,
        },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const res = await fetch(`${provider.api_base_url}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: provider.model_id,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || undefined,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    const is429 = res.status === 429;
    throw Object.assign(new Error(`Anthropic ${res.status}: ${errBody.slice(0, 300)}`), { is429 });
  }

  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("\n")
    : "";

  return {
    text,
    tokens_input: data.usage?.input_tokens || 0,
    tokens_output: data.usage?.output_tokens || 0,
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
    const requestedSize = imageSize || "1024x1024";

    // If we have a base image, use the /images/edits endpoint to preserve the original photo
    if (imageBase64) {
      let imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

      // Detect mime type from magic bytes
      let isPng = imageBytes.length >= 4 && imageBytes[0] === 0x89 && imageBytes[1] === 0x50;
      const isJpeg = imageBytes.length >= 2 && imageBytes[0] === 0xFF && imageBytes[1] === 0xD8;
      const isWebp = imageBytes.length >= 12 && imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50;

      let mimeType = isPng ? "image/png" : isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "application/octet-stream";
      let fileExt = isPng ? "png" : isJpeg ? "jpeg" : isWebp ? "webp" : "bin";

      // OpenAI image edits in this account require PNG input; convert non-PNG via Cloudinary.
      if (!isPng && (isJpeg || isWebp)) {
        const converted = await convertSourceImageToPng(imageBase64, mimeType);
        if (converted) {
          imageBytes = converted;
          isPng = true;
          mimeType = "image/png";
          fileExt = "png";
          console.log(`[ai-router] Source image converted to PNG via Cloudinary (${isWebp ? "webp" : "jpeg"} -> png)`);
        }
      }

      if (!isPng) {
        throw new Error("Source image must be PNG. Conversion to PNG failed.");
      }

      if (imageBytes.length > 25 * 1024 * 1024) {
        throw new Error(`Source image exceeds 25MB limit (${imageBytes.length} bytes)`);
      }

      const imageBlob = new Blob([imageBytes], { type: mimeType });

      // Model strategy: try higher-quality edit model first, fallback to dall-e-2 for compatibility.
      const modelCandidates = Array.from(new Set(
        provider.model_id === "dall-e-2"
          ? ["gpt-image-1", "dall-e-2"]
          : [provider.model_id, "gpt-image-1", "dall-e-2"]
      ));

      // dall-e-2 only supports 256x256, 512x512, 1024x1024
      const normalizeSizeForDalle2 = (s: string) => {
        const valid = ["256x256", "512x512", "1024x1024"];
        return valid.includes(s) ? s : "1024x1024";
      };

      const normalizeSizeForModel = (model: string, size: string) => {
        if (model === "dall-e-2") return normalizeSizeForDalle2(size);
        return size;
      };

      const promptForModel = (model: string) => {
        const limit = model === "dall-e-2" ? 980 : 3500;
        const p = prompt.length > limit ? `${prompt.slice(0, Math.max(limit - 3, 1))}...` : prompt;
        if (p.length !== prompt.length) {
          console.warn(`[ai-router] ${provider.provider_key}: prompt truncated for image edit (${prompt.length}→${p.length}) [${model}]`);
        }
        return p;
      };

      const attemptEdit = async (model: string, size: string, editPrompt: string): Promise<any> => {
        const isGptImage = model.startsWith("gpt-image");
        const formData = new FormData();
        
        if (isGptImage) {
          // gpt-image-1 uses image[] array format and supports more sizes
          formData.append("image[]", imageBlob, `photo.png`);
          formData.append("prompt", editPrompt);
          formData.append("model", model);
          formData.append("size", size);
          formData.append("quality", "low");
        } else {
          // dall-e-2 uses image (single) format
          formData.append("image", imageBlob, `photo.${fileExt}`);
          formData.append("prompt", editPrompt);
          formData.append("model", model);
          formData.append("size", size);
          formData.append("response_format", "b64_json");
        }

        console.log(`[ai-router] OpenAI image EDIT (requested=${provider.model_id}, effective=${model}, size=${requestedSize}→${size}, prompt=${prompt.length}→${editPrompt.length})`);

        const res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal,
          body: formData,
        });
        if (!res.ok) {
          const body = await res.text();
          console.error(`[ai-router] OpenAI image-edit ${model} error ${res.status}: ${body.slice(0, 500)}`);
          const err = Object.assign(new Error(`OpenAI image-edit ${res.status}: ${body.slice(0, 300)}`), {
            is429: res.status === 429,
            isRetryableModelError: res.status === 400 || res.status === 404,
          });
          throw err;
        }
        const data = await res.json();
        
        if (isGptImage) {
          // gpt-image-1 returns b64_json by default
          const b64 = data.data?.[0]?.b64_json;
          const url = data.data?.[0]?.url;
          if (b64) {
            return { image_base64: `data:image/png;base64,${b64}`, text: "", tokens_input: 0, tokens_output: 0 };
          }
          if (url) {
            return { image_url: url, text: "", tokens_input: 0, tokens_output: 0 };
          }
          throw new Error("OpenAI gpt-image-1 edit: no image data returned");
        }
        
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error("OpenAI image edit: no image data returned");
        return { image_base64: `data:image/png;base64,${b64}`, text: "", tokens_input: 0, tokens_output: 0 };
      };

      let lastAttemptError: any = null;
      for (const modelCandidate of modelCandidates) {
        try {
          const candidateSize = normalizeSizeForModel(modelCandidate, requestedSize);
          const editPrompt = promptForModel(modelCandidate);
          return await attemptEdit(modelCandidate, candidateSize, editPrompt);
        } catch (err: any) {
          lastAttemptError = err;
          if (err?.is429) throw err;
          if (err?.isRetryableModelError && modelCandidate !== "dall-e-2") {
            console.warn(`[ai-router] ${provider.provider_key}: ${modelCandidate} rejected for edit, trying next fallback model`);
            continue;
          }
          if (modelCandidate === "dall-e-2") throw err;
        }
      }

      throw lastAttemptError || new Error("OpenAI image edit failed for all candidate models");
    }

    // No base image → generate from scratch
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ model: provider.model_id, prompt, n: 1, size: requestedSize, quality: "standard" }),
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

// ── Cost estimation (uses DB pricing with hardcoded fallback) ──

let pricingCache: Map<string, { input: number; output: number }> | null = null;

async function loadPricing(supabase: any): Promise<Map<string, { input: number; output: number }>> {
  if (pricingCache) return pricingCache;
  const { data } = await supabase.from("ai_billing_pricing").select("provider, model, price_per_1k_input_tokens, price_per_1k_output_tokens").eq("is_active", true);
  const map = new Map<string, { input: number; output: number }>();
  for (const row of data || []) {
    map.set(`${row.provider}:${row.model}`, { input: row.price_per_1k_input_tokens, output: row.price_per_1k_output_tokens });
  }
  pricingCache = map;
  return map;
}

function estimateCost(providerKey: string, providerType: string, tokensIn: number, tokensOut: number, pricing?: Map<string, { input: number; output: number }>, modelId?: string): number {
  if (providerType === "groq") return 0;
  if (providerType === "gemini") return 0;
  
  // Try DB pricing first
  if (pricing && modelId) {
    const key = `${providerType}:${modelId}`;
    const p = pricing.get(key);
    if (p) return (tokensIn * p.input + tokensOut * p.output) / 1000;
  }
  
  // Hardcoded fallback
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
    const { task_type, prompt, image_base64, image_size, force_provider, file_mime_type } = body;

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

    // --- SECURITY: Derive org from JWT context, NEVER from body ---
    // body.organization_id is intentionally ignored to prevent org spoofing.
    const { data: authProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    const orgId = authProfile?.organization_id || null;
    const userId = authUserId; // Always use JWT-derived userId

    // Log divergence if body tried to spoof a different org/user
    if (body.organization_id && body.organization_id !== orgId) {
      console.warn(`[ai-router] SECURITY: body.organization_id="${body.organization_id}" ignored, derived="${orgId}" for user=${authUserId}`);
      const reqMeta = extractRequestMeta(req);
      auditLog({
        event_type: "org_spoofing_attempt",
        severity: "warn",
        endpoint: "ai-router",
        actor_user_id: authUserId,
        actor_org_id: orgId || undefined,
        decision: "deny",
        reason_code: "org_id_mismatch",
        metadata: { body_org_id: body.organization_id, derived_org_id: orgId },
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });
    }
    if (body.user_id && body.user_id !== authUserId) {
      console.warn(`[ai-router] SECURITY: body.user_id="${body.user_id}" ignored, using JWT user="${authUserId}"`);
    }

    const [pricing, budgetResult] = await Promise.all([
      loadPricing(supabase),
      orgId ? supabase.rpc("check_ai_budget", { p_org_id: orgId }).then((r: any) => r.data) : Promise.resolve(null),
    ]);

    const budgetCheck = budgetResult as { allowed: boolean; has_budget: boolean; action: string; force_free: boolean; spent?: number; limit?: number } | null;

    // If budget says block, return immediately
    if (budgetCheck && !budgetCheck.allowed && budgetCheck.action === "block") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Limite de IA atingido para esta organização. Gasto: $${budgetCheck.spent?.toFixed(4)} / Limite: $${budgetCheck.limit?.toFixed(2)}`,
          budget_exceeded: true,
          tokens_input: 0, tokens_output: 0, latency_ms: Date.now() - startMs, is_free: true, estimated_cost_usd: 0,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If budget says degrade, force free providers only
    const forceFreeOnly = budgetCheck?.force_free === true;

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
        if (forceFreeOnly && !p.is_free) return false; // Budget exceeded: only free providers
        const apiKey = p.api_key || Deno.env.get(p.env_secret_name || '');
        if (!apiKey) return false;
        if (file_mime_type === "application/pdf" && p.provider_type === "openai") return false;
        if (config.requires_image && !p.supports_image_input) return false;
        if (config.complexity === "image" && !p.supports_image_output) return false;
        return true;
      });

      if (forceFreeOnly) console.log(`[ai-router] Budget exceeded for org ${orgId} — forcing free providers only`);

      console.log(`[ai-router] Auto-routing for '${task_type}': ${allProviders.length} total, ${eligible.length} eligible`);

      scores = eligible.map(p => calculateProviderScore(p, statsMap.get(p.provider_key) || null));
      scores = scores.filter(s => s.score >= 0).sort((a, b) => b.score - a.score);

      console.log(`[ai-router] Scores:`, scores.map(s => `${s.provider_key}=${s.score}`).join(', '));

      if (scores.length === 0 && eligible.length > 0) {
        console.warn("[ai-router] All eligible providers were penalized; forcing retry with lowest-error provider.");
        orderedProviders = [...eligible]
          .sort((a, b) => (a.consecutive_errors || 0) - (b.consecutive_errors || 0))
          .map((p) => ({
            provider: p,
            score: {
              provider_key: p.provider_key,
              score: 0,
              breakdown: { cost: 0, speed: 0, reliability: 0, quality: 0, penalties: 0 },
            },
          }));
      } else {
        orderedProviders = scores.map(s => ({
          provider: providerMap.get(s.provider_key)!,
          score: s,
        }));
      }
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

    const isPdfTask = file_mime_type === "application/pdf" || task_type === "pdf_extract";

    for (const { provider, score } of orderedProviders) {
      if (!provider.is_active && !force_provider) continue;
      if (!isPdfTask && provider.consecutive_errors > 10 && !force_provider && orderedProviders.length > 1) {
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
      const requestTimeoutMs = isPdfTask ? 90_000 : 30_000;
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        let result: { text?: string; image_url?: string; image_base64?: string; tokens_input: number; tokens_output: number };
        // Skip OpenAI for non-image file types (e.g. PDF)
        const isPdfFile = file_mime_type === "application/pdf";
        if (isPdfFile && provider.provider_type === "openai") {
          lastError = `${provider.provider_key}: OpenAI does not support PDF input`;
          console.warn(`[ai-router] ${lastError}`);
          continue;
        }
        const callArgs = [provider, apiKey, prompt, systemPrompt, maxTokens, temperature, image_base64, controller.signal, image_size, file_mime_type] as const;

        switch (provider.provider_type) {
          case "groq": result = await callGroq(...callArgs); break;
          case "gemini": result = await callGemini(...callArgs); break;
          case "openai": result = await callOpenAI(...callArgs); break;
          case "text": result = await callAnthropic(...callArgs); break;
          default:
            lastError = `Unknown provider_type: ${provider.provider_type}`;
            continue;
        }

        clearTimeout(timeout);
        const latencyMs = Date.now() - startMs;
        const costUsd = estimateCost(provider.provider_key, provider.provider_type, result.tokens_input, result.tokens_output, pricing, provider.model_id);

        // Reset consecutive errors on success
        const wasInCooldown = provider.consecutive_errors >= 10;
        supabase.from("ai_router_providers").update({ consecutive_errors: 0, last_error_at: null }).eq("provider_key", provider.provider_key).then(() => {});

        // Track stats (fire and forget)
        trackStats(supabase, provider.provider_key, task_type, latencyMs, true, false, result.tokens_input, result.tokens_output, costUsd);

        // Track billing (fire and forget)
        trackAiBilling(supabase, {
          userId: userId || "system",
          organizationId: orgId,
          provider: provider.provider_type,
          model: provider.model_id,
          functionName: `ai-router/${task_type}`,
          inputTokens: result.tokens_input,
          outputTokens: result.tokens_output,
          success: true,
          usageType: config.complexity === "image" ? "image" : "text",
        }).catch(() => {});

        // Track org spend (fire and forget)
        if (orgId && costUsd > 0) {
          supabase.rpc("track_ai_spend", { p_org_id: orgId, p_cost_usd: costUsd }).then(() => {});
        }

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
    if (!lastError) {
      lastError = providersAttempted.length === 0
        ? "No provider attempt was executed (cooldown/penalty/API-key filtering)."
        : "All providers failed without details.";
    }

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

    // Track billing for total failure (fire and forget)
    trackAiBilling(supabase, {
      userId: userId || "system",
      organizationId: orgId,
      provider: "none",
      model: "none",
      functionName: `ai-router/${task_type}`,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      errorMessage: lastError?.slice(0, 500),
      usageType: "text",
    }).catch(() => {});

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
