import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Kanban, FileCheck } from "lucide-react";
import { FinancingSimulator } from "@/components/financing/FinancingSimulator";
import { FinancingPipeline } from "@/components/financing/FinancingPipeline";
import { FinancingDocsChecklist } from "@/components/financing/FinancingDocsChecklist";

export default function Financiamentos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financiamentos</h1>
        <p className="text-muted-foreground">Simule, gerencie e acompanhe processos de financiamento imobiliário.</p>
      </div>

      <Tabs defaultValue="simulador">
        <TabsList>
          <TabsTrigger value="simulador" className="gap-1.5">
            <Calculator className="h-4 w-4" /> Simulador
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Kanban className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="documentacao" className="gap-1.5">
            <FileCheck className="h-4 w-4" /> Documentação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulador">
          <FinancingSimulator />
        </TabsContent>
        <TabsContent value="pipeline">
          <FinancingPipeline />
        </TabsContent>
        <TabsContent value="documentacao">
          <FinancingDocsChecklist />
        </TabsContent>
      </Tabs>
    </div>
  );
}
