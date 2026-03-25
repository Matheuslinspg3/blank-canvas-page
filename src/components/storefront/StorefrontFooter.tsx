import type { StorefrontOrg, StorefrontBrand } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
}

export function StorefrontFooter({ org, brand }: Props) {
  const secondary = brand?.secondary_color || "#1E293B";

  return (
    <footer className="py-8 px-6 text-center text-sm" style={{ backgroundColor: secondary, color: "rgba(255,255,255,0.6)" }}>
      <div className="max-w-7xl mx-auto">
        {brand?.logo_dark_url && (
          <img src={brand.logo_dark_url} alt={org.name} className="h-8 mx-auto mb-4 object-contain" />
        )}
        <p>© {new Date().getFullYear()} {org.name}. Todos os direitos reservados.</p>
        {brand?.tagline && <p className="mt-1 text-xs">{brand.tagline}</p>}
        <p className="mt-3 text-xs opacity-50">
          Desenvolvido com <a href="https://portadocorretor.com.br" target="_blank" rel="noopener" className="underline hover:text-white">Porta do Corretor</a>
        </p>
      </div>
    </footer>
  );
}
