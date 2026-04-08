import { useStorefrontByOrgId } from "@/hooks/useStorefrontByOrgId";
import { useSiteDocumentPublic } from "@/hooks/useSiteDocumentPublic";
import { SEOHead } from "@/components/SEOHead";
import { StorefrontWhatsAppFloat } from "@/components/storefront/StorefrontWhatsAppFloat";
import { StorefrontTemplateRenderer, type SiteTemplate } from "@/components/storefront/templates/StorefrontTemplateRenderer";
import { SiteDocumentRenderer } from "@/components/storefront/v2/SiteDocumentRenderer";
import type { PropertySummary } from "@/types/siteBuilder";
import { Loader2 } from "lucide-react";

interface Props {
  organizationId: string;
}

export function WhiteLabelStorefront({ organizationId }: Props) {
  const { org, brand, website, properties, isLoading, notFound } = useStorefrontByOrgId(organizationId);
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

  const metaTitle = siteDoc?.meta?.title || website?.meta_title || `${org.name} — Imóveis`;
  const metaDesc = siteDoc?.meta?.description || website?.meta_description || `Confira os melhores imóveis da ${org.name}.`;

  const propertySummaries: PropertySummary[] = properties.map((p) => ({
    id: p.id,
    title: p.title,
    description: null,
    sale_price: p.sale_price,
    rent_price: p.rent_price,
    transaction_type: p.transaction_type,
    images: p.images,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking_spots: p.parking_spots,
    area_total: p.area_total,
    area_built: null,
    address_city: p.address_city,
    address_neighborhood: p.address_neighborhood,
    address_state: p.address_state,
    is_featured: p.is_featured,
    organization_id: null,
    status: p.status,
  }));

  return (
    <div
      style={{ fontFamily, "--sf-primary": primaryColor, "--sf-secondary": secondaryColor, "--sf-accent": accentColor } as React.CSSProperties}
      className="min-h-screen bg-white text-gray-900"
    >
      <SEOHead title={metaTitle} description={metaDesc} noIndex={false} />

      {siteDoc ? (
        <SiteDocumentRenderer siteLayout={siteDoc} properties={propertySummaries} />
      ) : (
        <StorefrontTemplateRenderer
          template={(website?.site_template as SiteTemplate) || "classic"}
          org={org}
          brand={brand}
          website={website}
          properties={properties}
          primaryColor={primaryColor}
        />
      )}

      {website?.show_whatsapp_float && website?.whatsapp_number && (
        <StorefrontWhatsAppFloat
          number={website.whatsapp_number}
          message={website.whatsapp_message || "Olá!"}
        />
      )}
    </div>
  );
}
