import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";
import { TemplateClassic } from "./TemplateClassic";
import { TemplateModern } from "./TemplateModern";
import { TemplateElegant } from "./TemplateElegant";
import { TemplateBold } from "./TemplateBold";
import { TemplateMinimal } from "./TemplateMinimal";

export type SiteTemplate = "classic" | "modern" | "elegant" | "bold" | "minimal";

interface Props {
  template: SiteTemplate;
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
  properties: StorefrontProperty[];
  primaryColor: string;
}

const templateMap: Record<SiteTemplate, React.ComponentType<Omit<Props, "template">>> = {
  classic: TemplateClassic,
  modern: TemplateModern,
  elegant: TemplateElegant,
  bold: TemplateBold,
  minimal: TemplateMinimal,
};

export function StorefrontTemplateRenderer({ template, ...rest }: Props) {
  const Component = templateMap[template] || templateMap.classic;
  return <Component {...rest} />;
}
