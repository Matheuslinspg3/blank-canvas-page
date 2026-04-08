import { useParams } from "react-router-dom";
import { useStorefront } from "@/hooks/useStorefront";
import { useSiteDocumentPublic } from "@/hooks/useSiteDocumentPublic";
import { SEOHead } from "@/components/SEOHead";
import { StorefrontWhatsAppFloat } from "@/components/storefront/StorefrontWhatsAppFloat";
import { StorefrontTemplateRenderer, type SiteTemplate } from "@/components/storefront/templates/StorefrontTemplateRenderer";
import { SiteDocumentRendererV2 } from "@/components/storefront/v3/SiteDocumentRendererV2";
import { Loader2 } from "lucide-react";
import type { SiteLayout } from "@/types/siteBuilder";
import type { SiteLayoutV2 } from "@/types/siteBuilderV2";

export default function Storefront() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org, brand, website, properties, isLoading, notFound } = useStorefront(orgSlug);
  const { data: siteDoc } = useSiteDocumentPublic(org?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Site não encontrado</h1>
          <p className="text-gray-500">Verifique o endereço e tente novamente.</p>
        </div>
      </div>
    );
  }

  const primaryColor = brand?.primary_color || "#3B82F6";
  const secondaryColor = brand?.secondary_color || "#1E293B";
  const accentColor = brand?.accent_color || "#F59E0B";
  const fontFamily = brand?.font_family || "Montserrat";
  const template = (website?.site_template as SiteTemplate) || "classic";

  const metaTitle = website?.meta_title || `${org.name} — Imóveis`;
  const metaDesc = website?.meta_description || `Confira os melhores imóveis da ${org.name}. Encontre seu imóvel ideal.`;

  // V2 advanced renderer
  if (siteDoc?.editor_mode === 'advanced' && siteDoc.layout) {
    return (
      <div style={{ fontFamily, "--sf-primary": primaryColor, "--sf-secondary": secondaryColor, "--sf-accent": accentColor } as React.CSSProperties} className="min-h-screen bg-white text-gray-900">
        <SEOHead title={metaTitle} description={metaDesc} noIndex={false} />
        <SiteDocumentRendererV2 siteLayout={siteDoc.layout as SiteLayoutV2} properties={properties} />
        {website?.show_whatsapp_float && website?.whatsapp_number && (
          <StorefrontWhatsAppFloat number={website.whatsapp_number} message={website.whatsapp_message || "Olá!"} />
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily, "--sf-primary": primaryColor, "--sf-secondary": secondaryColor, "--sf-accent": accentColor } as React.CSSProperties} className="min-h-screen bg-white text-gray-900">
      <SEOHead title={metaTitle} description={metaDesc} noIndex={false} />

      <StorefrontTemplateRenderer
        template={template}
        org={org}
        brand={brand}
        website={website}
        properties={properties}
        primaryColor={primaryColor}
      />

      {website?.show_whatsapp_float && website?.whatsapp_number && (
        <StorefrontWhatsAppFloat
          number={website.whatsapp_number}
          message={website.whatsapp_message || "Olá!"}
        />
      )}
    </div>
  );
}
