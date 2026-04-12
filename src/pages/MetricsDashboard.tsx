import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart3 } from "lucide-react";
import { startOfMonth } from "date-fns";
import { MetricsPeriodFilter } from "@/components/metrics/MetricsPeriodFilter";
import { LeadMetricsSection } from "@/components/metrics/LeadMetricsSection";
import { SalesMetricsSection } from "@/components/metrics/SalesMetricsSection";
import { PropertyMetricsSection } from "@/components/metrics/PropertyMetricsSection";
import { CostRevenueSection } from "@/components/metrics/CostRevenueSection";
import { BrokerRankingSection } from "@/components/metrics/BrokerRankingSection";
import { ExportPdfButton } from "@/components/metrics/ExportPdfButton";
import { LazySection } from "@/components/dashboard/LazySection";
import { useUserRoles } from "@/hooks/useUserRole";
import { computeMetricsRange, type MetricsPeriodKey, type MetricsDateRange } from "@/hooks/useMetricsData";
import { Separator } from "@/components/ui/separator";

export default function MetricsDashboard() {
  const [periodKey, setPeriodKey] = useState<MetricsPeriodKey>("current_month");
  const [customRange, setCustomRange] = useState<MetricsDateRange>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const dateRange = useMemo(() => computeMetricsRange(periodKey, customRange), [periodKey, customRange]);
  const { isAdminOrAbove } = useUserRoles();

  return (
    <>
      <Helmet>
        <title>Métricas & Estimativas | Habitaê</title>
        <meta name="description" content="Métricas detalhadas de leads, vendas, imóveis e corretores." />
      </Helmet>

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-accent" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Métricas & Estimativas</h1>
              <p className="text-sm text-muted-foreground">Visão completa do desempenho</p>
            </div>
          </div>
          <ExportPdfButton targetId="metrics-content" />
        </div>

        {/* Period Filter */}
        <MetricsPeriodFilter
          periodKey={periodKey}
          onPeriodChange={setPeriodKey}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          dateRange={dateRange}
        />

        {/* Content */}
        <div id="metrics-content" className="space-y-8">
          <LeadMetricsSection dateRange={dateRange} />

          <Separator />

          <LazySection rootMargin="300px">
            <SalesMetricsSection dateRange={dateRange} />
          </LazySection>

          <Separator />

          <LazySection rootMargin="300px">
            <PropertyMetricsSection dateRange={dateRange} />
          </LazySection>

          <Separator />

          <LazySection rootMargin="300px">
            <CostRevenueSection dateRange={dateRange} />
          </LazySection>

          {isAdminOrAbove && (
            <>
              <Separator />
              <LazySection rootMargin="300px">
                <BrokerRankingSection dateRange={dateRange} />
              </LazySection>
            </>
          )}
        </div>
      </div>
    </>
  );
}
