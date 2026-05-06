import { Home, Plus, BarChart3, AlertCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { MetricsDateRange } from "@/hooks/useMetricsData";
import { usePropertyMetrics } from "@/hooks/useMetricsData";

const COLORS = ["hsl(31, 100%, 48%)", "hsl(0, 72%, 50%)", "hsl(152, 56%, 42%)", "hsl(210, 60%, 52%)", "hsl(40, 97%, 64%)", "hsl(280, 60%, 55%)", "hsl(180, 50%, 45%)"];

interface Props {
  dateRange: MetricsDateRange;
}

export function PropertyMetricsSection({ dateRange }: Props) {
  const { data, isLoading } = usePropertyMetrics(dateRange);

  return (
    <section className="space-y-4" id="section-properties">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Home className="h-5 w-5 text-accent" />
        Métricas de Imóveis
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Adicionados no Período" value={data?.addedInPeriod ?? 0} icon={<Plus className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Imóveis Ativos" value={data?.activeTotal ?? 0} icon={<Home className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Imóveis Inativos" value={data?.inactiveTotal ?? 0} icon={<AlertCircle className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Imóveis Futuros" value={data?.futureTotal ?? 0} icon={<Calendar className="h-4 w-4" />} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Imóveis por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.byStatus || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Imóveis" radius={[0, 4, 4, 0]}>
                    {(data?.byStatus || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Imóveis por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.byType || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Imóveis" radius={[0, 4, 4, 0]}>
                    {(data?.byType || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Etapa de Lançamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.byLaunchStage || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Imóveis" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

