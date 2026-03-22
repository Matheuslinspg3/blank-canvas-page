import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, UserCheck, Sparkles, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function BillingTab() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const {
    subscription, currentPlan, loadingSub,
    isTrialActive, getTrialDaysRemaining, getCurrentPlanSlug,
    getFeatureLimit,
  } = useSubscription({ enabled: true });

  // Fetch current usage counts
  const { data: usage } = useQuery({
    queryKey: ["billing-usage", orgId],
    queryFn: async () => {
      if (!orgId) return { properties: 0, leads: 0 };
      const [propRes, leadRes] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);
      return {
        properties: propRes.count || 0,
        leads: leadRes.count || 0,
      };
    },
    enabled: !!orgId,
  });

  if (loadingSub) return <Skeleton className="h-64 rounded-xl" />;

  const planName = currentPlan?.name || "Gratuito";
  const planSlug = getCurrentPlanSlug();
  const trialActive = isTrialActive();
  const trialDays = getTrialDaysRemaining();

  const limits = {
    properties: getFeatureLimit("max_own_properties"),
    leads: getFeatureLimit("max_leads"),
    ai: getFeatureLimit("ai_credits_limit"),
  };

  const usageData = usage || { properties: 0, leads: 0 };

  const pct = (used: number, limit: number) => {
    if (limit === Infinity || limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const fmtLimit = (val: number) => val === Infinity ? "∞" : val.toLocaleString("pt-BR");

  return (
    <div className="grid gap-6 max-w-2xl">
      {/* Trial banner */}
      {trialActive && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Seu trial acaba em {trialDays} {trialDays === 1 ? "dia" : "dias"}</p>
            <p className="text-xs text-muted-foreground">Após o término, você voltará para o plano Gratuito</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/planos")}>
            Ver planos
          </Button>
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Plano atual</CardTitle>
              <CardDescription>Gerencie sua assinatura</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">{planName}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <div className="text-sm text-muted-foreground">
              <p>Status: <span className="font-medium text-foreground capitalize">{subscription.status}</span></p>
              {subscription.current_period_end && (
                <p>Próxima renovação: {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          )}

          <Button className="gap-2" onClick={() => navigate("/planos")}>
            Trocar plano <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Uso atual</CardTitle>
          <CardDescription>Consumo dos recursos do seu plano</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Properties */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Imóveis</span>
              </div>
              <span className="text-muted-foreground">{usageData.properties}/{fmtLimit(limits.properties)}</span>
            </div>
            {limits.properties !== Infinity && <Progress value={pct(usageData.properties, limits.properties)} className="h-2" />}
          </div>

          {/* Leads */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span>Leads</span>
              </div>
              <span className="text-muted-foreground">{usageData.leads}/{fmtLimit(limits.leads)}</span>
            </div>
            {limits.leads !== Infinity && <Progress value={pct(usageData.leads, limits.leads)} className="h-2" />}
          </div>

          {/* AI Credits */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span>Créditos de IA</span>
              </div>
              <span className="text-muted-foreground">—/{fmtLimit(limits.ai)}</span>
            </div>
            {limits.ai !== Infinity && limits.ai > 0 && <Progress value={0} className="h-2" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
