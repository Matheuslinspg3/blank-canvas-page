import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";

/**
 * Like useStorefront but resolves by organization_id instead of slug.
 * Used for white-label hostname-based routing.
 */
export function useStorefrontByOrgId(organizationId: string | null) {
  const orgQuery = useQuery({
    queryKey: ["storefront-org-by-id", organizationId],
    enabled: !!organizationId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("id", organizationId!)
        .single();
      if (error) throw error;
      return data as StorefrontOrg;
    },
  });

  const orgId = orgQuery.data?.id;

  const brandQuery = useQuery({
    queryKey: ["storefront-brand", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_settings")
        .select("primary_color, secondary_color, accent_color, font_family, slogan, tagline, logo_url, logo_dark_url")
        .eq("organization_id", orgId!)
        .single();
      return (data as StorefrontBrand | null) ?? {
        primary_color: "#3B82F6", secondary_color: "#1E293B", accent_color: "#F59E0B",
        font_family: "Montserrat", slogan: null, tagline: null, logo_url: null, logo_dark_url: null,
      };
    },
  });

  const websiteQuery = useQuery({
    queryKey: ["storefront-website", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("website_settings")
        .select("hero_title, hero_subtitle, whatsapp_number, whatsapp_message, show_whatsapp_float, contact_email, contact_phone, about_text, meta_title, meta_description")
        .eq("organization_id", orgId!)
        .single();
      return data as StorefrontWebsite | null;
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["storefront-properties", orgId],
    enabled: !!orgId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_properties_public")
        .select("id, title, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, parking_spots, area_total, address_city, address_neighborhood, address_state, images, is_featured, created_at")
        .eq("organization_id", orgId!)
        .eq("status", "disponivel")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as StorefrontProperty[];
    },
  });

  return {
    org: orgQuery.data ?? null,
    brand: brandQuery.data ?? null,
    website: websiteQuery.data ?? null,
    properties: propertiesQuery.data ?? [],
    isLoading: orgQuery.isLoading,
    notFound: orgQuery.isError || (orgQuery.isFetched && !orgQuery.data),
  };
}
