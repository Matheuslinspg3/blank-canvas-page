import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SiteSettingsTab = lazy(() => import("@/components/settings/SiteSettingsTab"));

export default function SitePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Meu Site"
        description="Configure o conteúdo, aparência e domínio do site da sua imobiliária"
      />
      <div className="relative flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <Button onClick={() => navigate('/site/builder')} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Abrir Editor Visual
            <Badge variant="secondary" className="ml-1 text-[10px]">Beta</Badge>
          </Button>
        </div>
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <SiteSettingsTab />
        </Suspense>
      </div>
    </div>
  );
}
