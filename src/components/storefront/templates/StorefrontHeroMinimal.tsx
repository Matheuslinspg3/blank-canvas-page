import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontHeroMinimal({ org, brand, website }: Props) {
  const primary = brand?.primary_color || "#3B82F6";

  return (
    <header className="bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={org.name} className="h-9 max-w-[180px] object-contain" />
        ) : (
          <span className="text-lg font-semibold text-gray-900">{org.name}</span>
        )}
        <div className="flex items-center gap-6">
          <a href="#imoveis" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">Imóveis</a>
          <a href="#sobre" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">Sobre</a>
          <a href="#contato" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">Contato</a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="px-6 py-20 md:py-32 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-gray-900 mb-4 leading-tight">
          {website?.hero_title || `Bem-vindo à ${org.name}`}
        </h1>
        <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto">
          {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
        </p>
        <a href="#imoveis" className="inline-block mt-10 px-6 py-2.5 text-sm font-medium rounded border transition-colors" style={{ borderColor: primary, color: primary }}>
          Explorar imóveis
        </a>
      </div>
    </header>
  );
}
