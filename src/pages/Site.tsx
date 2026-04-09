import { lazy, Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Loader2 } from "lucide-react";

const SiteSettingsTab = lazy(() => import("@/components/settings/SiteSettingsTab"));

export default function SitePage() {
  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Meu Site"
        description="Configure o conteúdo, aparência e domínio do site da sua imobiliária"
      />
      <div className="relative flex-1 p-4 sm:p-6">
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <SiteSettingsTab />
        </Suspense>
      </div>
    </div>
  );
}
