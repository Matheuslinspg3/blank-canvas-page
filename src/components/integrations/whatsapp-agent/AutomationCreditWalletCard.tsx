import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorProgress } from "@/components/ui/color-progress";
import { Wallet, TrendingDown, TrendingUp, Activity, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AutomationCreditWalletCard() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["automation-credit-wallet", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("automation_credit_wallets" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: recentTx = [] } = useQuery({
    queryKey: ["automation-credit-transactions", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("automation_credit_transactions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando saldo...</div>;

  const balance = Number(wallet?.balance_brl ?? 0);
  const consumed = Number(wallet?.total_consumed_brl ?? 0);
  const recharged = Number(wallet?.total_recharged_brl ?? 0);
  const allowance = Number(wallet?.plan_monthly_allowance_brl ?? 0);

  const totalAvailable = allowance + recharged;
  const usagePercent = totalAvailable > 0 ? Math.min(100, (consumed / totalAvailable) * 100) : 0;
  const balancePercent = totalAvailable > 0 ? (balance / totalAvailable) * 100 : 0;

  // Status badge logic
  const isCritical = balance <= 0.01;
  const isLow = !isCritical && totalAvailable > 0 && balancePercent < 20;
  const isWarning = !isCritical && !isLow && totalAvailable > 0 && balancePercent < 50;

  // Progress bar color
  const progressColor = isCritical
    ? "hsl(0, 84%, 60%)"
    : isLow
      ? "hsl(38, 92%, 50%)"
      : isWarning
        ? "hsl(45, 93%, 47%)"
        : "hsl(142, 71%, 45%)";

  const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <Card className={wallet && isCritical ? "border-destructive" : wallet && isLow ? "border-yellow-500" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" /> Créditos de Automação
          {wallet && isCritical && <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>}
          {wallet && isLow && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Saldo Baixo</Badge>}
          {wallet && !isCritical && !isLow && <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Ativo</Badge>}
          {!wallet && <Badge variant="outline" className="text-[10px]">Pendente</Badge>}
        </CardTitle>
        <CardDescription>
          Saldo do seu agente IA para automações e WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!wallet ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma carteira de automação configurada. Os créditos serão criados automaticamente no primeiro uso.
          </p>
        ) : (<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <Wallet className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold text-green-600">{fmt(balance)}</p>
            <p className="text-[10px] text-muted-foreground">Saldo Atual</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-red-500" />
            <p className="text-lg font-bold">{fmt(consumed)}</p>
            <p className="text-[10px] text-muted-foreground">Total Consumido</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{fmt(recharged)}</p>
            <p className="text-[10px] text-muted-foreground">Total Recarregado</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{fmt(allowance)}</p>
            <p className="text-[10px] text-muted-foreground">Incluso no Plano</p>
          </div>
        </div>

        {totalAvailable > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uso do período</span>
              <span>{usagePercent.toFixed(0)}%</span>
            </div>
            <ColorProgress value={usagePercent} indicatorColor={progressColor} className="h-2" />
          </div>
        )}

        {recentTx.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Últimas Transações</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {recentTx.map((tx: any) => {
                const isCredit = Number(tx.amount_brl) > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant={isCredit ? "default" : "secondary"} className="text-[10px]">
                        {isCredit ? "+" : "−"}
                      </Badge>
                      <span className="truncate max-w-[180px]">{tx.description}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={isCredit ? "text-green-600" : "text-red-500"}>
                        {isCredit ? "+" : "−"}{fmt(Math.abs(Number(tx.amount_brl)))}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>)}
      </CardContent>
    </Card>
  );
}
