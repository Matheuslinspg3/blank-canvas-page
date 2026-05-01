import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicBranding {
  enabled: boolean;
  orgId: string | null;
  orgName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  slogan: string | null;
}

const EMPTY: PublicBranding = {
  enabled: false,
  orgId: null,
  orgName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  fontFamily: null,
  slogan: null,
};

function hexToHSL(hex: string): string | null {
  if (!hex) return null;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    return null;
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const WL_VARS = [
  "--primary",
  "--accent",
  "--secondary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
] as const;

/**
 * Public branding hook for anonymous visitors on custom domains / platform subdomains.
 *
 * Unlike `useWhiteLabel`, this does NOT depend on `useAuth` — it resolves brand
 * directly from the organization id passed by `TenantRouter`. It applies the
 * brand colors to `document.documentElement` and returns logo / orgName so the
 * landing page can swap favicon and header logo.
 */
export function usePublicBranding(organizationId: string | null | undefined): PublicBranding {
  const { data } = useQuery({
    queryKey: ["public-branding", organizationId],
    enabled: !!organizationId,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async (): Promise<PublicBranding> => {
      const [orgRes, brandRes] = await Promise.all([
        (supabase.rpc as any)("get_public_org_by_id", { p_org_id: organizationId! }),
        (supabase.rpc as any)("get_public_brand_settings", { p_org_id: organizationId! }),
      ]);
      const org = Array.isArray(orgRes.data) ? orgRes.data[0] : orgRes.data;
      const brand = Array.isArray(brandRes.data) ? brandRes.data[0] : brandRes.data;
      if (!org && !brand) return EMPTY;
      return {
        enabled: true,
        orgId: organizationId!,
        orgName: org?.name ?? null,
        logoUrl: brand?.logo_url ?? null,
        faviconUrl: brand?.logo_url ?? null,
        primaryColor: brand?.primary_color ?? null,
        secondaryColor: brand?.secondary_color ?? null,
        accentColor: brand?.accent_color ?? null,
        fontFamily: brand?.font_family ?? null,
        slogan: brand?.slogan ?? null,
      };
    },
  });

  const config = data ?? EMPTY;

  useEffect(() => {
    const root = document.documentElement;
    if (!config.enabled) {
      WL_VARS.forEach((v) => root.style.removeProperty(v));
      return;
    }
    const primaryHSL = hexToHSL(config.primaryColor || "");
    const accentHSL = hexToHSL(config.accentColor || "");
    const secondaryHSL = hexToHSL(config.secondaryColor || "");

    if (primaryHSL) root.style.setProperty("--primary", primaryHSL);
    if (accentHSL) {
      root.style.setProperty("--accent", accentHSL);
      root.style.setProperty("--ring", accentHSL);
      root.style.setProperty("--sidebar-primary", accentHSL);
      root.style.setProperty("--sidebar-ring", accentHSL);
    }
    if (secondaryHSL) root.style.setProperty("--secondary", secondaryHSL);

    return () => {
      WL_VARS.forEach((v) => root.style.removeProperty(v));
    };
  }, [config.enabled, config.primaryColor, config.accentColor, config.secondaryColor]);

  return config;
}
