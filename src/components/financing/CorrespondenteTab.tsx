import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Kanban, Calculator, FileText, FileCheck, BarChart3, 
  Landmark, TrendingUp, Users, Clock, DollarSign,
  CheckCircle2, AlertCircle, PiggyBank,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinancingSimulator } from "./FinancingSimulator";
import { FinancingPipeline } from "./FinancingPipeline";
import { FinancingDocsChecklist } from "./FinancingDocsChecklist";
import { InvestmentCalculator } from "./InvestmentCalculator";
import { BANK_FORMS, BANK_COLORS } from "./types";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Section = "dashboard" | "pipeline" | "simulador" | "rentabilidade" | "formularios" | "documentacao";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Painel", icon: BarChart3 },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "simulador", label: "Simulador", icon: Calculator },
  { id: "rentabilidade", label: "Rentabilidade", icon: PiggyBank },
  { id: "formularios", label: "Formulários", icon: FileText },
  { id: "documentacao", label: "Documentação", icon: FileCheck },
];

function CorbanDashboard() {
  const stats = [
    { label: "Processos Ativos", value: "0", icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Em Análise", value: "0", icon: Clock, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Aprovados", value: "0", icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Volume (R$)", value: "R$ 0", icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickActions = [
    { label: "Novo Processo", description: "Cadastre um novo financiamento", icon: Kanban },
    { label: "Simular Financiamento", description: "Compare taxas entre bancos", icon: Calculator },
    { label: "Gerar Formulário", description: "PDFs pré-preenchidos dos bancos", icon: FileText },
    { label: "Checklist de Docs", description: "Verifique a documentação", icon: FileCheck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Painel do Correspondente Bancário
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral dos seus processos de financiamento imobiliário.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações Rápidas</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Card key={action.label} className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <action.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bancos Parceiros */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bancos Disponíveis</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(BANK_COLORS).map(([code, bank]) => {
            const formCount = BANK_FORMS[code]?.length || 0;
            return (
              <Card key={code}>
                <CardContent className="p-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bank.primary }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{bank.name}</p>
                    <p className="text-xs text-muted-foreground">{formCount} formulários</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma atividade recente.</p>
            <p className="text-xs">Crie seu primeiro processo para começar.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FormulariosSection() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Formulários Bancários</h3>
        <p className="text-sm text-muted-foreground">
          Gere automaticamente formulários oficiais dos bancos preenchidos com os dados do seu cliente.
          Para usar, crie um processo no Pipeline e clique em "Formulários" no card do processo.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(BANK_FORMS).map(([bankCode, forms]) => {
          const bank = BANK_COLORS[bankCode];
          return (
            <Card key={bankCode}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bank?.primary }} />
                  <span className="font-medium text-sm">{bank?.name || bankCode}</span>
                </div>
                <ul className="space-y-1">
                  {forms.map((f) => (
                    <li key={f.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{f.name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function CorrespondenteTab() {
  const [active, setActive] = useState<Section>("dashboard");
  const isMobile = useIsMobile();

  const renderContent = () => {
    switch (active) {
      case "dashboard": return <CorbanDashboard />;
      case "pipeline": return <FinancingPipeline />;
      case "simulador": return <FinancingSimulator />;
      case "formularios": return <FormulariosSection />;
      case "documentacao": return <FinancingDocsChecklist />;
    }
  };

  if (isMobile) {
    const current = NAV_ITEMS.find((i) => i.id === active);
    return (
      <div className="space-y-4">
        <Select value={active} onValueChange={(v) => setActive(v as Section)}>
          <SelectTrigger className="w-full h-10 text-sm font-medium">
            <SelectValue>
              <span className="flex items-center gap-2">
                {current && <current.icon className="h-4 w-4" />}
                {current?.label ?? "Selecione"}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {NAV_ITEMS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Bank indicators */}
        <div className="pt-4 mt-4 border-t border-border">
          <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bancos</p>
          {Object.entries(BANK_COLORS).map(([code, bank]) => (
            <div key={code} className="flex items-center gap-2 px-3 py-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bank.primary }} />
              <span className="text-xs text-muted-foreground truncate">{bank.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}
