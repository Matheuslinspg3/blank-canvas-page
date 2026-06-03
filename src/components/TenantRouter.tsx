import { lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTenantByHostname } from "@/hooks/useTenantByHostname";
import { WhiteLabelStorefront } from "@/components/WhiteLabelStorefront";
import { StorefrontErrorBoundary } from "@/components/storefront/StorefrontErrorBoundary";
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
  const { isExternalDomain, organizationId, isLoading, notFound, error, isTransientError } = useTenantByHostname();
  const { pathname } = useLocation();

  // Watchdog: if tenant resolution stays in `isLoading` for too long, allow
  // user to manually retry. We DO NOT auto-render "site not found" because
  // the query may still be in-flight — only `notFound` (or a hard error) does that.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingTimedOut(false); return; }
    const t = setTimeout(() => {
      console.warn("[TenantRouter] tenant resolution watchdog timed out");
      setLoadingTimedOut(true);
    }, 20_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Not an external domain — render the normal app
  if (!isExternalDomain) {
    return <>{children}</>;
  }

  if (isLoading || isTransientError) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {(loadingTimedOut || isTransientError) && (
          <div className="text-center px-4">
            <p className="text-sm text-muted-foreground mb-3">Carregando o site...</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm underline text-primary"
            >
              Está demorando — tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  }

  if (notFound || (error && !isTransientError) || !organizationId) {
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

  return (
    <StorefrontErrorBoundary>
      <WhiteLabelStorefront organizationId={organizationId} pageSlug={pageSlug} />
    </StorefrontErrorBoundary>
  );
}
