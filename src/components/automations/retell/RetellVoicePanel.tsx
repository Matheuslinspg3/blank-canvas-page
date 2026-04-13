import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, Phone, History, Workflow } from "lucide-react";
import { RetellConfigTab } from "./RetellConfigTab";
import { RetellCallWidget } from "./RetellCallWidget";
import { RetellCallHistory } from "./RetellCallHistory";
import { RetellFlowEditor } from "./RetellFlowEditor";
import { useUserRoles } from "@/hooks/useUserRole";

export function RetellVoicePanel() {
  const { isAdmin, isSubAdmin, isDeveloper, isLoading } = useUserRoles();
  const canConfigure = isLoading ? true : (isAdmin || isSubAdmin || isDeveloper);

  return (
    <Tabs defaultValue="call" className="space-y-4">
      <TabsList className="bg-muted/50 overflow-x-auto flex-nowrap">
        <TabsTrigger value="call" className="gap-1.5 shrink-0">
          <Phone className="h-3.5 w-3.5" /> Chamada
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5 shrink-0">
          <History className="h-3.5 w-3.5" /> Histórico
        </TabsTrigger>
        {canConfigure && (
          <>
            <TabsTrigger value="flow" className="gap-1.5 shrink-0">
              <Workflow className="h-3.5 w-3.5" /> Flow
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 shrink-0">
              <Settings2 className="h-3.5 w-3.5" /> Configurações
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="call">
        <RetellCallWidget />
      </TabsContent>

      <TabsContent value="history">
        <RetellCallHistory />
      </TabsContent>

      {canConfigure && (
        <>
          <TabsContent value="flow">
            <RetellFlowEditor />
          </TabsContent>
          <TabsContent value="config">
            <RetellConfigTab />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
