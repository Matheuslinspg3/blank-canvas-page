import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StorefrontOrg {
  id: string;
  name: string;
  slug: string;
}

export interface StorefrontBrand {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string | null;
  slogan: string | null;
  tagline: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
}

export interface StorefrontWebsite {
  hero_title: string | null;
  hero_subtitle: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  show_whatsapp_float: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  about_text: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface StorefrontProperty {
  id: string;
  title: string;
  status: string;
  transaction_type: string;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  address_city: string | null;
  address_neighborhood: string | null;
  address_state: string | null;
  images: string[] | null;
  is_featured: boolean;
  created_at: string;
}

export function useStorefront(orgSlug: string | undefined) {
  // 1. Fetch org by slug
  const orgQuery = useQuery({
    queryKey: ["storefront-org", orgSlug],
    enabled: !!orgSlug,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_org_by_slug", { p_slug: orgSlug! });
      if (error) throw error;
      const org = data?.[0];
      if (!org) throw new Error("Organization not found");
      return org as StorefrontOrg;
    },
  });

  const orgId = orgQuery.data?.id;

  // 2. Fetch brand settings
  const brandQuery = useQuery({
    queryKey: ["storefront-brand", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase.rpc as any)("get_public_brand_settings", { p_org_id: orgId! });
      const brand = data?.[0];
      return (brand as StorefrontBrand | null) ?? {
        primary_color: "#3B82F6",
        secondary_color: "#1E293B",
        accent_color: "#F59E0B",
        font_family: "Montserrat",
        slogan: null,
        tagline: null,
        logo_url: null,
        logo_dark_url: null,
      };
    },
  });

  // 3. Fetch website settings
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

  // 4. Check if org has an active subscription that includes the website feature
  const subscriptionQuery = useQuery({
    queryKey: ["storefront-subscription", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan:subscription_plans(slug, features)")
        .eq("organization_id", orgId!)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return { allowed: false };
      const slug = ((data.plan as any)?.slug ?? "").toLowerCase();
      const features = ((data.plan as any)?.features ?? {}) as Record<string, any>;
      // Site completo: only business/enterprise plans or plans with has_website feature
      const allowed = slug.includes("business") || slug.includes("enterprise") || features.has_website === true;
      return { allowed };
    },
  });

  const websiteAllowed = subscriptionQuery.data?.allowed ?? false;

  // 5. Fetch public properties for this org (only if website is allowed)
  const propertiesQuery = useQuery({
    queryKey: ["storefront-properties", orgId],
    enabled: !!orgId && websiteAllowed,
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
    isLoading: orgQuery.isLoading || subscriptionQuery.isLoading,
    notFound: orgQuery.isError || (orgQuery.isFetched && !orgQuery.data) || (subscriptionQuery.isFetched && !websiteAllowed),
  };
}
