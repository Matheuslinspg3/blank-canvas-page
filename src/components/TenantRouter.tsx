import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useTenantByHostname } from "@/hooks/useTenantByHostname";
import { WhiteLabelStorefront } from "@/components/WhiteLabelStorefront";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { ChunkLoadErrorBoundary } from "@/components/ChunkLoadErrorBoundary";
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

  // Not an external domain — render the normal app
  if (!isExternalDomain) {
    return <>{children}</>;
  }

  if (isLoading) {
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
        </div>
      </div>
    );
  }

  // Check if the path is a property landing page: /imovel/:id
  const imovelMatch = pathname.match(/^\/imovel\/([^/]+)\/?$/);
  if (imovelMatch) {
    return (
      <ChunkLoadErrorBoundary>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <PropertyLandingPage />
        </Suspense>
      </ChunkLoadErrorBoundary>
    );
  }

  // Detect page slug from path for multi-page sites
  // /imoveis → pageSlug='imoveis', /sobre → pageSlug='sobre', /contato → pageSlug='contato'
  const pageMatch = pathname.match(/^\/([a-z0-9-]+)\/?$/);
  const pageSlug = pageMatch ? pageMatch[1] : undefined;

  return <WhiteLabelStorefront organizationId={organizationId} pageSlug={pageSlug} />;
}
