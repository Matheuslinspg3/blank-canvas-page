import React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { Link2, Users, TrendingUp, ScrollText } from "lucide-react";
import RDConnectionTab from "@/components/ads/rdstation/RDConnectionTab";
import RDLeadsTab from "@/components/ads/rdstation/RDLeadsTab";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";
import RDWebhookTab from "@/components/ads/rdstation/RDWebhookTab";

export default function RDStation() {
  const [tab, setTab] = useTabParam("tab", "conexao");

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="RD Station"
        description="Integração com RD Station Marketing — conexão, leads e estatísticas"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="conexao" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Conexão
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Leads
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Estatísticas
            </TabsTrigger>
            <TabsTrigger value="webhook_logs" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Webhook Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conexao" className="mt-4"><RDConnectionTab /></TabsContent>
          <TabsContent value="leads" className="mt-4"><RDLeadsTab /></TabsContent>
          <TabsContent value="estatisticas" className="mt-4"><RDStationStatsContent /></TabsContent>
          <TabsContent value="webhook_logs" className="mt-4"><RDWebhookTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
