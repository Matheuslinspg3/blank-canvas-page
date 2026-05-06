import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, AlertTriangle, TrendingUp, Gauge, Infinity as InfinityIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSubscription } from "@/hooks/useSubscription";
import { isOrgOnInternalUnlimited } from "@/lib/planLimits";

export function AutomationCreditEstimationCard() {
  const { profile } = useAuth();
  const { currentPlan } = useSubscription();
  const orgId = profile?.organization_id;
  const isUnlimited = isOrgOnInternalUnlimited(currentPlan);

  const { data: wallet } = useQuery({
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

  const { data: recentUsage = [] } = useQuery({
    queryKey: ["automation-credit-usage-stats", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("automation_credit_transactions" as any)
        .select("amount_brl, created_at")
        .eq("organization_id", orgId)
        .eq("type", "usage")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  if (!wallet) return null;

  const balance = Number(wallet?.balance_brl ?? 0);
  const totalMessages = Number(wallet?.total_messages_processed ?? 0);
  const avgCostStored = Number(wallet?.avg_cost_per_message_brl ?? 0);

  const usageCount = recentUsage.length;
  const totalUsageCost = recentUsage.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount_brl)), 0);
  const avgCostPerMessage = avgCostStored > 0 
    ? avgCostStored 
    : usageCount > 0 
      ? totalUsageCost / usageCount 
      : 0.015;

  const estimatedMessagesRemaining = avgCostPerMessage > 0 ? Math.floor(balance / avgCostPerMessage) : 0;
  
  const dailyMessages = usageCount > 0 ? usageCount / 30 : 0;
  const estimatedDaysRemaining = dailyMessages > 0 ? Math.floor(estimatedMessagesRemaining / dailyMessages) : null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7Days = recentUsage.filter((tx: any) => new Date(tx.created_at) >= sevenDaysAgo);
  const weeklyRate = last7Days.length / 7;

  const isCritical = !isUnlimited && balance <= 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Previsão de Uso
        </CardTitle>
        <CardDescription>
          Estimativa com base no consumo recente da sua organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">
              {isUnlimited ? <InfinityIcon className="h-5 w-5 mx-auto text-primary" /> : estimatedMessagesRemaining.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">Mensagens Restantes</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">
              {isUnlimited ? <InfinityIcon className="h-5 w-5 mx-auto text-blue-500" /> : (estimatedDaysRemaining !== null ? `${estimatedDaysRemaining}d` : "—")}
            </p>
            <p className="text-[10px] text-muted-foreground">Dias Restantes</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">{weeklyRate.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Msgs/Dia (7d)</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{totalMessages.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Processado</p>
          </div>
        </div>

        {isUnlimited && (
          <Alert variant="default" className="border-primary bg-primary/5">
            <InfinityIcon className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              Sua organização possui o <strong>Plano Unlimited</strong>. O uso de automações e agente WhatsApp é ilimitado e não consome créditos.
            </AlertDescription>
          </Alert>
        )}

        {!isUnlimited && estimatedDaysRemaining !== null && estimatedDaysRemaining <= 7 && estimatedDaysRemaining > 0 && (
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-400">
              Com o ritmo atual, seus créditos acabam em <strong>{estimatedDaysRemaining} dias</strong>. 
              Considere adquirir créditos extras ou o Addon Automações.
            </AlertDescription>
          </Alert>
        )}

        {isCritical && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Créditos esgotados!</strong> O agente WhatsApp não responderá até que novos créditos sejam adicionados. 
              Aguarde a renovação mensal ou adquira créditos extras.
            </AlertDescription>
          </Alert>
        )}

        {totalMessages > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Total processado: {totalMessages.toLocaleString()} mensagens nos últimos 30 dias
          </p>
        )}
      </CardContent>
    </Card>
  );
}