import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/withTimeout";
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";

const RPC_TIMEOUT_MS = 8_000;

const DEFAULT_BRAND: StorefrontBrand = {
  primary_color: "#3B82F6", secondary_color: "#1E293B", accent_color: "#F59E0B",
  font_family: "Montserrat", slogan: null, tagline: null, logo_url: null, logo_dark_url: null,
};

/**
 * Like useStorefront but resolves by organization_id instead of slug.
 * Used for white-label hostname-based routing.
 *
 * Critical-path queries (org, brand, website) have 8s timeouts and
 * `refetchOnMount: false` to keep the public site fast and predictable.
 * The properties query is non-blocking — sections render skeletons.
 */
export function useStorefrontByOrgId(organizationId: string | null) {
  const orgQuery = useQuery({
    queryKey: ["storefront-org-by-id", organizationId],
    enabled: !!organizationId,
    staleTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withTimeout<any>(
        (supabase.rpc as any)("get_public_org_by_id", { p_org_id: organizationId! }),
        RPC_TIMEOUT_MS,
        "get_public_org_by_id",
      );
      if (error) throw error;
      const org = data?.[0];
      if (!org) throw new Error("Organization not found");
      return org as StorefrontOrg;
    },
  });

  const orgId = orgQuery.data?.id;

  const brandQuery = useQuery({
    queryKey: ["storefront-brand", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await withTimeout<any>(
        (supabase.rpc as any)("get_public_brand_settings", { p_org_id: orgId! }),
        RPC_TIMEOUT_MS,
        "get_public_brand_settings",
      );
      const brand = data?.[0];
      return (brand as StorefrontBrand | null) ?? DEFAULT_BRAND;
    },
    placeholderData: DEFAULT_BRAND,
  });

  const websiteQuery = useQuery({
    queryKey: ["storefront-website", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await withTimeout<any>(
        Promise.resolve(
          supabase
            .from("website_settings")
            .select("hero_title, hero_subtitle, whatsapp_number, whatsapp_message, show_whatsapp_float, contact_email, contact_phone, about_text, meta_title, meta_description, site_template")
            .eq("organization_id", orgId!)
            .single()
        ),
        RPC_TIMEOUT_MS,
        "website_settings",
      );
      return data as StorefrontWebsite | null;
    },
  });

  // Properties: non-blocking. Sections show skeletons until ready.
  const propertiesQuery = useQuery({
    queryKey: ["storefront-properties", orgId],
    enabled: !!orgId,
    staleTime: 3 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: [] as StorefrontProperty[],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_properties_public")
        .select("id, title, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, parking_spots, area_total, address_city, address_neighborhood, address_state, images, is_featured, created_at")
        .eq("organization_id", orgId!)
        .eq("status", "disponivel")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as StorefrontProperty[];
    },
  });

  return {
    org: orgQuery.data ?? null,
    brand: brandQuery.data ?? null,
    website: websiteQuery.data ?? null,
    properties: propertiesQuery.data ?? [],
    // Only block on org resolution — brand/website/properties hydrate progressively.
    isLoading: orgQuery.isLoading,
    notFound: orgQuery.isError || (orgQuery.isFetched && !orgQuery.data),
  };
}
