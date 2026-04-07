import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";

// Classic (original)
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { StorefrontProperties } from "@/components/storefront/StorefrontProperties";
import { StorefrontAbout } from "@/components/storefront/StorefrontAbout";
import { StorefrontContact } from "@/components/storefront/StorefrontContact";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";

// Template variants (hero only — other sections use style props)
import { StorefrontHeroModern } from "./StorefrontHeroModern";
import { StorefrontHeroElegant } from "./StorefrontHeroElegant";
import { StorefrontHeroBold } from "./StorefrontHeroBold";
import { StorefrontHeroMinimal } from "./StorefrontHeroMinimal";

export type SiteTemplate = "classic" | "modern" | "elegant" | "bold" | "minimal";

interface Props {
  template: SiteTemplate;
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
  properties: StorefrontProperty[];
  primaryColor: string;
}

const heroMap: Record<SiteTemplate, React.ComponentType<{ org: StorefrontOrg; brand: StorefrontBrand | null; website: StorefrontWebsite | null }>> = {
  classic: StorefrontHero,
  modern: StorefrontHeroModern,
  elegant: StorefrontHeroElegant,
  bold: StorefrontHeroBold,
  minimal: StorefrontHeroMinimal,
};

// Template-specific section wrapper styles
const sectionStyles: Record<SiteTemplate, { propertiesBg: string; aboutBg: string; contactBg: string }> = {
  classic: { propertiesBg: "", aboutBg: "", contactBg: "" },
  modern: { propertiesBg: "bg-gray-50", aboutBg: "bg-white", contactBg: "bg-gray-50" },
  elegant: { propertiesBg: "", aboutBg: "bg-gray-50", contactBg: "" },
  bold: { propertiesBg: "", aboutBg: "", contactBg: "" },
  minimal: { propertiesBg: "", aboutBg: "", contactBg: "" },
};

export function StorefrontTemplateRenderer({ template, org, brand, website, properties, primaryColor }: Props) {
  const HeroComponent = heroMap[template] || heroMap.classic;
  const styles = sectionStyles[template] || sectionStyles.classic;

  return (
    <>
      <HeroComponent org={org} brand={brand} website={website} />

      <div className={styles.propertiesBg}>
        <StorefrontProperties properties={properties} primaryColor={primaryColor} orgSlug={org.slug} />
      </div>

      <div className={styles.aboutBg}>
        <StorefrontAbout org={org} brand={brand} website={website} />
      </div>

      <div className={styles.contactBg}>
        <StorefrontContact org={org} website={website} primaryColor={primaryColor} />
      </div>

      <StorefrontFooter org={org} brand={brand} />
    </>
  );
}
