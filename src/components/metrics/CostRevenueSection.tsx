import { useState, useEffect } from "react";
import { Wallet, Calculator, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MetricsDateRange } from "@/hooks/useMetricsData";
import { useCommissionsMetrics, useLeadsMetrics } from "@/hooks/useMetricsData";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STORAGE_KEY = "habitae_metrics_cost_config";

interface Props {
  dateRange: MetricsDateRange;
}

export function CostRevenueSection({ dateRange }: Props) {
  const { data: commissions, isLoading: commissionsLoading } = useCommissionsMetrics(dateRange);
  const { data: leads } = useLeadsMetrics(dateRange);

  const [costPerLead, setCostPerLead] = useState(50);
  const [opCost, setOpCost] = useState(5000);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.costPerLead) setCostPerLead(parsed.costPerLead);
        if (parsed.opCost) setOpCost(parsed.opCost);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ costPerLead, opCost }));
    } catch {}
  }, [costPerLead, opCost]);

  const totalLeadCost = (leads?.total ?? 0) * costPerLead;
  const totalRevenue = commissions?.totalCommission ?? 0;
  const roi = opCost > 0 ? ((totalRevenue - opCost) / opCost) * 100 : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Wallet className="h-5 w-5 text-accent" />
        Estimativa de Custos & Receita
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Comissão no Período" value={formatCurrency(totalRevenue)} icon={<Wallet className="h-4 w-4" />} isLoading={commissionsLoading} />
        <MetricCard title="Projeção Próx. Mês" value={formatCurrency(commissions?.monthlyProjection ?? 0)} icon={<ArrowUpRight className="h-4 w-4" />} isLoading={commissionsLoading} subtitle="Média últimos 3 meses" />
        <MetricCard title="Custo Total em Leads" value={formatCurrency(totalLeadCost)} icon={<Calculator className="h-4 w-4" />} subtitle={`${leads?.total ?? 0} leads × R$ ${costPerLead}`} />
        <MetricCard
          title="ROI Estimado"
          value={`${roi.toFixed(1)}%`}
          subtitle={`Receita ${formatCurrency(totalRevenue)} vs Custo ${formatCurrency(opCost)}`}
          className={roi > 0 ? "border-l-4 border-l-[hsl(var(--success))]" : "border-l-4 border-l-destructive"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configurações de Custo (editável)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Custo por Lead (R$)</Label>
              <Input
                type="number"
                value={costPerLead}
                onChange={(e) => setCostPerLead(Number(e.target.value) || 0)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo Operacional Mensal (R$)</Label>
              <Input
                type="number"
                value={opCost}
                onChange={(e) => setOpCost(Number(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
