import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontHero({ org, brand, website }: Props) {
  const primary = brand?.primary_color || "#3B82F6";
  const secondary = brand?.secondary_color || "#1E293B";

  return (
    <header
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${secondary}, ${primary})` }}
    >
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        {brand?.logo_dark_url || brand?.logo_url ? (
          <img
            src={brand.logo_dark_url || brand.logo_url!}
            alt={org.name}
            className="h-10 max-w-[180px] object-contain"
          />
        ) : (
          <span className="text-xl font-bold text-white">{org.name}</span>
        )}
        <div className="flex items-center gap-4">
          <a href="#imoveis" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Imóveis
          </a>
          <a href="#sobre" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Sobre
          </a>
          <a href="#contato" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Contato
          </a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 px-6 py-20 md:py-32 max-w-7xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
          {website?.hero_title || `Bem-vindo à ${org.name}`}
        </h1>
        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
          {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
        </p>
      </div>

      {/* Decorative shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 bg-white translate-y-1/3 -translate-x-1/4" />
    </header>
  );
}
