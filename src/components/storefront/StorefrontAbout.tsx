import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontAbout({ org, brand, website }: Props) {
  const aboutText = website?.about_text;
  if (!aboutText) return null;

  const primaryColor = brand?.primary_color || "#3B82F6";

  return (
    <section id="sobre" className="py-16 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">
          Sobre a {org.name}
        </h2>
        <div
          className="text-gray-600 leading-relaxed whitespace-pre-line"
          style={{ borderLeft: `3px solid ${primaryColor}`, paddingLeft: "1.5rem", textAlign: "left" }}
        >
          {aboutText}
        </div>
      </div>
    </section>
  );
}
