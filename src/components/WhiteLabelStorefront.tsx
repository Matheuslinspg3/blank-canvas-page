import { useStorefrontByOrgId } from "@/hooks/useStorefrontByOrgId";
import { useSiteDocumentPublic } from "@/hooks/useSiteDocumentPublic";
import { SEOHead } from "@/components/SEOHead";
import { StorefrontWhatsAppFloat } from "@/components/storefront/StorefrontWhatsAppFloat";
import { StorefrontTemplateRenderer, type SiteTemplate } from "@/components/storefront/templates/StorefrontTemplateRenderer";
import { SiteDocumentRendererV2 } from "@/components/storefront/v3/SiteDocumentRendererV2";
import { StorefrontNavBar } from "@/components/storefront/StorefrontNavBar";
import { StorefrontPropertiesPage } from "@/components/storefront/StorefrontPropertiesPage";
import { StorefrontErrorBoundary } from "@/components/storefront/StorefrontErrorBoundary";
import { Loader2 } from "lucide-react";
import type { SiteLayout } from "@/types/siteBuilder";
import type { SiteLayoutV2, SitePage, NavItem } from "@/types/siteBuilderV2";

/**
 * Sanity-check that a V2 layout is renderable. If something is structurally
 * wrong (corrupt JSON, missing arrays), we bail to the legacy template
 * instead of crashing the renderer.
 */
function isValidV2Layout(layout: any): layout is SiteLayoutV2 {
  if (!layout || typeof layout !== "object") return false;
  // Must have at least one of: sections (single-page) or pages (multi-page)
  const hasSections = Array.isArray(layout.sections);
  const hasPages = Array.isArray(layout.pages);
  return hasSections || hasPages;
}


interface Props {
  organizationId: string;
  pageSlug?: string; // e.g. 'imoveis', 'sobre', 'contato'
}

export function WhiteLabelStorefront({ organizationId, pageSlug }: Props) {
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
  const template = (website?.site_template as SiteTemplate) || "classic";

  const metaTitle = website?.meta_title || `${org.name} — Imóveis`;
  const metaDesc = website?.meta_description || `Confira os melhores imóveis da ${org.name}.`;
  const faviconUrl = brand?.logo_url || null;

  const rootStyle = {
    fontFamily,
    "--sf-primary": primaryColor,
    "--sf-secondary": secondaryColor,
    "--sf-accent": accentColor,
  } as React.CSSProperties;

  // V2 advanced renderer with multi-page support
  if (siteDoc?.editor_mode === 'advanced' && siteDoc.layout) {
    const v2Layout = siteDoc.layout as SiteLayoutV2;
    const navigation = v2Layout.navigation || [];
    const pages = v2Layout.pages || [];
    const isMultiPage = navigation.length > 0 || pages.length > 0;

    // If we have a pageSlug, find the matching page
    if (pageSlug && isMultiPage) {
      // Special case: /imoveis renders full property page
      if (pageSlug === 'imoveis') {
        const imoveisPage = pages.find(p => p.slug === 'imoveis');
        const pageTitle = imoveisPage?.seo?.title || `Imóveis — ${org.name}`;
        const pageDesc = imoveisPage?.seo?.description || metaDesc;

        return (
          <div style={rootStyle} className="min-h-screen bg-white text-gray-900">
            <SEOHead title={pageTitle} description={pageDesc} noIndex={false} favicon={faviconUrl} siteName={org.name} />
            <StorefrontNavBar orgName={org.name} logoUrl={faviconUrl} navigation={navigation} />
            <StorefrontPropertiesPage properties={properties} orgName={org.name} />
            {website?.show_whatsapp_float && website?.whatsapp_number && (
              <StorefrontWhatsAppFloat number={website.whatsapp_number} message={website.whatsapp_message || "Olá!"} />
            )}
          </div>
        );
      }

      // Other pages: render their sections
      const page = pages.find(p => p.slug === pageSlug);
      if (page) {
        const pageSections = page.sections || [];
        const pageLayout: SiteLayoutV2 = { ...v2Layout, sections: pageSections };
        const pageTitle = page.seo?.title || `${page.title} — ${org.name}`;
        const pageDesc = page.seo?.description || metaDesc;

        return (
          <div style={rootStyle} className="min-h-screen bg-white text-gray-900">
            <SEOHead title={pageTitle} description={pageDesc} noIndex={false} favicon={faviconUrl} siteName={org.name} />
            <StorefrontNavBar orgName={org.name} logoUrl={faviconUrl} navigation={navigation} />
            <SiteDocumentRendererV2 siteLayout={pageLayout} properties={properties} />
            {website?.show_whatsapp_float && website?.whatsapp_number && (
              <StorefrontWhatsAppFloat number={website.whatsapp_number} message={website.whatsapp_message || "Olá!"} />
            )}
          </div>
        );
      }

      // Page not found — fall through to homepage
    }

    // Homepage
    const v2Title = v2Layout.meta?.title || metaTitle;
    const v2Desc = v2Layout.meta?.description || metaDesc;
    return (
      <div style={rootStyle} className="min-h-screen bg-white text-gray-900">
        <SEOHead title={v2Title} description={v2Desc} noIndex={false} favicon={faviconUrl} siteName={org.name} />
        {isMultiPage && (
          <StorefrontNavBar orgName={org.name} logoUrl={faviconUrl} navigation={navigation} />
        )}
        <SiteDocumentRendererV2 siteLayout={v2Layout} properties={properties} />
        {website?.show_whatsapp_float && website?.whatsapp_number && (
          <StorefrontWhatsAppFloat number={website.whatsapp_number} message={website.whatsapp_message || "Olá!"} />
        )}
      </div>
    );
  }

  // Legacy template renderer (unchanged)
  return (
    <div style={rootStyle} className="min-h-screen bg-white text-gray-900">
      <SEOHead title={metaTitle} description={metaDesc} noIndex={false} favicon={faviconUrl} siteName={org.name} />
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
