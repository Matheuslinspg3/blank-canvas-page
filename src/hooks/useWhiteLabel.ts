import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, hasFeature } from "@/hooks/useSubscription";

export interface WhiteLabelConfig {
  enabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  orgName: string | null;
  slogan: string | null;
}

const DEFAULT_CONFIG: WhiteLabelConfig = {
  enabled: false,
  primaryColor: "#D62828",
  secondaryColor: "#1E3A5F",
  accentColor: "#F77F00",
  fontFamily: null,
  logoUrl: null,
  logoDarkUrl: null,
  orgName: null,
  slogan: null,
};

function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
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

export function useWhiteLabel(): WhiteLabelConfig & { isLoading: boolean; planAllowsWhiteLabel: boolean } {
  const { profile } = useAuth();
  const { currentPlan } = useSubscription();
  const orgId = profile?.organization_id;

  const planAllowsWhiteLabel = useMemo(() => {
    if (!currentPlan) return false;
    const slug = (currentPlan.slug || "").toLowerCase();
    return slug.includes("enterprise") || slug.includes("business");
  }, [currentPlan]);

  const { data, isLoading } = useQuery({
    queryKey: ["white-label", orgId],
    enabled: !!orgId && planAllowsWhiteLabel,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: brand } = await supabase
        .from("brand_settings")
        .select("primary_color, secondary_color, accent_color, font_family, logo_url, logo_dark_url, slogan, white_label_enabled")
        .eq("organization_id", orgId!)
        .single();
      if (!brand || !(brand as any).white_label_enabled) return null;

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId!)
        .single();

      return {
        enabled: true,
        primaryColor: (brand as any).primary_color || DEFAULT_CONFIG.primaryColor,
        secondaryColor: (brand as any).secondary_color || DEFAULT_CONFIG.secondaryColor,
        accentColor: (brand as any).accent_color || DEFAULT_CONFIG.accentColor,
        fontFamily: (brand as any).font_family,
        logoUrl: (brand as any).logo_url,
        logoDarkUrl: (brand as any).logo_dark_url,
        orgName: org?.name || null,
        slogan: (brand as any).slogan,
      } satisfies WhiteLabelConfig;
    },
  });

  const config = data ?? DEFAULT_CONFIG;

  // Apply CSS variables when white-label is active
  useEffect(() => {
    if (!config.enabled) {
      // Remove any custom overrides
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
      document.documentElement.style.removeProperty("--accent");
      return;
    }

    const root = document.documentElement;
    root.style.setProperty("--primary", hexToHSL(config.primaryColor));
    root.style.setProperty("--accent", hexToHSL(config.accentColor));

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent");
    };
  }, [config.enabled, config.primaryColor, config.accentColor]);

  return { ...config, isLoading, planAllowsWhiteLabel };
}
