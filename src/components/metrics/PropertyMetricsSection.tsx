import { Home, Plus, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { MetricsDateRange } from "@/hooks/useMetricsData";
import { usePropertyMetrics } from "@/hooks/useMetricsData";

const COLORS = ["hsl(31, 100%, 48%)", "hsl(0, 72%, 50%)", "hsl(152, 56%, 42%)", "hsl(210, 60%, 52%)", "hsl(40, 97%, 64%)", "hsl(280, 60%, 55%)", "hsl(180, 50%, 45%)"];

interface Props {
  dateRange: MetricsDateRange;
}

export function PropertyMetricsSection({ dateRange }: Props) {
  const { data, isLoading } = usePropertyMetrics(dateRange);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Home className="h-5 w-5 text-accent" />
        Métricas de Imóveis
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Imóveis Ativos" value={data?.activeTotal ?? 0} icon={<Home className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Total Cadastrados" value={data?.totalRegistered ?? 0} isLoading={isLoading} />
        <MetricCard title="Adicionados no Período" value={data?.addedInPeriod ?? 0} icon={<Plus className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Tipos Distintos" value={data?.byType?.length ?? 0} icon={<BarChart3 className="h-4 w-4" />} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By type - Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Imóveis por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data?.byType || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(data?.byType || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By status - Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Imóveis por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.byStatus || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Imóveis" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]}>
                    {(data?.byStatus || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
