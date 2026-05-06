import { Users, TrendingUp, TrendingDown, Clock, Thermometer, PhoneOff, UserCheck, UserMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import type { MetricsDateRange, MetricsFilters } from "@/hooks/useMetricsData";
import { useLeadsMetrics, useLeadResponseTime } from "@/hooks/useMetricsData";

const COLORS = ["hsl(31, 100%, 48%)", "hsl(0, 72%, 50%)", "hsl(152, 56%, 42%)", "hsl(210, 60%, 52%)", "hsl(40, 97%, 64%)", "hsl(280, 60%, 55%)"];

interface Props {
  dateRange: MetricsDateRange;
  filters: MetricsFilters;
}

export function LeadMetricsSection({ dateRange, filters }: Props) {
  const { data, isLoading } = useLeadsMetrics(dateRange, filters);
  const { data: responseData, isLoading: responseLoading } = useLeadResponseTime(dateRange);

  const avgHoursText = responseData?.avgHours != null ? `${responseData.avgHours.toFixed(1)}h` : "—";

  return (
    <section className="space-y-4" id="section-leads">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Users className="h-5 w-5 text-accent" />
        Métricas de Leads
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Leads Recebidos" value={data?.total ?? 0} icon={<Users className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Leads Ativos" value={data?.activeCount ?? 0} icon={<UserCheck className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Leads Inativos" value={data?.inactiveCount ?? 0} icon={<UserMinus className="h-4 w-4" />} isLoading={isLoading} />
        <MetricCard title="Leads Duplicados" value={data?.duplicateCount ?? 0} icon={<PhoneOff className="h-4 w-4" />} isLoading={isLoading} subtitle="Por número de telefone" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Com Corretor" value={data?.withBroker ?? 0} icon={<UserCheck className="h-4 w-4 text-green-500" />} isLoading={isLoading} />
        <MetricCard title="Sem Corretor" value={data?.withoutBroker ?? 0} icon={<UserMinus className="h-4 w-4 text-orange-500" />} isLoading={isLoading} />
        <MetricCard title="Taxa de Conversão" value={`${(data?.conversionRate ?? 0).toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4" />} isLoading={isLoading} subtitle={`${data?.wonCount ?? 0} ganhos`} />
        <MetricCard title="Tempo de Resposta" value={avgHoursText} icon={<Clock className="h-4 w-4" />} isLoading={responseLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly evolution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.weeklyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="week" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))", r: 3 }} name="Leads" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Origem dos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.bySource || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                    {(data?.bySource || []).map((_, i) => (
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
            <CardTitle className="text-sm">Distribuição por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data?.byStage || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                    {(data?.byStage || []).map((_, i) => (
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

