import { Link } from "react-router-dom";
import { SendPushCard } from "./SendPushCard";
import { PurgeCacheCard } from "./PurgeCacheCard";
import { PwaDiagnosticsCard } from "./PwaDiagnosticsCard";
import { MaintenanceCard } from "./MaintenanceCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight } from "lucide-react";

export function ToolsSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Ferramentas Operacionais</h2>
        <p className="text-sm text-muted-foreground">Manutenção, notificações, cache, diagnóstico PWA e visibilidade</p>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <MaintenanceCard />
        <PurgeCacheCard />
        <SendPushCard />
        <PwaDiagnosticsCard />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Diagnóstico de Visibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Imóveis por organização, características globais × por org e convites pendentes (inclui se o email convidado já tem conta).
            </p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/dev/visibility">Abrir <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
