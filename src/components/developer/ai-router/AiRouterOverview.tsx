import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorProgress } from "@/components/ui/color-progress";
import { Loader2, Zap, DollarSign, TrendingUp, PieChart as PieIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAiRouterStats } from "@/hooks/useAiRouterStats";
import { useAiRouterProviderStats, ProviderStatRow } from "@/hooks/useAiRouterProviderStats";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1"];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function rpdPercent(used: number, limit: number | null) {
  const rpd = limit || 10000;
  return Math.min(Math.round((used / rpd) * 100), 100);
}

function rpdColor(pct: number) {
  if (pct >= 80) return "bg-red-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function StatusDot({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

export function AiRouterOverview() {
  const { data: stats, isLoading } = useAiRouterStats();
  const { data: providerStats, isLoading: statsLoading } = useAiRouterProviderStats();

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

  // Generate alerts from provider stats
  const alerts: { type: "warning" | "success"; message: string }[] = [];
  if (providerStats) {
    for (const p of providerStats) {
      const rpdPct = rpdPercent(p.requests_today, p.rate_limit_rpd);
      if (rpdPct >= 80) {
        alerts.push({ type: "warning", message: `${p.display_name}: ${rpdPct}% do RPD usado (${p.requests_today}/${p.rate_limit_rpd || 10000}) — penalizado` });
      }
      if (p.consecutive_errors > 0 && p.score >= 0) {
        alerts.push({ type: "warning", message: `${p.display_name}: ${p.consecutive_errors} erros consecutivos` });
      }
      if (p.success_rate < 90 && p.total_requests > 10) {
        alerts.push({ type: "warning", message: `${p.display_name}: taxa de sucesso baixa (${p.success_rate}%)` });
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Auto-routing badge */}
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          <Zap className="h-3 w-3" />
          Auto-Routing Inteligente
        </Badge>
        <span className="text-xs text-muted-foreground">
          Score = custo(40%) + velocidade(25%) + confiabilidade(25%) + qualidade(10%)
        </span>
      </div>

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

      {/* Provider Performance table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Provider Performance (tempo real)</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !providerStats || providerStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum provider ativo</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Vel. Média</TableHead>
                    <TableHead className="text-right">Confiab.</TableHead>
                    <TableHead>RPD Hoje</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerStats.map((p: ProviderStatRow) => {
                    const rpdPct = rpdPercent(p.requests_today, p.rate_limit_rpd);
                    return (
                      <TableRow key={p.provider_key}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <StatusDot score={p.score} />
                            {p.display_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <div className="w-16">
                              <ColorProgress
                                value={Math.max(p.score, 0)}
                                className="h-2"
                                indicatorColor={
                                  p.score >= 80 ? "hsl(var(--chart-2))" : p.score >= 50 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"
                                }
                              />
                            </div>
                            <span className={`text-sm font-bold ${scoreColor(p.score)}`}>
                              {p.score === -1 ? "SKIP" : p.score}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.avg_latency_ms > 0 ? (
                            p.avg_latency_ms < 1000
                              ? `${p.avg_latency_ms}ms`
                              : `${(p.avg_latency_ms / 1000).toFixed(1)}s`
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.success_rate >= 95 ? "default" : p.success_rate >= 80 ? "secondary" : "destructive"}>
                            {p.success_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1">
                              <ColorProgress
                                value={rpdPct}
                                className="h-2"
                                indicatorColor={
                                  rpdPct >= 80 ? "hsl(var(--destructive))" : rpdPct >= 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-2))"
                                }
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {p.requests_today}/{p.rate_limit_rpd || "∞"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {p.is_free ? (
                            <Badge variant="outline" className="text-green-600 border-green-600/30">Free</Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600/30">💰 Pago</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {a.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <span>{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Task distribution */}
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

      {/* Top orgs */}
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
