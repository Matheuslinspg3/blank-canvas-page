import { Helmet } from "react-helmet-async";

const DEFAULT_OG_IMAGE = "https://portadocorretor.com.br/og-cover.png";
const SITE_NAME = "Porta do Corretor";

interface SEOHeadProps {
  title: string;
  description?: string;
  ogImage?: string | null;
  ogUrl?: string | null;
  noIndex?: boolean;
}

export function SEOHead({
  title,
  description,
  ogImage,
  ogUrl,
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const resolvedImage = ogImage || DEFAULT_OG_IMAGE;
  const resolvedUrl = ogUrl || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:url" content={resolvedUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
}
