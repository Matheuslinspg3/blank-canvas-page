import type { PropertyCarouselABlock, SiteTheme, PropertySummary } from '@/types/siteBuilder';

interface Props {
  block: PropertyCarouselABlock;
  theme: SiteTheme;
  properties?: PropertySummary[];
}

function formatPrice(value: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export function PropertyCarouselA({ block, theme, properties = [] }: Props) {
  const { title, subtitle, maxItems } = block.props;
  const items = properties.slice(0, maxItems || 8);

  return (
    <section className="py-16 px-4" style={{ fontFamily: theme.fontFamily } as React.CSSProperties}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-3" style={{ color: theme.primaryColor }}>{title}</h2>
          {subtitle && <p className="text-base md:text-lg text-gray-600">{subtitle}</p>}
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {items.length === 0 ? (
            <p className="text-center text-gray-400 w-full">Nenhum imóvel disponível.</p>
          ) : (
            items.map((p) => (
              <div key={p.id} className="snap-start flex-shrink-0 w-72 rounded-xl overflow-hidden shadow-md bg-white">
                <div className="aspect-video bg-gray-200 relative overflow-hidden">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.title || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sem foto</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1 line-clamp-1">{p.title || 'Imóvel'}</h3>
                  <p className="text-sm text-gray-500 mb-2">{[p.address_neighborhood, p.address_city].filter(Boolean).join(', ')}</p>
                  <p className="font-bold" style={{ color: theme.primaryColor }}>
                    {formatPrice(p.sale_price) || formatPrice(p.rent_price) || 'Consulte'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
