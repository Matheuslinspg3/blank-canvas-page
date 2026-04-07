import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontHeroElegant({ org, brand, website }: Props) {
  const primary = brand?.primary_color || "#3B82F6";
  const accent = brand?.accent_color || "#D4AF37";

  return (
    <header className="relative bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto border-b border-gray-100">
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={org.name} className="h-10 max-w-[180px] object-contain" />
        ) : (
          <span className="text-xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{org.name}</span>
        )}
        <div className="flex items-center gap-6">
          <a href="#imoveis" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">Imóveis</a>
          <a href="#sobre" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">Sobre</a>
          <a href="#contato" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">Contato</a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="px-6 py-24 md:py-36 max-w-4xl mx-auto text-center">
        <div className="h-px w-24 mx-auto mb-8" style={{ backgroundColor: accent }} />
        <h1 className="text-3xl md:text-5xl font-light text-gray-900 mb-6 leading-tight" style={{ fontFamily: "Georgia, serif" }}>
          {website?.hero_title || `Bem-vindo à ${org.name}`}
        </h1>
        <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto tracking-wide">
          {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
        </p>
        <div className="h-px w-24 mx-auto mt-8" style={{ backgroundColor: accent }} />
      </div>
    </header>
  );
}
