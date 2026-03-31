import { useState } from "react";
import { useUserRoles } from "@/hooks/useUserRole";
import { Terminal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { DevSidebar, type DevSection } from "@/components/developer/DevSidebar";
import { DevOverviewCards } from "@/components/developer/DevOverviewCards";
import { SystemHealthCard } from "@/components/developer/SystemHealthCard";
import { StorageUsageTab } from "@/components/developer/StorageUsageTab";
import { ImportHistoryTab } from "@/components/developer/ImportHistoryTab";
import { DatabaseTab } from "@/components/developer/DatabaseTab";
import { SubscriptionsTab } from "@/components/developer/SubscriptionsTab";
import { TicketsTab } from "@/components/developer/TicketsTab";
import { AIConsolidatedTab } from "@/components/developer/AIConsolidatedTab";
import { BillingDashboardTab } from "@/components/developer/billing/BillingDashboardTab";
import { MigrationTab } from "@/components/developer/MigrationTab";
import { AiRouterTab } from "@/components/developer/ai-router/AiRouterTab";
import { SetupChecklistTab } from "@/components/developer/SetupChecklistTab";
import { ToolsSection } from "@/components/developer/ToolsSection";
import { UsersAndOrgsSection } from "@/components/developer/UsersAndOrgsSection";

const sectionTitles: Record<DevSection, string> = {
  overview: "Dashboard",
  database: "Banco de Dados",
  storage: "Storage",
  imports: "Importações",
  users: "Usuários & Organizações",
  subscriptions: "Assinaturas",
  ai: "Inteligência Artificial",
  "ai-router": "AI Router",
  billing: "Billing IA",
  tickets: "Tickets de Suporte",
  tools: "Ferramentas",
  migration: "Migração",
  setup: "Setup Checklist",
};

function SectionContent({ section, onNavigate }: { section: DevSection; onNavigate: (s: DevSection) => void }) {
  switch (section) {
    case "overview":
      return (
        <div className="space-y-4">
          <DevOverviewCards onNavigate={onNavigate} />
          <SystemHealthCard />
        </div>
      );
    case "database":
      return <DatabaseTab />;
    case "storage":
      return <StorageUsageTab />;
    case "imports":
      return <ImportHistoryTab />;
    case "users":
      return <UsersAndOrgsSection />;
    case "subscriptions":
      return <SubscriptionsTab />;
    case "ai":
      return <AIConsolidatedTab />;
    case "ai-router":
      return <AiRouterTab />;
    case "billing":
      return <BillingDashboardTab />;
    case "tickets":
      return <TicketsTab />;
    case "tools":
      return <ToolsSection />;
    case "migration":
      return <MigrationTab />;
    case "setup":
      return <SetupChecklistTab />;
    default:
      return null;
  }
}

export default function DeveloperDashboard() {
  const { isDeveloper } = useUserRoles();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<DevSection>("overview");

  if (!isDeveloper) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Terminal className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Painel Developer</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Infraestrutura e gestão do sistema Habitae</p>
        </div>
      </div>

      {/* Mobile: dropdown above content */}
      {isMobile && (
        <DevSidebar active={activeSection} onSelect={setActiveSection} />
      )}

      {/* Desktop: sidebar + content */}
      {!isMobile ? (
        <div className="flex gap-6 items-start">
          <DevSidebar active={activeSection} onSelect={setActiveSection} />
          <div className="flex-1 min-w-0">
            <SectionContent section={activeSection} onNavigate={setActiveSection} />
          </div>
        </div>
      ) : (
        <SectionContent section={activeSection} onNavigate={setActiveSection} />
      )}
    </div>
  );
}
