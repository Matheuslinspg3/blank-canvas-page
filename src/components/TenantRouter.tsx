import { useTenantByHostname } from "@/hooks/useTenantByHostname";
import { WhiteLabelStorefront } from "@/components/WhiteLabelStorefront";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

/**
 * If the current hostname matches a tenant domain, render their storefront.
 * Otherwise render the normal app routes.
 */
export function TenantRouter({ children }: Props) {
  const { isExternalDomain, organizationId, isLoading, notFound } = useTenantByHostname();

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

  return <WhiteLabelStorefront organizationId={organizationId} />;
}
