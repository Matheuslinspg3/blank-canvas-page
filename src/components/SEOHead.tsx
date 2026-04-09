import { Helmet } from "react-helmet-async";

const DEFAULT_OG_IMAGE = "https://portadocorretor.com.br/og-cover.png";
const SITE_NAME = "Porta do Corretor";

interface SEOHeadProps {
  title: string;
  description?: string;
  ogImage?: string | null;
  ogUrl?: string | null;
  noIndex?: boolean;
  favicon?: string | null;
  siteName?: string | null;
}

export function SEOHead({
  title,
  description,
  ogImage,
  ogUrl,
  noIndex = false,
  favicon,
  siteName,
}: SEOHeadProps) {
  const isWhiteLabel = !!siteName && siteName !== SITE_NAME;
  const effectiveSiteName = siteName || SITE_NAME;
  // For white-label sites, use the title as-is or append org name only if not redundant
  const fullTitle = isWhiteLabel
    ? (title.toLowerCase().includes(siteName!.toLowerCase().replace(/\s*(ltda|me|eireli|s\.?a\.?)\.?$/i, '').trim().toLowerCase())
        ? title
        : `${title} — ${siteName}`)
    : (title.includes(effectiveSiteName) ? title : `${title} — ${effectiveSiteName}`);
  const resolvedImage = ogImage || DEFAULT_OG_IMAGE;
  const resolvedUrl = ogUrl || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {favicon && <link rel="icon" type="image/png" href={favicon} />}
      {description && <meta name="description" content={description} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:url" content={resolvedUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={effectiveSiteName} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
}
