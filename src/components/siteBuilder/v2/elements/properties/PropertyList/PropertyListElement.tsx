import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Home } from 'lucide-react';
import { usePropertyListContext } from './PropertyListContext';
import { useStorefrontFilters } from '@/hooks/useStorefrontFilters';
import { StorefrontFilters } from '@/components/storefront/StorefrontFilters';

function formatPrice(value: number | null | undefined) {
  if (!value) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function PlaceholderGrid({ cols, items }: { cols: number; items: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: Math.min(items, 6) }).map((_, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="w-full h-32 bg-muted flex items-center justify-center">
            <Home className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="p-3">
            <p className="font-medium text-sm">Imóvel {i + 1}</p>
            <p className="text-xs text-muted-foreground">3 quartos · 120m²</p>
            <p className="font-bold text-sm mt-1">R$ 450.000</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyGrid({ properties, cols }: { properties: any[]; cols: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {properties.map((prop: any) => {
        const imgUrl = prop.images?.[0] || prop.cover_image_url;
        const title = prop.title || prop.name || 'Imóvel';
        const bedrooms = prop.bedrooms;
        const area = prop.area_total || prop.area_util;
        const price = prop.sale_price || prop.rent_price || prop.price;
        const slug = prop.slug || prop.id;

        return (
          <a
            key={prop.id}
            href={`/imovel/${slug}`}
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow block"
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={title}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-40 bg-muted flex items-center justify-center">
                <Home className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="p-3">
              <p className="font-medium text-sm truncate">{title}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  bedrooms ? `${bedrooms} quartos` : null,
                  area ? `${area}m²` : null,
                ].filter(Boolean).join(' · ') || 'Detalhes disponíveis'}
              </p>
              {price && (
                <p className="font-bold text-sm mt-1">{formatPrice(price)}</p>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function PropertyListElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { heading, columns, limit } = element.props;
  const cols = columns || 3;
  const maxItems = limit || 6;
  const properties = usePropertyListContext();

  // In editing mode, show placeholders without filters
  if (isEditing) {
    return (
      <ElementWrapper element={element}>
        {heading && <h3 className="text-xl font-semibold mb-4">{heading}</h3>}
        <PlaceholderGrid cols={cols} items={maxItems} />
      </ElementWrapper>
    );
  }

  // No properties available, show placeholders
  if (!properties || properties.length === 0) {
    return (
      <ElementWrapper element={element}>
        {heading && <h3 className="text-xl font-semibold mb-4">{heading}</h3>}
        <PlaceholderGrid cols={cols} items={maxItems} />
      </ElementWrapper>
    );
  }

  return <PropertyListWithFilters element={element} properties={properties} cols={cols} maxItems={maxItems} heading={heading} />;
}

function PropertyListWithFilters({ element, properties, cols, maxItems, heading }: {
  element: Element;
  properties: any[];
  cols: number;
  maxItems: number;
  heading?: string;
}) {
  const {
    filters, updateFilter, clearFilters,
    hasActiveFilters, activeFilterCount,
    filtered, availableCities, availableNeighborhoods,
  } = useStorefrontFilters(properties);

  // When filters are active, show all matching results; otherwise cap at maxItems
  const visibleProps = hasActiveFilters ? filtered : filtered.slice(0, maxItems);

  return (
    <ElementWrapper element={element}>
      {heading && <h3 className="text-xl font-semibold mb-4">{heading}</h3>}
      <div className="mb-6">
        <StorefrontFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          availableCities={availableCities}
          availableNeighborhoods={availableNeighborhoods}
        />
      </div>
      {visibleProps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Nenhum imóvel encontrado</p>
          <p className="text-sm">Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <PropertyGrid properties={visibleProps} cols={cols} />
      )}
    </ElementWrapper>
  );
}
