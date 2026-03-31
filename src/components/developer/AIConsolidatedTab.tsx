import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Route, Receipt, ScrollText } from "lucide-react";
import { SecurityAuditCard } from "./SecurityAuditCard";
import { AIProviderCard } from "./AIProviderCard";
import { AIUsageDashboard } from "./AIUsageDashboard";
import { AILogsTable } from "./AILogsTable";

const subTabs = [
  { id: "providers", label: "Provedores", icon: Bot },
  { id: "usage", label: "Uso & Custos", icon: Receipt },
  { id: "logs", label: "Logs", icon: ScrollText },
] as const;

export function AIConsolidatedTab() {
  const [active, setActive] = useState("providers");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Inteligência Artificial</h2>
        <p className="text-sm text-muted-foreground">Provedores, uso e logs de IA</p>
      </div>

      <SecurityAuditCard />

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="h-9">
          {subTabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-1.5 px-3 text-xs">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="providers">
          <AIProviderCard />
        </TabsContent>
        <TabsContent value="usage">
          <AIUsageDashboard />
        </TabsContent>
        <TabsContent value="logs">
          <AILogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
