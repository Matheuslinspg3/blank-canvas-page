import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart3, LayoutDashboard, FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { startOfMonth } from "date-fns";
import { MetricsPeriodFilter } from "@/components/metrics/MetricsPeriodFilter";
import { LeadMetricsSection } from "@/components/metrics/LeadMetricsSection";
import { SalesMetricsSection } from "@/components/metrics/SalesMetricsSection";
import { PropertyMetricsSection } from "@/components/metrics/PropertyMetricsSection";
import { CostRevenueSection } from "@/components/metrics/CostRevenueSection";
import { BrokerRankingSection } from "@/components/metrics/BrokerRankingSection";
import { ExportPdfButton } from "@/components/metrics/ExportPdfButton";
import { MetricsAdvancedFilters } from "@/components/metrics/MetricsAdvancedFilters";
import { MetricsDetailedLeadsTable } from "@/components/metrics/MetricsDetailedLeadsTable";
import { MetricsDetailedPropertiesTable } from "@/components/metrics/MetricsDetailedPropertiesTable";
import { LazySection } from "@/components/dashboard/LazySection";
import { useUserRoles } from "@/hooks/useUserRole";
import { computeMetricsRange, useLeadsMetrics, usePropertyMetrics, type MetricsPeriodKey, type MetricsDateRange, type MetricsFilters } from "@/hooks/useMetricsData";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MetricsDashboard() {
  const [periodKey, setPeriodKey] = useState<MetricsPeriodKey>("current_month");
  const [customRange, setCustomRange] = useState<MetricsDateRange>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [filters, setFilters] = useState<MetricsFilters>({
    brokerId: "all",
    leadStatus: "all",
    deduplicate: false,
  });

  const dateRange = useMemo(() => computeMetricsRange(periodKey, customRange), [periodKey, customRange]);
  const { isAdmin, isSubAdmin, isLoading: rolesLoading } = useUserRoles();
  
  const { data: leads, isLoading: leadsLoading } = useLeadsMetrics(dateRange, filters);
  const { data: properties, isLoading: propsLoading } = usePropertyMetrics(dateRange);

  const canAccess = isAdmin || isSubAdmin;

  if (rolesLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center text-center p-6">
        <div className="bg-muted p-4 rounded-full mb-4">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Esta aba é acessível apenas para administradores. Se você acredita que deveria ter acesso, entre em contato com o suporte.
        </p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Métricas do Sistema | Habitaê</title>
        <meta name="description" content="Painel administrativo de métricas e performance." />
      </Helmet>

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-accent" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Métricas do Sistema</h1>
              <p className="text-sm text-muted-foreground">Painel administrativo e operacional</p>
            </div>
          </div>
          <ExportPdfButton targetId="metrics-content" />
        </div>

        {/* Global Filters */}
        <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-2">Filtros Globais</h3>
            <MetricsPeriodFilter
              periodKey={periodKey}
              onPeriodChange={setPeriodKey}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              dateRange={dateRange}
            />
            <MetricsAdvancedFilters 
                filters={filters}
                onFiltersChange={setFilters}
            />
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="dashboard" className="gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Resumo
                </TabsTrigger>
                <TabsTrigger value="details" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Detalhado
                </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
                <div id="metrics-content" className="space-y-12">
                  <LeadMetricsSection dateRange={dateRange} filters={filters} />
                  
                  <Separator />
                  
                  <LazySection rootMargin="300px">
                    <SalesMetricsSection dateRange={dateRange} filters={filters} />
                  </LazySection>

                  <Separator />

                  <LazySection rootMargin="300px">
                    <BrokerRankingSection dateRange={dateRange} filters={filters} />
                  </LazySection>

                  <Separator />

                  <LazySection rootMargin="300px">
                    <PropertyMetricsSection dateRange={dateRange} />
                  </LazySection>

                  <Separator />

                  <LazySection rootMargin="300px">
                    <CostRevenueSection dateRange={dateRange} />
                  </LazySection>
                </div>
            </TabsContent>

            <TabsContent value="details" className="mt-6 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-accent" />
                            Lista Detalhada de Leads
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {leadsLoading ? (
                             <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>
                        ) : (
                            <MetricsDetailedLeadsTable leads={leads?.rawData || []} />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-accent" />
                            Lista Detalhada de Imóveis
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {propsLoading ? (
                             <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>
                        ) : (
                            <MetricsDetailedPropertiesTable properties={properties?.rawData || []} />
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

