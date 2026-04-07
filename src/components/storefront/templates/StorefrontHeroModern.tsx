import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontHeroModern({ org, brand, website }: Props) {
  const primary = brand?.primary_color || "#3B82F6";

  return (
    <header className="relative min-h-[70vh] flex flex-col">
      {/* Dark overlay background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/90 to-gray-900/70" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        {brand?.logo_dark_url || brand?.logo_url ? (
          <img src={brand.logo_dark_url || brand.logo_url!} alt={org.name} className="h-10 max-w-[180px] object-contain" />
        ) : (
          <span className="text-xl font-bold text-white">{org.name}</span>
        )}
        <div className="flex items-center gap-6">
          <a href="#imoveis" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Imóveis</a>
          <a href="#sobre" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Sobre</a>
          <a href="#contato" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Contato</a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex items-center px-6 max-w-7xl mx-auto w-full">
        <div className="max-w-2xl">
          <div className="h-1 w-16 mb-6 rounded-full" style={{ backgroundColor: primary }} />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            {website?.hero_title || `Bem-vindo à ${org.name}`}
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-xl">
            {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
          </p>
          <a href="#imoveis" className="inline-block mt-8 px-8 py-3 rounded-full text-white font-semibold transition-transform hover:scale-105" style={{ backgroundColor: primary }}>
            Ver imóveis
          </a>
        </div>
      </div>
    </header>
  );
}
