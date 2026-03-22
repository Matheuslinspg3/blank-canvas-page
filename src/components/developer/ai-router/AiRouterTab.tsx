import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings2, Server, ScrollText } from "lucide-react";
import { AiRouterOverview } from "./AiRouterOverview";
import { AiRouterTasks } from "./AiRouterTasks";
import { AiRouterProviders as AiRouterProvidersList } from "./AiRouterProvidersList";
import { AiRouterLogs } from "./AiRouterLogs";

const subTabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "tasks", label: "Tasks", icon: Settings2 },
  { id: "providers", label: "Providers", icon: Server },
  { id: "logs", label: "Logs", icon: ScrollText },
] as const;

export function AiRouterTab() {
  const [activeSubTab, setActiveSubTab] = useState("overview");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="inline-flex h-9 p-1 gap-0.5">
          {subTabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-1.5 px-3 text-xs">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><AiRouterOverview /></TabsContent>
        <TabsContent value="tasks"><AiRouterTasks /></TabsContent>
        <TabsContent value="providers"><AiRouterProvidersList /></TabsContent>
        <TabsContent value="logs"><AiRouterLogs /></TabsContent>
      </Tabs>
    </div>
  );
}
