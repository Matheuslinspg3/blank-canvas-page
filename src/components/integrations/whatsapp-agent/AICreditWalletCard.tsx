import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingDown, TrendingUp, Activity, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AICreditWalletCard() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["ai-credit-wallet", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("ai_credit_wallets" as any)
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
    queryKey: ["ai-credit-transactions", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("ai_credit_transactions" as any)
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

  const balance = Number(wallet?.balance_usd ?? 0);
  const consumed = Number(wallet?.total_consumed_usd ?? 0);
  const recharged = Number(wallet?.total_recharged_usd ?? 0);
  const allowance = Number(wallet?.plan_monthly_allowance_usd ?? 0);
  const markup = Number(wallet?.markup_multiplier ?? 3);

  const usagePercent = allowance > 0 ? Math.min(100, (consumed / (allowance + recharged)) * 100) : 0;

  const formatUsd = (v: number) => `$${v.toFixed(4)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Créditos de IA
        </CardTitle>
        <CardDescription>
          Saldo e consumo de tokens. Markup: {markup}x sobre custo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold text-green-600">{formatUsd(balance)}</p>
            <p className="text-[10px] text-muted-foreground">Saldo Atual</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-red-500" />
            <p className="text-lg font-bold">{formatUsd(consumed)}</p>
            <p className="text-[10px] text-muted-foreground">Total Consumido</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{formatUsd(recharged)}</p>
            <p className="text-[10px] text-muted-foreground">Total Recarregado</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{formatUsd(allowance)}</p>
            <p className="text-[10px] text-muted-foreground">Incluso no Plano</p>
          </div>
        </div>

        {/* Usage bar */}
        {(allowance + recharged) > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uso do período</span>
              <span>{usagePercent.toFixed(0)}%</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
        )}

        {!wallet && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhuma carteira de créditos configurada. Entre em contato com o suporte para ativar.
          </p>
        )}

        {/* Recent transactions */}
        {recentTx.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Últimas Transações</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {recentTx.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={tx.type === "credit" ? "default" : "secondary"} className="text-[10px]">
                      {tx.type === "credit" ? "+" : "-"}
                    </Badge>
                    <span className="truncate max-w-[180px]">{tx.description}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={tx.type === "credit" ? "text-green-600" : "text-red-500"}>
                      {tx.type === "credit" ? "+" : "-"}{formatUsd(Number(tx.amount_usd))}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
