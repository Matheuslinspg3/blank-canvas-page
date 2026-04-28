import { useState, useMemo } from "react";
import type { StorefrontProperty } from "@/hooks/useStorefront";
import { normalizeAccentsKey } from "@/lib/normalizeText";

export interface StorefrontFilterState {
  search: string;
  transactionType: "all" | "venda" | "aluguel";
  minBedrooms: number | null;
  minParking: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  /** Multi-select: cidades selecionadas (display strings). */
  cities: string[];
  /** Multi-select: bairros selecionados (display strings). */
  neighborhoods: string[];
  minArea: number | null;
  maxArea: number | null;
}

const defaultFilters: StorefrontFilterState = {
  search: "",
  transactionType: "all",
  minBedrooms: null,
  minParking: null,
  minPrice: null,
  maxPrice: null,
  cities: [],
  neighborhoods: [],
  minArea: null,
  maxArea: null,
};

export function useStorefrontFilters(properties: StorefrontProperty[]) {
  const [filters, setFilters] = useState<StorefrontFilterState>(defaultFilters);

  const updateFilter = <K extends keyof StorefrontFilterState>(key: K, value: StorefrontFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(defaultFilters);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== "" ||
      filters.transactionType !== "all" ||
      filters.minBedrooms !== null ||
      filters.minParking !== null ||
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.cities.length > 0 ||
      filters.neighborhoods.length > 0 ||
      filters.minArea !== null ||
      filters.maxArea !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.transactionType !== "all") count++;
    if (filters.minBedrooms !== null) count++;
    if (filters.minParking !== null) count++;
    if (filters.minPrice !== null || filters.maxPrice !== null) count++;
    if (filters.cities.length > 0) count++;
    if (filters.neighborhoods.length > 0) count++;
    if (filters.minArea !== null || filters.maxArea !== null) count++;
    return count;
  }, [filters]);

  // Selected cities/neighborhoods as normalized keys (sets) for comparison
  const selectedCityKeys = useMemo(
    () => new Set(filters.cities.map((c) => normalizeAccentsKey(c))),
    [filters.cities],
  );
  const selectedNeighborhoodKeys = useMemo(
    () => new Set(filters.neighborhoods.map((n) => normalizeAccentsKey(n))),
    [filters.neighborhoods],
  );

  // Available cities (deduped by accent key)
  const availableCities = useMemo(() => {
    const map = new Map<string, string>(); // key → preferred display
    properties.forEach((p) => {
      const c = p.address_city?.trim();
      if (!c) return;
      const key = normalizeAccentsKey(c);
      const existing = map.get(key);
      const cHasAccent = key !== c.toLowerCase();
      if (!existing) {
        map.set(key, c);
      } else {
        const existingHasAccent = key !== existing.toLowerCase();
        if (cHasAccent && !existingHasAccent) map.set(key, c);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [properties]);

  const availableNeighborhoods = useMemo(() => {
    const map = new Map<string, string>();
    properties.forEach((p) => {
      const n = p.address_neighborhood?.trim();
      if (!n) return;
      // If cidades selected, only include neighborhoods inside those cities
      if (selectedCityKeys.size > 0) {
        const cKey = normalizeAccentsKey(p.address_city);
        if (!selectedCityKeys.has(cKey)) return;
      }
      const key = normalizeAccentsKey(n);
      const existing = map.get(key);
      const nHasAccent = key !== n.toLowerCase();
      if (!existing) {
        map.set(key, n);
      } else {
        const existingHasAccent = key !== existing.toLowerCase();
        if (nHasAccent && !existingHasAccent) map.set(key, n);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [properties, selectedCityKeys]);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      // Transaction type
      if (filters.transactionType !== "all" && p.transaction_type !== filters.transactionType && p.transaction_type !== "ambos") return false;

      // Text search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matches =
          p.title?.toLowerCase().includes(s) ||
          p.address_city?.toLowerCase().includes(s) ||
          p.address_neighborhood?.toLowerCase().includes(s);
        if (!matches) return false;
      }

      // Bedrooms
      if (filters.minBedrooms !== null && (p.bedrooms == null || p.bedrooms < filters.minBedrooms)) return false;

      // Parking
      if (filters.minParking !== null && (p.parking_spots == null || p.parking_spots < filters.minParking)) return false;

      // Price
      const price = filters.transactionType === "aluguel" ? p.rent_price : (p.sale_price || p.rent_price);
      if (filters.minPrice !== null && (price == null || price < filters.minPrice)) return false;
      if (filters.maxPrice !== null && (price == null || price > filters.maxPrice)) return false;

      // Cities (OR within field, accent-insensitive)
      if (selectedCityKeys.size > 0) {
        const cKey = normalizeAccentsKey(p.address_city);
        if (!selectedCityKeys.has(cKey)) return false;
      }

      // Neighborhoods
      if (selectedNeighborhoodKeys.size > 0) {
        const nKey = normalizeAccentsKey(p.address_neighborhood);
        if (!selectedNeighborhoodKeys.has(nKey)) return false;
      }

      // Area
      if (filters.minArea !== null && (p.area_total == null || p.area_total < filters.minArea)) return false;
      if (filters.maxArea !== null && (p.area_total == null || p.area_total > filters.maxArea)) return false;

      return true;
    });
  }, [properties, filters, selectedCityKeys, selectedNeighborhoodKeys]);

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    filtered,
    availableCities,
    availableNeighborhoods,
  };
}
