import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
}

export function StorefrontHeroBold({ org, brand, website }: Props) {
  const primary = brand?.primary_color || "#3B82F6";

  return (
    <header className="relative overflow-hidden" style={{ backgroundColor: primary }}>
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        {brand?.logo_dark_url || brand?.logo_url ? (
          <img src={brand.logo_dark_url || brand.logo_url!} alt={org.name} className="h-10 max-w-[180px] object-contain" />
        ) : (
          <span className="text-xl font-extrabold text-white tracking-tight">{org.name}</span>
        )}
        <div className="flex items-center gap-4">
          <a href="#imoveis" className="text-white/80 hover:text-white text-sm font-bold transition-colors uppercase tracking-wider">Imóveis</a>
          <a href="#sobre" className="text-white/80 hover:text-white text-sm font-bold transition-colors uppercase tracking-wider">Sobre</a>
          <a href="#contato" className="text-white/80 hover:text-white text-sm font-bold transition-colors uppercase tracking-wider">Contato</a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 px-6 py-24 md:py-40 max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-7xl font-black text-white mb-4 leading-none uppercase tracking-tight">
          {website?.hero_title || `Bem-vindo à ${org.name}`}
        </h1>
        <p className="text-lg md:text-2xl text-white/80 max-w-2xl font-medium">
          {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
        </p>
      </div>

      {/* Geometric shapes */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rotate-45 translate-x-1/2 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 -rotate-12 -translate-x-1/4 translate-y-1/3" />
    </header>
  );
}
