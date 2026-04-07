import { useMemo } from "react";
import type { StorefrontProperty } from "@/hooks/useStorefront";
import { Building, Bed, Bath, Car, Maximize, Star } from "lucide-react";
import { useStorefrontFilters } from "@/hooks/useStorefrontFilters";
import { StorefrontFilters } from "@/components/storefront/StorefrontFilters";

interface Props {
  properties: StorefrontProperty[];
  primaryColor: string;
  orgSlug: string;
}

function formatPrice(value: number | null) {
  if (!value) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function StorefrontProperties({ properties, primaryColor, orgSlug }: Props) {
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, filtered, availableCities, availableNeighborhoods } = useStorefrontFilters(properties);

  return (
    <section id="imoveis" className="py-16 px-6 max-w-7xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Nossos Imóveis</h2>

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
          primaryColor={primaryColor}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhum imóvel encontrado</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <StorefrontPropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={orgSlug} />
          ))}
        </div>
      )}
    </section>
  );
}

function StorefrontPropertyCard({ property: p, primaryColor, orgSlug }: { property: StorefrontProperty; primaryColor: string; orgSlug: string }) {
  const img = p.images?.[0];
  const price =
    p.transaction_type === "aluguel"
      ? formatPrice(p.rent_price)
      : formatPrice(p.sale_price);
  const priceLabel = p.transaction_type === "aluguel" ? "/mês" : "";

  return (
    <a
      href={`/i/${orgSlug}/${p.id}`}
      className="group block rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] bg-gray-100">
        {img ? (
          <img src={img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Building className="h-10 w-10 text-gray-300" />
          </div>
        )}
        {p.is_featured && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: primaryColor }}>
            <Star className="h-3 w-3" /> Destaque
          </span>
        )}
        <span className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-700">
          {p.transaction_type === "aluguel" ? "Aluguel" : p.transaction_type === "venda" ? "Venda" : "Venda/Aluguel"}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
        {(p.address_neighborhood || p.address_city) && (
          <p className="text-sm text-gray-500 mt-1 truncate">
            {[p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(", ")}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {p.bedrooms != null && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
          {p.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>}
          {p.parking_spots != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {p.parking_spots}</span>}
          {p.area_total != null && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.area_total}m²</span>}
        </div>

        {price && (
          <p className="mt-3 text-lg font-bold" style={{ color: primaryColor }}>
            {price}<span className="text-sm font-normal text-gray-500">{priceLabel}</span>
          </p>
        )}
      </div>
    </a>
  );
}
