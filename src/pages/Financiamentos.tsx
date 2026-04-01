import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Kanban, FileCheck, FileText, PiggyBank, BarChart3 } from "lucide-react";
import { FinancingSimulator } from "@/components/financing/FinancingSimulator";
import { FinancingPipeline } from "@/components/financing/FinancingPipeline";
import { FinancingDocsChecklist } from "@/components/financing/FinancingDocsChecklist";
import { InvestmentCalculator } from "@/components/financing/InvestmentCalculator";
import { MarketComparative } from "@/components/properties/MarketComparative";
import { Card, CardContent } from "@/components/ui/card";
import { BANK_FORMS, BANK_COLORS } from "@/components/financing/types";

function FormulariosTab() {
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

export default function Financiamentos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financiamentos</h1>
        <p className="text-muted-foreground">Simule, gerencie e acompanhe processos de financiamento imobiliário.</p>
      </div>

      <Tabs defaultValue="simulador">
        <TabsList className="flex-wrap">
          <TabsTrigger value="simulador" className="gap-1.5">
            <Calculator className="h-4 w-4" /> Simulador
          </TabsTrigger>
          <TabsTrigger value="rentabilidade" className="gap-1.5">
            <PiggyBank className="h-4 w-4" /> Rentabilidade
          </TabsTrigger>
          <TabsTrigger value="cma" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> CMA
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Kanban className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="formularios" className="gap-1.5">
            <FileText className="h-4 w-4" /> Formulários
          </TabsTrigger>
          <TabsTrigger value="documentacao" className="gap-1.5">
            <FileCheck className="h-4 w-4" /> Documentação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulador">
          <FinancingSimulator />
        </TabsContent>
        <TabsContent value="rentabilidade">
          <InvestmentCalculator />
        </TabsContent>
        <TabsContent value="cma">
          <MarketComparative />
        </TabsContent>
        <TabsContent value="pipeline">
          <FinancingPipeline />
        </TabsContent>
        <TabsContent value="formularios">
          <FormulariosTab />
        </TabsContent>
        <TabsContent value="documentacao">
          <FinancingDocsChecklist />
        </TabsContent>
      </Tabs>
    </div>
  );
}
