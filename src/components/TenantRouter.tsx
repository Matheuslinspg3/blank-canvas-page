import { lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTenantByHostname } from "@/hooks/useTenantByHostname";
import { WhiteLabelStorefront } from "@/components/WhiteLabelStorefront";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { PropertyLandingBoundary } from "@/components/PropertyLandingBoundary";
import { extractPlatformSlug } from "@/config/platform";

const PropertyLandingPage = lazy(() =>
  lazyWithRetry(() => import("@/pages/PropertyLandingPage"), {
    moduleName: "PropertyLandingPage",
  }),
);

interface Props {
  children: React.ReactNode;
}

/**
 * If the current hostname matches a tenant domain, render their storefront
 * OR the property landing page if the path matches /imovel/:id.
 * For multi-page sites, route /imoveis, /sobre, /contato to the right page.
 * Otherwise render the normal app routes.
 */
export function TenantRouter({ children }: Props) {
  const { isExternalDomain, organizationId, isLoading, notFound } = useTenantByHostname();
  const { pathname } = useLocation();

  // Watchdog: if tenant resolution stays in `isLoading` for too long
  // (e.g. RPC stalls, query stuck), force a graceful exit so the user
  // never sees a perpetual spinner on /imovel/:code etc.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingTimedOut(false); return; }
    const t = setTimeout(() => {
      console.warn("[TenantRouter] tenant resolution watchdog timed out");
      setLoadingTimedOut(true);
    }, 10_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Not an external domain — render the normal app
  if (!isExternalDomain) {
    return <>{children}</>;
  }

  if (isLoading && !loadingTimedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Site não encontrado</h1>
          <p className="text-muted-foreground">Verifique o endereço e tente novamente.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm underline text-primary"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Check if the path is a property landing page: /imovel/:idOrCode
  const imovelMatch = pathname.match(/^\/imovel\/([^/]+)\/?$/);
  if (imovelMatch) {
    const idOrCode = imovelMatch[1];
    // Derive org slug from hostname (platform subdomain). For custom domains the
    // PropertyLandingPage will fall back to resolving by organizationId.
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const orgSlug = extractPlatformSlug(hostname);

    // PropertyLandingPage now auto-detects whether `propIdOverride` is a UUID or a
    // property_code and picks the correct RPC, so we just forward the raw segment.
    return (
      <PropertyLandingBoundary>
        <PropertyLandingPage
          propIdOverride={idOrCode}
          orgSlugOverride={orgSlug ?? undefined}
          organizationIdOverride={organizationId ?? undefined}
        />
      </PropertyLandingBoundary>
    );
  }

  // Detect page slug from path for multi-page sites
  // /imoveis → pageSlug='imoveis', /sobre → pageSlug='sobre', /contato → pageSlug='contato'
  const pageMatch = pathname.match(/^\/([a-z0-9-]+)\/?$/);
  const pageSlug = pageMatch ? pageMatch[1] : undefined;

  return <WhiteLabelStorefront organizationId={organizationId} pageSlug={pageSlug} />;
}
