import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgCostData {
  organization_id: string;
  org_name: string;
  plan_name: string;
  plan_slug: string;
  plan_price_monthly: number;
  automation_allowance_brl: number;
  automation_balance_brl: number;
  automation_consumed_brl: number;
  automation_messages: number;
  ai_balance_usd: number;
  ai_consumed_usd: number;
  ai_allowance_usd: number;
  margin_brl: number;
  margin_pct: number;
  risk: "safe" | "warning" | "danger" | "unlimited";
}

function useOrgCostMonitor() {
  return useQuery({
    queryKey: ["dev-cost-monitor"],
    queryFn: async () => {
      // Fetch all orgs with active subscriptions, their plans, and wallet data
      const [subsRes, autoWalletsRes, aiWalletsRes, orgsRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("organization_id, plan_id, subscription_plans!inner(name, slug, price_monthly, automation_allowance_brl)")
          .eq("status", "active")
          .not("subscription_plans.plan_type", "eq", "addon"),
        supabase
          .from("automation_credit_wallets")
          .select("organization_id, balance_brl, total_consumed_brl, total_messages_processed, plan_monthly_allowance_brl, markup_multiplier"),
        supabase
          .from("ai_credit_wallets")
          .select("organization_id, balance_usd, total_consumed_usd, plan_monthly_allowance_usd, markup_multiplier"),
        supabase
          .from("organizations")
          .select("id, name"),
      ]);

      const orgMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]));
      const autoMap = new Map((autoWalletsRes.data ?? []).map((w) => [w.organization_id, w]));
      const aiMap = new Map((aiWalletsRes.data ?? []).map((w) => [w.organization_id, w]));

      const USD_TO_BRL = 5.5;

      const results: OrgCostData[] = (subsRes.data ?? []).map((sub) => {
        const plan = (sub as any).subscription_plans;
        const orgId = sub.organization_id;
        const autoWallet = autoMap.get(orgId);
        const aiWallet = aiMap.get(orgId);

        const planPrice = Number(plan.price_monthly ?? 0) / 100; // centavos → reais
        const autoAllowance = Number(plan.automation_allowance_brl ?? 0);
        const autoConsumed = Number(autoWallet?.total_consumed_brl ?? 0);
        const autoBalance = Number(autoWallet?.balance_brl ?? 0);
        const autoMarkup = Number(autoWallet?.markup_multiplier ?? 1.5);
        const autoMessages = Number(autoWallet?.total_messages_processed ?? 0);

        const aiAllowance = Number(aiWallet?.plan_monthly_allowance_usd ?? 0);
        const aiConsumed = Number(aiWallet?.total_consumed_usd ?? 0);
        const aiBalance = Number(aiWallet?.balance_usd ?? 0);
        const aiMarkup = Number(aiWallet?.markup_multiplier ?? 3);

        // Cost = what we actually pay providers
        const autoCostReal = autoConsumed / autoMarkup;
        const aiCostReal = (aiConsumed / aiMarkup) * USD_TO_BRL;

        const totalCost = autoCostReal + aiCostReal;
        const margin = planPrice - totalCost;
        const marginPct = planPrice > 0 ? (margin / planPrice) * 100 : 0;

        let risk: OrgCostData["risk"] = "safe";
        if (plan.slug === 'internal_unlimited') risk = "unlimited";
        else if (marginPct < 0) risk = "danger";
        else if (marginPct < 20) risk = "warning";

        return {
          organization_id: orgId,
          org_name: orgMap.get(orgId) ?? orgId.slice(0, 8),
          plan_name: plan.name,
          plan_slug: plan.slug,
          plan_price_monthly: planPrice,
          automation_allowance_brl: autoAllowance,
          automation_balance_brl: autoBalance,
          automation_consumed_brl: autoConsumed,
          automation_messages: autoMessages,
          ai_balance_usd: aiBalance,
          ai_consumed_usd: aiConsumed,
          ai_allowance_usd: aiAllowance,
          margin_brl: margin,
          margin_pct: marginPct,
          risk,
        };
      });

      return results.sort((a, b) => a.margin_pct - b.margin_pct);
    },
    staleTime: 60_000,
  });
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatUSD(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function CostMonitorTab() {
  const { data, isLoading } = useOrgCostMonitor();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (o) =>
        o.org_name.toLowerCase().includes(q) ||
        o.plan_name.toLowerCase().includes(q)
    );
  }, [data, search]);

  const summary = useMemo(() => {
    if (!data?.length) return { total: 0, danger: 0, warning: 0, avgMargin: 0, totalRevenue: 0, totalCost: 0 };
    const danger = data.filter((o) => o.risk === "danger").length;
    const warning = data.filter((o) => o.risk === "warning").length;
    const avgMargin = data.reduce((s, o) => s + o.margin_pct, 0) / data.length;
    const totalRevenue = data.reduce((s, o) => s + o.plan_price_monthly, 0);
    const totalCost = data.reduce((s, o) => s + (o.plan_price_monthly - o.margin_brl), 0);
    return { total: data.length, danger, warning, avgMargin, totalRevenue, totalCost };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" />
              Orgs Ativas
            </div>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Receita Total
            </div>
            <p className="text-2xl font-bold">{formatBRL(summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Margem Média
            </div>
            <p className={cn("text-2xl font-bold", summary.avgMargin < 0 ? "text-destructive" : "text-emerald-500")}>
              {summary.avgMargin.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Em Risco
            </div>
            <p className="text-2xl font-bold">
              <span className="text-destructive">{summary.danger}</span>
              {summary.warning > 0 && (
                <span className="text-yellow-500 text-lg ml-1">+{summary.warning}</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar organização..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Consumo vs Franquia por Organização</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Organização</TableHead>
                  <TableHead className="text-xs">Plano</TableHead>
                  <TableHead className="text-xs text-right">Receita</TableHead>
                  <TableHead className="text-xs">Automação (BRL)</TableHead>
                  <TableHead className="text-xs">IA (USD)</TableHead>
                  <TableHead className="text-xs text-right">Margem</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma organização encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((org) => {
                    const autoUsagePct = org.automation_allowance_brl > 0
                      ? (org.automation_consumed_brl / org.automation_allowance_brl) * 100
                      : 0;
                    const aiUsagePct = org.ai_allowance_usd > 0
                      ? (org.ai_consumed_usd / org.ai_allowance_usd) * 100
                      : 0;

                    return (
                      <TableRow key={org.organization_id}>
                        <TableCell className="text-xs font-medium max-w-[160px] truncate" title={org.org_name}>
                          {org.org_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{org.plan_name}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {formatBRL(org.plan_price_monthly)}
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{formatBRL(org.automation_consumed_brl)}</span>
                              <span>/ {formatBRL(org.automation_allowance_brl)}</span>
                            </div>
                            <Progress
                              value={Math.min(autoUsagePct, 100)}
                              className="h-1.5"
                            />
                            {org.automation_messages > 0 && (
                              <p className="text-[10px] text-muted-foreground">{org.automation_messages} msgs</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{formatUSD(org.ai_consumed_usd)}</span>
                              <span>/ {formatUSD(org.ai_allowance_usd)}</span>
                            </div>
                            <Progress
                              value={Math.min(aiUsagePct, 100)}
                              className="h-1.5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {org.margin_brl >= 0 ? (
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-destructive" />
                            )}
                            <span
                              className={cn(
                                "text-xs font-mono font-medium",
                                org.margin_brl >= 0 ? "text-emerald-500" : "text-destructive"
                              )}
                            >
                              {formatBRL(org.margin_brl)}
                            </span>
                          </div>
                          <p className={cn(
                            "text-[10px]",
                            org.margin_pct >= 20 ? "text-muted-foreground" :
                            org.margin_pct >= 0 ? "text-yellow-500" : "text-destructive"
                          )}>
                            {org.margin_pct.toFixed(0)}%
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          {org.risk === "unlimited" && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Unlimited</Badge>
                          )}
                          {org.risk === "danger" && (
                            <Badge variant="destructive" className="text-[10px]">Prejuízo</Badge>
                          )}
                          {org.risk === "warning" && (
                            <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">Alerta</Badge>
                          )}
                          {org.risk === "safe" && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
