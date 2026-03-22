import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, DollarSign, TrendingUp, PieChart as PieIcon } from "lucide-react";
import { useAiRouterStats } from "@/hooks/useAiRouterStats";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1"];

export function AiRouterOverview() {
  const { data: stats, isLoading } = useAiRouterStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const metricCards = [
    { label: "Hoje", value: stats.callsToday, icon: Zap },
    { label: "7 dias", value: stats.calls7d, icon: TrendingUp },
    { label: "30 dias", value: stats.calls30d, icon: TrendingUp },
    { label: "Custo pago 30d", value: `$${stats.costPaid30d.toFixed(4)}`, icon: DollarSign },
    { label: "% Free 30d", value: `${stats.freePercent30d}%`, icon: PieIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily calls line chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chamadas por dia (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyCalls}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Provider pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por Provider (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.providerDistribution}
                    cx="50%" cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    nameKey="provider"
                    label={({ provider, percent }) => `${provider} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {stats.providerDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task distribution bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Chamadas por Task Type (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.taskDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="task_type" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top orgs table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Organizações por Uso (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">% Free</TableHead>
                  <TableHead className="text-right">Custo Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topOrgs.map((org) => (
                  <TableRow key={org.org_name}>
                    <TableCell className="font-medium">{org.org_name}</TableCell>
                    <TableCell className="text-right">{org.total}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={org.free_pct === 100 ? "default" : "secondary"}>
                        {org.free_pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${org.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
