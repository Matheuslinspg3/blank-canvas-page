import { useState, useMemo } from "react";
import type { StorefrontProperty } from "@/hooks/useStorefront";

export interface StorefrontFilterState {
  search: string;
  transactionType: "all" | "venda" | "aluguel";
  minBedrooms: number | null;
  minParking: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  city: string;
  neighborhood: string;
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
  city: "",
  neighborhood: "",
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
      filters.city !== "" ||
      filters.neighborhood !== "" ||
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
    if (filters.city !== "") count++;
    if (filters.neighborhood !== "") count++;
    if (filters.minArea !== null || filters.maxArea !== null) count++;
    return count;
  }, [filters]);

  // Extract unique cities and neighborhoods from properties
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    properties.forEach((p) => { if (p.address_city) cities.add(p.address_city); });
    return Array.from(cities).sort();
  }, [properties]);

  const availableNeighborhoods = useMemo(() => {
    const neighborhoods = new Set<string>();
    properties.forEach((p) => {
      if (p.address_neighborhood) {
        if (!filters.city || p.address_city === filters.city) {
          neighborhoods.add(p.address_neighborhood);
        }
      }
    });
    return Array.from(neighborhoods).sort();
  }, [properties, filters.city]);

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

      // City
      if (filters.city && p.address_city !== filters.city) return false;

      // Neighborhood
      if (filters.neighborhood && p.address_neighborhood !== filters.neighborhood) return false;

      // Area
      if (filters.minArea !== null && (p.area_total == null || p.area_total < filters.minArea)) return false;
      if (filters.maxArea !== null && (p.area_total == null || p.area_total > filters.maxArea)) return false;

      return true;
    });
  }, [properties, filters]);

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
