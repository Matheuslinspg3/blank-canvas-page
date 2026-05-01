import { useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { InactiveLeadsList } from "@/components/crm/InactiveLeadsList";
import { WhatsAppTemplates } from "@/components/crm/WhatsAppTemplates";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLeads } from "@/hooks/useLeads";
import { useTabParam } from "@/hooks/useTabParam";
import { useScreenTime } from "@/hooks/useAnalytics";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { DEVELOPER_ONLY_FEATURES } from "@/config/featureAccess";

export default function CRM() {
  const {
    inactiveLeads,
    isLoadingInactive,
    reactivateLead,
    isReactivating,
  } = useLeads();

  const [tab, setTab] = useTabParam("tab", "active");
  useScreenTime("crm");

  const { canAccessFeature } = useFeatureAccess();
  const canSeeTemplates = canAccessFeature(DEVELOPER_ONLY_FEATURES.CRM_WHATSAPP_TEMPLATES);

  // Redirect away from restricted tab when user lacks access
  useEffect(() => {
    if (tab === "templates" && !canSeeTemplates) {
      setTab("active");
    }
  }, [tab, canSeeTemplates, setTab]);

  return (
    <div className="flex flex-col min-h-screen relative page-enter" data-clarity-mask="true">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="CRM"
        description="Gerencie seus leads e clientes"
      />

      <div className="relative flex-1 p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4 sm:space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-initial min-h-[44px]">
              Leads Ativos
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex-1 sm:flex-initial min-h-[44px] flex items-center gap-2">
              <span className="hidden sm:inline">Leads </span>Inativos
              {inactiveLeads.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {inactiveLeads.length}
                </Badge>
              )}
            </TabsTrigger>
            {canSeeTemplates && (
              <TabsTrigger value="templates" className="flex-1 sm:flex-initial min-h-[44px]">
                <span className="hidden sm:inline">WhatsApp </span>Templates
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active" className="mt-0">
            <SectionErrorBoundary section="KanbanBoard">
              <KanbanBoard />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="inactive" className="mt-0">
            <InactiveLeadsList
              leads={inactiveLeads}
              isLoading={isLoadingInactive}
              onReactivate={reactivateLead}
              isReactivating={isReactivating}
            />
          </TabsContent>

          {canSeeTemplates && (
            <TabsContent value="templates" className="mt-0">
              <WhatsAppTemplates />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
