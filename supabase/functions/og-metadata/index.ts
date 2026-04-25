import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Googlebot|bingbot|Discordbot|PinterestBot/i;

const SITE_URL = Deno.env.get("APP_URL") || "https://portadocorretor.com.br";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.png`;
const SITE_NAME = "Porta do Corretor";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(
  title: string,
  description: string,
  image: string,
  canonicalUrl: string,
  redirectUrl: string,
): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const i = escapeHtml(image);
  const c = escapeHtml(canonicalUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<meta property="og:title" content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:image" content="${i}"/>
<meta property="og:url" content="${c}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${t}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:image" content="${i}"/>
<link rel="canonical" href="${c}"/>
</head>
<body>
<script>window.location.replace("${redirectUrl}");</script>
<noscript><a href="${redirectUrl}">Ir para o imóvel</a></noscript>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("id");
  const orgSlug = url.searchParams.get("org");
  const code = url.searchParams.get("code");
  const userAgent = req.headers.get("user-agent") || "";

  // Determine redirect path
  let redirectPath = "/";
  if (propertyId) {
    redirectPath = `/imovel/${propertyId}`;
  } else if (orgSlug && code) {
    redirectPath = `/i/${orgSlug}/${code}`;
  }

  const redirectUrl = `${SITE_URL}${redirectPath}`;

  // If not a crawler, just redirect
  if (!CRAWLER_RE.test(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl },
    });
  }

  // It's a crawler — fetch property data
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let property: { title: string; description: string | null; images: string[] | null } | null = null;

    // Helper: fallback to properties + property_images tables
    async function fallbackFromProperties(filter: Record<string, string>) {
      let query: any = supabase
        .from("properties")
        .select("title, description")
        .limit(1);
      for (const [k, v] of Object.entries(filter)) {
        query = query.eq(k, v);
      }
      query = query.maybeSingle();
      const { data: prop } = await query;
      if (!prop) return null;

      // Get cover image (prefer is_cover, fallback to display_order)
      const { data: imgs } = await supabase
        .from("property_images")
        .select("url")
        .eq("property_id", Object.values(filter).find((_, i) => Object.keys(filter)[i] === "id") || "")
        .order("is_cover", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(1);

      const imageUrl = imgs && imgs.length > 0 ? imgs[0].url : null;
      return { title: prop.title, description: prop.description, images: imageUrl ? [imageUrl] : null };
    }

    if (propertyId) {
      const { data } = await supabase
        .from("marketplace_properties")
        .select("title, description, images")
        .eq("id", propertyId)
        .maybeSingle();
      property = data;

      // Fallback to properties table
      if (!property) {
        property = await fallbackFromProperties({ id: propertyId });
      }
    } else if (orgSlug && code) {
      // Lookup by org slug + property code
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .maybeSingle();

      if (orgData) {
        const { data } = await supabase
          .from("marketplace_properties")
          .select("title, description, images")
          .eq("organization_id", orgData.id)
          .eq("external_code", code)
          .maybeSingle();
        property = data;

        // Fallback to properties table
        if (!property) {
          // Find property by org + code
          const { data: propData } = await supabase
            .from("properties")
            .select("id, title, description")
            .eq("organization_id", orgData.id)
            .eq("property_code", code)
            .maybeSingle();

          if (propData) {
            const { data: imgs } = await supabase
              .from("property_images")
              .select("url")
              .eq("property_id", propData.id)
              .order("is_cover", { ascending: false })
              .order("display_order", { ascending: true })
              .limit(1);

            const imageUrl = imgs && imgs.length > 0 ? imgs[0].url : null;
            property = { title: propData.title, description: propData.description, images: imageUrl ? [imageUrl] : null };
          }
        }
      }
    }

    const title = property?.title
      ? `${property.title} — ${SITE_NAME}`
      : SITE_NAME;
    const description = property?.description
      ? property.description.substring(0, 160)
      : "Encontre o imóvel ideal no Porta do Corretor.";
    const image =
      property?.images && property.images.length > 0
        ? property.images[0]
        : DEFAULT_OG_IMAGE;

    const html = buildHtml(
      title,
      description,
      image,
      `${SITE_URL}${redirectPath}`,
      redirectUrl,
    );

    // COST OPT: cache OG pages for 1 hour at CDN/proxy level.
    // Property data rarely changes within an hour and this reduces Edge Fn invocations.
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("og-metadata error:", err);
    // Fallback: redirect
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl },
    });
  }
});
