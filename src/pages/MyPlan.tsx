import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Building2,
  UserCheck,
  Sparkles,
  Check,
  Crown,
  CreditCard,
  Calendar,
  ExternalLink,
  XCircle,
  Clock,
  
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";



function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
    trial: { label: "Trial", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    pending: { label: "Pendente", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    overdue: { label: "Vencido", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-muted" },
  };
  const s = map[status] || map.cancelled;
  return <Badge variant="outline" className={cn("text-xs font-medium", s.cls)}>{s.label}</Badge>;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Pago", cls: "bg-green-500/10 text-green-600" },
    pending: { label: "Pendente", cls: "bg-yellow-500/10 text-yellow-600" },
    overdue: { label: "Vencido", cls: "bg-destructive/10 text-destructive" },
    refunded: { label: "Estornado", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px]", s.cls)}>{s.label}</Badge>;
}

export default function MyPlan() {
  const { profile } = useAuth();
  const { isAdminOrAbove, isLoading: rolesLoading } = useUserRoles();
  const orgId = profile?.organization_id;
  const {
    plans, mainPlans, subscription, payments, currentPlan,
    loadingSub, loadingPlans, loadingPayments,
    isActive, isPending, isOverdue, isCancelled,
    isTrialActive, getTrialDaysRemaining, getCurrentPlanSlug,
    getFeatureLimit, cancel,
  } = useSubscription({ enabled: true });

  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [billingToggle, setBillingToggle] = useState<"monthly" | "yearly">("monthly");

  // Usage counts
  const { data: usage } = useQuery({
    queryKey: ["billing-usage", orgId],
    queryFn: async () => {
      if (!orgId) return { properties: 0, leads: 0 };
      const [propRes, leadRes] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);
      return { properties: propRes.count || 0, leads: leadRes.count || 0 };
    },
    enabled: !!orgId,
  });

  const trialActive = isTrialActive();
  const trialDays = getTrialDaysRemaining();
  const planSlug = getCurrentPlanSlug();
  const usageData = usage || { properties: 0, leads: 0 };

  const limits = {
    properties: getFeatureLimit("max_own_properties"),
    leads: getFeatureLimit("max_leads"),
    ai: getFeatureLimit("ai_credits_limit"),
  };

  const pct = (used: number, limit: number) => {
    if (limit === Infinity || limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };
  const fmtLimit = (val: number) => (val === Infinity ? "∞" : val.toLocaleString("pt-BR"));

  // Days until expiry
  const daysUntilExpiry = subscription?.current_period_end
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000)
    : Infinity;
  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  // Available plans for display (exclude addons)
  const displayPlans = (mainPlans.length > 0 ? mainPlans : plans).filter(
    (p) => (p as any).plan_type !== "addon"
  );

  if (loadingSub || loadingPlans || rolesLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Only admins, sub_admins, developers, and leaders can access this page
  if (!isAdminOrAbove) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet><title>Meu Plano | Porta do Corretor</title></Helmet>
      <div className="space-y-6">
        <PageHeader title="Meu Plano" description="Gerencie sua assinatura, uso e pagamentos" />

        {/* ── Section A: Alert Banners ── */}

        {(isOverdue || isCancelled) && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {isOverdue ? "Seu plano está vencido" : "Sua assinatura foi cancelada"}
              </p>
              <p className="text-xs text-muted-foreground">
                Renove para continuar usando todos os recursos do Porta do Corretor
              </p>
            </div>
          </div>
        )}

        {isExpiringSoon && !isOverdue && !isCancelled && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Seu plano vence em {daysUntilExpiry} {daysUntilExpiry === 1 ? "dia" : "dias"}
              </p>
              <p className="text-xs text-muted-foreground">Renove para não perder acesso</p>
            </div>
          </div>
        )}

        {trialActive && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Seu trial acaba em {trialDays} {trialDays === 1 ? "dia" : "dias"}
              </p>
              <p className="text-xs text-muted-foreground">Assine um plano para manter o acesso</p>
            </div>
          </div>
        )}

        {/* ── Section B: Current Plan Status + Usage ── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Plan Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Plano atual</CardTitle>
                <StatusBadge status={subscription?.status || "cancelled"} />
              </div>
              <CardDescription>{currentPlan?.description || "Sem plano ativo"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{currentPlan?.name || "Gratuito"}</p>
                  {subscription?.billing_cycle && (
                    <p className="text-xs text-muted-foreground capitalize">
                      Ciclo {subscription.billing_cycle === "yearly" ? "anual" : "mensal"}
                    </p>
                  )}
                </div>
              </div>

              {subscription?.current_period_end && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Próxima renovação:{" "}
                    {format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {(isOverdue || isCancelled || trialActive) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setCheckoutPlan(currentPlan || displayPlans[0] || null);
                    }}
                  >
                    Renovar plano
                  </Button>
                )}
                {isActive && !trialActive && subscription?.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                  >
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uso atual</CardTitle>
              <CardDescription>Consumo dos recursos do seu plano</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageRow icon={Building2} label="Imóveis" used={usageData.properties} limit={limits.properties} pct={pct} fmtLimit={fmtLimit} />
              <UsageRow icon={UserCheck} label="Leads" used={usageData.leads} limit={limits.leads} pct={pct} fmtLimit={fmtLimit} />
              <UsageRow icon={Sparkles} label="Créditos de IA" used={0} limit={limits.ai} pct={pct} fmtLimit={fmtLimit} />
            </CardContent>
          </Card>
        </div>

        {/* ── Section C: Available Plans ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Planos disponíveis</h2>
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <button
                onClick={() => setBillingToggle("monthly")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  billingToggle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingToggle("yearly")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  billingToggle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                Anual
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayPlans.map((plan) => {
              const isCurrent = plan.slug === planSlug;
              const price = billingToggle === "yearly" ? plan.price_yearly : plan.price_monthly;
              const monthlyEq = billingToggle === "yearly" ? plan.price_yearly / 12 : plan.price_monthly;
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col transition-all hover:shadow-md",
                    isCurrent && "ring-2 ring-primary"
                  )}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px]">Plano atual</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2 pt-5">
                    <CardTitle className="text-sm">{plan.name}</CardTitle>
                    <div className="pt-1">
                      <span className="text-2xl font-bold">
                        R$ {Math.round(monthlyEq / 100)}
                      </span>
                      <span className="text-xs text-muted-foreground">/mês</span>
                    </div>
                    {billingToggle === "yearly" && (
                      <p className="text-[10px] text-muted-foreground">
                        R$ {(Number(price) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/ano
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 text-xs">
                    <PlanFeature label={`${plan.max_own_properties === null || plan.max_own_properties === -1 ? "Ilimitado" : fmtLimit(plan.max_own_properties ?? 0)} imóveis`} />
                    <PlanFeature label={`${plan.max_leads === null || plan.max_leads === -1 ? "Ilimitado" : fmtLimit(plan.max_leads ?? 0)} leads`} />
                    {plan.marketplace_access && <PlanFeature label="Marketplace" />}
                    {plan.priority_support && <PlanFeature label="Suporte prioritário" />}
                    {plan.features && (plan.features as any).has_contracts && <PlanFeature label="Contratos" />}
                    {plan.features && (plan.features as any).has_financial && <PlanFeature label="Financeiro" />}
                    {plan.features && (plan.features as any).has_whatsapp && <PlanFeature label="WhatsApp" />}
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Button
                      variant={isCurrent ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                      disabled={isCurrent}
                      onClick={() => setCheckoutPlan(plan)}
                    >
                      {isCurrent ? "Plano atual" : price === 0 ? "Grátis" : "Assinar"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── Section D: Payment History ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de pagamentos</CardTitle>
            <CardDescription>Últimos pagamentos realizados</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pagamento registrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Data</th>
                      <th className="py-2 pr-4 font-medium">Valor</th>
                      <th className="py-2 pr-4 font-medium">Método</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 20).map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4">
                          {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          R$ {(p.amount_cents / 100).toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-4 capitalize text-muted-foreground">
                          {p.method === "pix" ? "PIX" : p.method === "credit_card" ? "Cartão" : p.method || "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="py-2.5">
                          {p.invoice_url && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                              <a href={p.invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                                Fatura
                              </a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CheckoutDialog
        open={!!checkoutPlan}
        onOpenChange={(open) => {
          if (!open) setCheckoutPlan(null);
        }}
        plan={checkoutPlan}
      />
    </>
  );
}

// ── Helpers ──

function UsageRow({
  icon: Icon,
  label,
  used,
  limit,
  pct,
  fmtLimit,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  pct: (u: number, l: number) => number;
  fmtLimit: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className="text-muted-foreground">
          {used}/{fmtLimit(limit)}
        </span>
      </div>
      {limit !== Infinity && limit > 0 && <Progress value={pct(used, limit)} className="h-2" />}
    </div>
  );
}

function PlanFeature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Check className="h-3 w-3 text-primary shrink-0" />
      <span>{label}</span>
    </div>
  );
}
