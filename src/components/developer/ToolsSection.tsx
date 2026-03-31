import { SendPushCard } from "./SendPushCard";
import { PurgeCacheCard } from "./PurgeCacheCard";
import { PwaDiagnosticsCard } from "./PwaDiagnosticsCard";
import { MaintenanceCard } from "./MaintenanceCard";

export function ToolsSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Ferramentas Operacionais</h2>
        <p className="text-sm text-muted-foreground">Manutenção, notificações, cache e diagnóstico PWA</p>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <MaintenanceCard />
        <PurgeCacheCard />
        <SendPushCard />
        <PwaDiagnosticsCard />
      </div>
    </div>
  );
}
