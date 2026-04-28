/**
 * Consumer-friendly property filters for the public storefront.
 * Mirrors the system's advanced filters but with a friendlier UI for end users.
 */
import { useState } from "react";
import { Search, SlidersHorizontal, X, Bed, Car, MapPin, Ruler, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { StorefrontFilterState } from "@/hooks/useStorefrontFilters";

interface StorefrontFiltersProps {
  filters: StorefrontFilterState;
  onUpdateFilter: <K extends keyof StorefrontFilterState>(key: K, value: StorefrontFilterState[K]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  availableCities: string[];
  availableNeighborhoods: string[];
  primaryColor?: string;
}

function formatPriceBR(value: number | null) {
  if (!value) return "";
  return value.toLocaleString("pt-BR");
}

function parsePriceBR(value: string): number | null {
  const cleaned = value.replace(/\D/g, "");
  return cleaned ? Number(cleaned) : null;
}

export function StorefrontFilters({
  filters,
  onUpdateFilter,
  onClearFilters,
  hasActiveFilters,
  activeFilterCount,
  availableCities,
  availableNeighborhoods,
  primaryColor,
}: StorefrontFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const numericOptions = [
    { value: null, label: "Todos" },
    { value: 1, label: "1+" },
    { value: 2, label: "2+" },
    { value: 3, label: "3+" },
    { value: 4, label: "4+" },
  ];

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Transaction Type + Advanced Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por cidade, bairro, título..."
            value={filters.search}
            onChange={(e) => onUpdateFilter("search", e.target.value)}
            className="pl-9 border-gray-200 bg-white h-11 rounded-lg"
          />
        </div>

        {/* Transaction type toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          {(["all", "venda", "aluguel"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onUpdateFilter("transactionType", f)}
              className="px-4 py-2 text-sm rounded-md font-medium transition-colors"
              style={{
                backgroundColor: filters.transactionType === f ? primaryColor : "transparent",
                color: filters.transactionType === f ? "#fff" : "#6b7280",
              }}
            >
              {f === "all" ? "Todos" : f === "venda" ? "Venda" : "Aluguel"}
            </button>
          ))}
        </div>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors shrink-0"
          style={{
            borderColor: activeFilterCount > 0 ? primaryColor : "#e5e7eb",
            backgroundColor: activeFilterCount > 0 ? `${primaryColor}10` : "white",
            color: activeFilterCount > 0 ? primaryColor : "#6b7280",
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span
              className="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2: Advanced filters panel */}
      {showAdvanced && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Filtros avançados</h4>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Bedrooms */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Bed className="h-3.5 w-3.5" /> Quartos
              </label>
              <div className="flex gap-0.5 bg-gray-50 rounded-lg p-0.5">
                {numericOptions.map((opt) => (
                  <button
                    key={opt.value ?? "all"}
                    onClick={() => onUpdateFilter("minBedrooms", opt.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded-md font-medium transition-colors"
                    style={{
                      backgroundColor: filters.minBedrooms === opt.value ? primaryColor : "transparent",
                      color: filters.minBedrooms === opt.value ? "#fff" : "#6b7280",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parking */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Car className="h-3.5 w-3.5" /> Vagas
              </label>
              <div className="flex gap-0.5 bg-gray-50 rounded-lg p-0.5">
                {numericOptions.map((opt) => (
                  <button
                    key={opt.value ?? "all"}
                    onClick={() => onUpdateFilter("minParking", opt.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded-md font-medium transition-colors"
                    style={{
                      backgroundColor: filters.minParking === opt.value ? primaryColor : "transparent",
                      color: filters.minParking === opt.value ? "#fff" : "#6b7280",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cities (multi-select) */}
            {availableCities.length > 0 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <MapPin className="h-3.5 w-3.5" /> Cidades
                </label>
                <MultiSelectFilter
                  value={filters.cities}
                  onChange={(next) => {
                    onUpdateFilter("cities", next);
                    // Clear neighborhoods that no longer belong to selected cities
                    if (next.length > 0 && filters.neighborhoods.length > 0) {
                      // simple safe path: if cities changed, reset neighborhoods
                      onUpdateFilter("neighborhoods", []);
                    }
                  }}
                  options={availableCities.map((c) => ({ value: c, label: c }))}
                  triggerLabel="Cidades"
                  placeholder="Todas as cidades"
                  triggerClassName="w-full h-9"
                />
              </div>
            )}

            {/* Neighborhoods (multi-select) */}
            {availableNeighborhoods.length > 0 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <MapPin className="h-3.5 w-3.5" /> Bairros
                </label>
                <MultiSelectFilter
                  value={filters.neighborhoods}
                  onChange={(next) => onUpdateFilter("neighborhoods", next)}
                  options={availableNeighborhoods.map((n) => ({ value: n, label: n }))}
                  triggerLabel="Bairros"
                  placeholder="Todos os bairros"
                  triggerClassName="w-full h-9"
                />
              </div>
            )}

            {/* Price range */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <DollarSign className="h-3.5 w-3.5" /> Preço mínimo
              </label>
              <Input
                type="text"
                placeholder="R$ 0"
                value={formatPriceBR(filters.minPrice)}
                onChange={(e) => onUpdateFilter("minPrice", parsePriceBR(e.target.value))}
                className="h-9 border-gray-200 bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <DollarSign className="h-3.5 w-3.5" /> Preço máximo
              </label>
              <Input
                type="text"
                placeholder="Sem limite"
                value={formatPriceBR(filters.maxPrice)}
                onChange={(e) => onUpdateFilter("maxPrice", parsePriceBR(e.target.value))}
                className="h-9 border-gray-200 bg-white text-sm"
              />
            </div>

            {/* Area range */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Ruler className="h-3.5 w-3.5" /> Área mín. (m²)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minArea ?? ""}
                onChange={(e) => onUpdateFilter("minArea", e.target.value ? Number(e.target.value) : null)}
                className="h-9 border-gray-200 bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Ruler className="h-3.5 w-3.5" /> Área máx. (m²)
              </label>
              <Input
                type="number"
                placeholder="Sem limite"
                value={filters.maxArea ?? ""}
                onChange={(e) => onUpdateFilter("maxArea", e.target.value ? Number(e.target.value) : null)}
                className="h-9 border-gray-200 bg-white text-sm"
              />
            </div>
          </div>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
              {filters.transactionType !== "all" && (
                <FilterBadge label={filters.transactionType === "venda" ? "Venda" : "Aluguel"} onRemove={() => onUpdateFilter("transactionType", "all")} primaryColor={primaryColor} />
              )}
              {filters.minBedrooms !== null && (
                <FilterBadge label={`${filters.minBedrooms}+ quartos`} onRemove={() => onUpdateFilter("minBedrooms", null)} primaryColor={primaryColor} />
              )}
              {filters.minParking !== null && (
                <FilterBadge label={`${filters.minParking}+ vagas`} onRemove={() => onUpdateFilter("minParking", null)} primaryColor={primaryColor} />
              )}
              {filters.city && (
                <FilterBadge label={filters.city} onRemove={() => { onUpdateFilter("city", ""); onUpdateFilter("neighborhood", ""); }} primaryColor={primaryColor} />
              )}
              {filters.neighborhood && (
                <FilterBadge label={filters.neighborhood} onRemove={() => onUpdateFilter("neighborhood", "")} primaryColor={primaryColor} />
              )}
              {(filters.minPrice !== null || filters.maxPrice !== null) && (
                <FilterBadge
                  label={`R$ ${formatPriceBR(filters.minPrice) || "0"} - ${formatPriceBR(filters.maxPrice) || "∞"}`}
                  onRemove={() => { onUpdateFilter("minPrice", null); onUpdateFilter("maxPrice", null); }}
                  primaryColor={primaryColor}
                />
              )}
              {(filters.minArea !== null || filters.maxArea !== null) && (
                <FilterBadge
                  label={`${filters.minArea || 0}m² - ${filters.maxArea || "∞"}m²`}
                  onRemove={() => { onUpdateFilter("minArea", null); onUpdateFilter("maxArea", null); }}
                  primaryColor={primaryColor}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline badges when panel is closed */}
      {!showAdvanced && hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filters.transactionType !== "all" && (
            <FilterBadge label={filters.transactionType === "venda" ? "Venda" : "Aluguel"} onRemove={() => onUpdateFilter("transactionType", "all")} primaryColor={primaryColor} />
          )}
          {filters.minBedrooms !== null && (
            <FilterBadge label={`${filters.minBedrooms}+ quartos`} onRemove={() => onUpdateFilter("minBedrooms", null)} primaryColor={primaryColor} />
          )}
          {filters.minParking !== null && (
            <FilterBadge label={`${filters.minParking}+ vagas`} onRemove={() => onUpdateFilter("minParking", null)} primaryColor={primaryColor} />
          )}
          {filters.city && (
            <FilterBadge label={filters.city} onRemove={() => { onUpdateFilter("city", ""); onUpdateFilter("neighborhood", ""); }} primaryColor={primaryColor} />
          )}
          {filters.neighborhood && (
            <FilterBadge label={filters.neighborhood} onRemove={() => onUpdateFilter("neighborhood", "")} primaryColor={primaryColor} />
          )}
          {(filters.minPrice !== null || filters.maxPrice !== null) && (
            <FilterBadge
              label={`R$ ${formatPriceBR(filters.minPrice) || "0"} - ${formatPriceBR(filters.maxPrice) || "∞"}`}
              onRemove={() => { onUpdateFilter("minPrice", null); onUpdateFilter("maxPrice", null); }}
              primaryColor={primaryColor}
            />
          )}
          {(filters.minArea !== null || filters.maxArea !== null) && (
            <FilterBadge
              label={`${filters.minArea || 0}m² - ${filters.maxArea || "∞"}m²`}
              onRemove={() => { onUpdateFilter("minArea", null); onUpdateFilter("maxArea", null); }}
              primaryColor={primaryColor}
            />
          )}
          <button onClick={onClearFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}

function FilterBadge({ label, onRemove, primaryColor }: { label: string; onRemove: () => void; primaryColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
    >
      {label}
      <X className="h-3 w-3 cursor-pointer hover:opacity-70" onClick={onRemove} />
    </span>
  );
}
