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
  const effectiveSiteName = siteName || SITE_NAME;
  const fullTitle = title.includes(effectiveSiteName) ? title : `${title} — ${effectiveSiteName}`;
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
