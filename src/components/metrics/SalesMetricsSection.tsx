import { DollarSign, ShoppingCart, Home, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { MetricsDateRange } from "@/hooks/useMetricsData";
import { useSalesMetrics, useFunnelMetrics, useLeadsMetrics } from "@/hooks/useMetricsData";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

interface Props {
  dateRange: MetricsDateRange;
}

export function SalesMetricsSection({ dateRange }: Props) {
  const { data: sales, isLoading: salesLoading } = useSalesMetrics(dateRange);
  const { data: funnel, isLoading: funnelLoading } = useFunnelMetrics(dateRange);
  const { data: leads } = useLeadsMetrics(dateRange);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-accent" />
        Métricas de Vendas & Negócios
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Imóveis Vendidos" value={sales?.salesCount ?? 0} icon={<ShoppingCart className="h-4 w-4" />} isLoading={salesLoading} />
        <MetricCard title="Valor Total em Vendas" value={formatCurrency(sales?.totalSalesValue ?? 0)} icon={<DollarSign className="h-4 w-4" />} isLoading={salesLoading} />
        <MetricCard title="Ticket Médio" value={formatCurrency(sales?.avgTicket ?? 0)} isLoading={salesLoading} />
        <MetricCard title="Imóveis Alugados" value={sales?.rentalsCount ?? 0} icon={<Home className="h-4 w-4" />} isLoading={salesLoading} subtitle={formatCurrency(sales?.totalRentalsValue ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Negócios perdidos */}
        <MetricCard
          title="Negócios Perdidos"
          value={leads?.lostCount ?? 0}
          icon={<TrendingDown className="h-4 w-4" />}
          isLoading={salesLoading}
          subtitle={`Valor estimado: ${formatCurrency(leads?.lostValue ?? 0)}`}
        />

        {/* Funil */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnel || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                    {(funnel || []).map((s, i) => (
                      <Cell key={i} fill={s.color || "hsl(var(--accent))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
