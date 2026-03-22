import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimit } from "../_shared/ai-rate-limit.ts";
import { fetchImageAsDataUrl } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ArtConfig {
  main_text?: string;
  sub_text?: string;
  phone?: string;
  slogan?: string;
  accent_color?: string;
  logo_position?: string;
}

function formatPrice(value: number | null): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function buildArtPrompt(
  format: "feed" | "story" | "banner",
  property: any,
  orgName: string,
  config: ArtConfig,
): string {
  const dimensions: Record<string, string> = {
    feed: "1080x1080 (square, Instagram feed)",
    story: "1080x1920 (vertical, Instagram story)",
    banner: "1200x628 (horizontal, Facebook/website banner)",
  };

  const price = property.transaction_type === "venda"
    ? formatPrice(property.sale_price)
    : formatPrice(property.rent_price);

  const txLabel = property.transaction_type === "venda" ? "VENDA" : "ALUGUEL";

  const details: string[] = [];
  if (property.bedrooms) details.push(`${property.bedrooms} quartos`);
  if (property.parking_spots) details.push(`${property.parking_spots} vagas`);
  const area = property.area_built || property.area_total;
  if (area) details.push(`${area}m²`);
  if (property.address_neighborhood) details.push(property.address_neighborhood);

  const mainText = config.main_text || property.title || "Imóvel Disponível";
  const subText = config.sub_text || details.join(" · ");
  const accentColor = config.accent_color || "#3B82F6";

  return `Edit this property photo to create a professional real estate marketing image in ${dimensions[format]} format.
Keep the original property photo as the main background — do NOT replace it.
Apply a modern, elegant overlay design on top of the photo:

DESIGN RULES:
- The original property photo MUST remain as the dominant visual (at least 70% visible)
- Add a semi-transparent gradient overlay at the bottom (dark, elegant)
- Use clean, modern typography — bold and highly readable
- Accent color: ${accentColor}
- Make it look like a premium real estate ad from a luxury agency

TEXT TO INCLUDE (in Portuguese):
- Transaction badge: "${txLabel}" (small badge, accent color background)
- Main headline: "${mainText}" (large, bold, white)
${price ? `- Price: "${price}" (prominent, accent color or white)` : ""}
${subText ? `- Details: "${subText}" (smaller, white/light gray)` : ""}
${config.phone ? `- Contact: "${config.phone}" (bottom area, with phone icon)` : ""}
${config.slogan ? `- Slogan: "${config.slogan}" (subtle, elegant)` : ""}
- Brand: "${orgName}" (bottom corner, subtle)

IMPORTANT: All text must be perfectly legible and spelled correctly in Portuguese.
Do NOT add any text that is not listed above. Keep it clean and professional.`;
}

async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string,
  publicId: string,
): Promise<string | null> {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn("[art-gen] Cloudinary not configured, returning data URL");
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + apiSecret);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const formData = new FormData();
  formData.append("file", base64Data);
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("timestamp", timestamp);
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[art-gen] Cloudinary upload failed:", errText);
    return null;
  }

  const result = await res.json();
  return result.secure_url;
}

function ensureCloudinaryPngUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("res.cloudinary.com")) return url;

    // Force Cloudinary delivery as PNG so OpenAI /images/edits accepts it.
    parsed.pathname = parsed.pathname.replace("/upload/", "/upload/f_png/");
    return parsed.toString();
  } catch {
    return url;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 20 req/hour
    const rateLimited = await checkAiRateLimit(user.id, "generate-property-art", corsHeaders);
    if (rateLimited) return rateLimited;

    const { propertyId, imageUrl, config = {} } = await req.json();
    if (!propertyId || !imageUrl) {
      return new Response(JSON.stringify({ error: "propertyId and imageUrl are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Load data in parallel
    const [profileRes, propertyRes] = await Promise.all([
      serviceClient.from("profiles").select("organization_id, phone").eq("user_id", user.id).single(),
      serviceClient.from("properties")
        .select("title, sale_price, rent_price, transaction_type, bedrooms, parking_spots, area_built, area_total, address_neighborhood, address_city")
        .eq("id", propertyId).single(),
    ]);

    const profile = profileRes.data;
    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const property = propertyRes.data;
    const { data: org } = await serviceClient.from("organizations").select("name").eq("id", profile.organization_id).single();
    const orgName = org?.name || "";

    // Merge config with defaults
    const artConfig: ArtConfig = {
      ...config,
      phone: config.phone || profile.phone || "",
    };

    // Fetch property image as PNG when possible (Cloudinary), then convert to base64
    const sourceImageUrl = ensureCloudinaryPngUrl(imageUrl);
    const imageDataUrl = await fetchImageAsDataUrl(sourceImageUrl);
    const base64Match = imageDataUrl.match(/^data:.*?;base64,(.*)$/);
    const imageBase64 = base64Match ? base64Match[1] : "";

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Falha ao processar imagem do imóvel" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map format to OpenAI compatible sizes
    const sizeMap: Record<string, string> = {
      feed: "1024x1024",
      story: "1024x1536",
      banner: "1536x1024",
    };

    // Generate 3 formats in parallel via AI Router (with image editing)
    const formats = ["feed", "story", "banner"] as const;
    const results = await Promise.allSettled(
      formats.map(async (format) => {
        const prompt = buildArtPrompt(format, property, orgName, artConfig);

        console.log(`[art-gen] Calling AI Router for ${format} (${sizeMap[format]})`);

        const { data, error } = await authClient.functions.invoke("ai-router", {
          body: {
            task_type: "generate_art",
            prompt,
            image_base64: imageBase64,
            image_size: sizeMap[format],
            organization_id: profile.organization_id,
          },
        });

        if (error) throw new Error(`AI Router error: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || "AI Router failed");

        // Get the image result (could be base64 or URL)
        const resultDataUrl = data.image_base64 || data.image_url;
        if (!resultDataUrl) throw new Error("No image returned from AI Router");

        // Upload to Cloudinary
        const folder = `habitae/artes/${profile.organization_id}`;
        const publicId = `${propertyId}_${format}_${Date.now()}`;
        const cloudinaryUrl = await uploadBase64ToCloudinary(resultDataUrl, folder, publicId);

        return cloudinaryUrl || resultDataUrl;
      }),
    );

    const urls = {
      url_feed: results[0].status === "fulfilled" ? results[0].value : null,
      url_story: results[1].status === "fulfilled" ? results[1].value : null,
      url_banner: results[2].status === "fulfilled" ? results[2].value : null,
    };

    // Log failures
    for (const [i, r] of results.entries()) {
      if (r.status === "rejected") {
        console.error(`[art-gen] ${formats[i]} failed:`, r.reason?.message || r.reason);
      }
    }

    if (!urls.url_feed && !urls.url_story && !urls.url_banner) {
      const firstErr = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
      return new Response(JSON.stringify({
        error: `Falha ao gerar artes: ${firstErr?.reason?.message || "Erro desconhecido"}`,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to history
    await serviceClient.from("generated_arts").insert({
      property_id: propertyId,
      organization_id: profile.organization_id,
      created_by: user.id,
      url_feed: urls.url_feed,
      url_story: urls.url_story,
      url_banner: urls.url_banner,
      config: artConfig,
    });

    return new Response(JSON.stringify(urls), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[art-gen] fatal:", error);
    const message = error instanceof Error && error.name === "AbortError"
      ? "Tempo limite excedido. Tente novamente."
      : error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
