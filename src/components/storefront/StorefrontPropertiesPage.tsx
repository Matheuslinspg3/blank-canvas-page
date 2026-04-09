/**
 * Full-page property listing with advanced filters for the storefront.
 * Renders at /imoveis on multi-page sites.
 */
import { useState, useMemo } from "react";
import { Home } from "lucide-react";
import { useStorefrontFilters } from "@/hooks/useStorefrontFilters";
import { StorefrontFilters } from "@/components/storefront/StorefrontFilters";
import type { StorefrontProperty } from "@/hooks/useStorefront";

interface Props {
  properties: StorefrontProperty[];
  orgName: string;
}

function formatPrice(value: number | null | undefined) {
  if (!value) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function StorefrontPropertiesPage({ properties, orgName }: Props) {
  const {
    filters, updateFilter, clearFilters,
    hasActiveFilters, activeFilterCount,
    filtered, availableCities, availableNeighborhoods,
  } = useStorefrontFilters(properties);

  // Pagination
  const ITEMS_PER_PAGE = 24;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visibleProps = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Imóveis</h1>
          <p className="text-gray-500 mt-1">
            {filtered.length} {filtered.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
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

        {/* Grid */}
        {visibleProps.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Home className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">Nenhum imóvel encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleProps.map((prop) => {
              const imgUrl = prop.images?.[0];
              const price = prop.sale_price || prop.rent_price;
              const slug = prop.id;

              return (
                <a
                  key={prop.id}
                  href={`/imovel/${slug}`}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100 block"
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt={prop.title} className="w-full h-48 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                      <Home className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 truncate">{prop.title}</p>
                    {(prop.address_neighborhood || prop.address_city) && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[prop.address_neighborhood, prop.address_city].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {prop.bedrooms != null && <span>{prop.bedrooms} quartos</span>}
                      {prop.parking_spots != null && <span>{prop.parking_spots} vagas</span>}
                      {prop.area_total != null && <span>{prop.area_total}m²</span>}
                    </div>
                    {price && (
                      <p className="font-bold text-lg mt-2" style={{ color: 'var(--sf-primary, #3B82F6)' }}>
                        {formatPrice(price)}
                      </p>
                    )}
                    {prop.transaction_type && (
                      <span
                        className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: 'var(--sf-primary, #3B82F6)' }}
                      >
                        {prop.transaction_type === 'venda' ? 'Venda' : prop.transaction_type === 'aluguel' ? 'Aluguel' : 'Venda/Aluguel'}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600 px-3">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
