import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2 } from "lucide-react";
import { UsersTab } from "./UsersTab";
import { OrgUsageTab } from "./OrgUsageTab";

export function UsersAndOrgsSection() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="gap-1.5 flex-1 sm:flex-initial">
            <Users className="h-3.5 w-3.5" />
            Usuários & Cargos
          </TabsTrigger>
          <TabsTrigger value="orgs" className="gap-1.5 flex-1 sm:flex-initial">
            <Building2 className="h-3.5 w-3.5" />
            Organizações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="orgs" className="mt-4">
          <OrgUsageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
