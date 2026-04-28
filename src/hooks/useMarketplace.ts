import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useMemo } from "react";
import { type MarketplaceFiltersState, defaultMarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { normalizeAccentsKey } from "@/lib/normalizeText";

/**
 * Expands a list of selected display values to ALL variants that share the same
 * accent-normalized key. Ensures that selecting "Mongaguá" also matches rows
 * stored as "Mongagua" (without accent).
 */
function expandAccentVariants(
  selected: string[],
  variantsMap: Record<string, string[]> | undefined,
): string[] {
  if (!selected.length) return [];
  if (!variantsMap) return selected;
  const out = new Set<string>();
  for (const sel of selected) {
    const key = normalizeAccentsKey(sel);
    const variants = variantsMap[key] ?? [sel];
    variants.forEach((v) => out.add(v));
  }
  return Array.from(out);
}

export interface MarketplaceProperty {
  id: string;
  external_code: string | null;
  title: string;
  description: string | null;
  property_type_id: string | null;
  transaction_type: 'venda' | 'aluguel' | 'ambos';
  sale_price: number | null;
  sale_price_financed: number | null;
  rent_price: number | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipcode: string | null;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking_spots: number;
  area_total: number | null;
  area_built: number | null;
  amenities: string[] | null;
  payment_options: string[] | null;
  images: string[] | null;
  status: 'disponivel' | 'reservado' | 'vendido' | 'alugado' | 'inativo';
  is_featured: boolean;
  created_at: string;
  organization_id: string | null;
  marketplace_contact_phone: string | null;
  marketplace_contact_phone_source: 'organization' | 'owner' | 'custom' | null;
}

interface MarketplaceViewRow {
  address_city?: string | null;
  address_neighborhood?: string | null;
  property_type_id?: string | null;
  amenities?: string[] | null;
  organization_id?: string | null;
}

export function useMarketplace(filters: MarketplaceFiltersState) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const applyFilters = useCallback((q: any) => {
    let query = q.eq("status", "disponivel");
    if (organizationId) query = query.neq("organization_id", organizationId);
    if (filters.transactionType && filters.transactionType !== "all") query = query.eq("transaction_type", filters.transactionType);
    if (filters.propertyTypeId && filters.propertyTypeId !== "all") query = query.eq("property_type_id", filters.propertyTypeId);
    if (filters.city) query = query.ilike("address_city", `%${filters.city}%`);
    if (filters.neighborhood) query = query.ilike("address_neighborhood", `%${filters.neighborhood}%`);
    if (filters.minPrice) query = query.or(`sale_price.gte.${filters.minPrice},rent_price.gte.${filters.minPrice}`);
    if (filters.maxPrice) query = query.or(`sale_price.lte.${filters.maxPrice},rent_price.lte.${filters.maxPrice}`);
    if (filters.minBedrooms) query = query.gte("bedrooms", filters.minBedrooms);
    if (filters.minSuites) query = query.gte("suites", filters.minSuites);
    if (filters.minBathrooms) query = query.gte("bathrooms", filters.minBathrooms);
    if (filters.minParking) query = query.gte("parking_spots", filters.minParking);
    if (filters.minArea) query = query.gte("area_total", filters.minArea);
    if (filters.maxArea) query = query.lte("area_total", filters.maxArea);
    if (filters.featured) query = query.eq("is_featured", true);
    if (filters.amenities.length > 0) query = query.contains("amenities", filters.amenities);
    return query;
  }, [organizationId, filters]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["marketplace-properties", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let dataQuery = applyFilters(
        supabase.from("marketplace_properties_public")
          .select("id, title, description, status, transaction_type, sale_price, sale_price_financed, rent_price, bedrooms, suites, bathrooms, parking_spots, area_total, area_built, address_city, address_neighborhood, address_state, images, amenities, payment_options, is_featured, organization_id, property_type_id, marketplace_contact_phone, marketplace_contact_phone_source, created_at")
      )
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .range(0, 999);

      let countQuery = applyFilters(
        supabase.from("marketplace_properties_public")
          .select("id", { count: "exact", head: true })
      );

      const [dataResult, countResult] = await Promise.all([dataQuery, countQuery]);
      if (dataResult.error) throw dataResult.error;
      const totalCount = countResult.count ?? dataResult.data?.length ?? 0;

      return { properties: (dataResult.data as unknown) as MarketplaceProperty[], totalCount };
    },
    enabled: !!organizationId,
  });

  const properties = data?.properties ?? [];
  const totalCount = data?.totalCount ?? 0;

  const logContactAccess = async (propertyId: string) => {
    if (!organizationId || !profile?.user_id) return;
    await supabase.from("marketplace_contact_access").insert({
      user_id: profile.user_id,
      organization_id: organizationId,
      marketplace_property_id: propertyId,
    });
  };

  return { properties, isLoading, isFetching, error, totalCount, logContactAccess };
}

export interface MarketplaceOrgInfo {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string;
}

export function useMarketplaceOrganizations(orgIds: string[]) {
  return useQuery({
    queryKey: ["marketplace-org-info", orgIds],
    queryFn: async () => {
      if (orgIds.length === 0) return [] as MarketplaceOrgInfo[];
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, logo_url, slug")
        .in("id", orgIds);
      if (error) throw error;
      return (data ?? []) as MarketplaceOrgInfo[];
    },
    enabled: orgIds.length > 0,
    staleTime: 120000,
  });
}

export function useMarketplaceFilterData(cityFilter?: string) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const { data: cities = [] } = useQuery({
    queryKey: ["marketplace-cities", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public")
        .select("address_city")
        .eq("status", "disponivel")
        .not("address_city", "is", null);
      if (organizationId) query = query.neq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;
      const cityMap = new Map<string, { display: string; count: number }>();
      (data as MarketplaceViewRow[]).forEach((d) => {
        const city = (d.address_city as string | null)?.trim();
        if (city) {
          const key = normalizeAccentsKey(city);
          if (!key) return;
          const existing = cityMap.get(key);
          if (existing) {
            existing.count++;
            // Prefere a grafia com acento como display
            const displayHasAccent = normalizeAccentsKey(existing.display) !== existing.display.toLowerCase();
            const cityHasAccent = key !== city.toLowerCase();
            if (cityHasAccent && !displayHasAccent) existing.display = city;
          } else {
            cityMap.set(key, { display: city, count: 1 });
          }
        }
      });
      return Array.from(cityMap.values())
        .map(({ display, count }) => ({ city: display, count }))
        .sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["marketplace-neighborhoods-filter", organizationId, cityFilter],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public")
        .select("address_neighborhood")
        .eq("status", "disponivel")
        .not("address_neighborhood", "is", null);
      if (organizationId) query = query.neq("organization_id", organizationId);
      if (cityFilter) query = query.ilike("address_city", `%${cityFilter}%`);
      const { data, error } = await query;
      if (error) throw error;
      const neighMap = new Map<string, { display: string; count: number }>();
      (data as MarketplaceViewRow[]).forEach((d) => {
        const n = (d.address_neighborhood as string | null)?.trim();
        if (n) {
          const key = normalizeAccentsKey(n);
          if (!key) return;
          const existing = neighMap.get(key);
          if (existing) {
            existing.count++;
            const displayHasAccent = normalizeAccentsKey(existing.display) !== existing.display.toLowerCase();
            const nHasAccent = key !== n.toLowerCase();
            if (nHasAccent && !displayHasAccent) existing.display = n;
          } else {
            neighMap.set(key, { display: n, count: 1 });
          }
        }
      });
      return Array.from(neighMap.values())
        .map(({ display, count }) => ({ neighborhood: display, count }))
        .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, 'pt-BR'));
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["marketplace-property-types", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public")
        .select("property_type_id")
        .eq("status", "disponivel")
        .not("property_type_id", "is", null);
      if (organizationId) query = query.neq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;
      const typeIds = [...new Set((data as MarketplaceViewRow[]).map((d) => d.property_type_id).filter(Boolean))] as string[];
      if (typeIds.length === 0) return [];
      const { data: types, error: typesError } = await supabase
        .from("property_types")
        .select("id, name")
        .in("id", typeIds)
        .order("name");
      if (typesError) throw typesError;
      return types || [];
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: availableAmenities = [] } = useQuery({
    queryKey: ["marketplace-amenities", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public")
        .select("amenities")
        .eq("status", "disponivel")
        .not("amenities", "is", null);
      if (organizationId) query = query.neq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;
      const allAmenities = new Set<string>();
      (data as MarketplaceViewRow[]).forEach((d) => {
        if (d.amenities) d.amenities.forEach((a: string) => allAmenities.add(a));
      });
      return Array.from(allAmenities).sort();
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  return { cities, neighborhoods, propertyTypes, availableAmenities };
}
