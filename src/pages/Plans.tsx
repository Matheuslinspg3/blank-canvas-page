import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { isInternalPlan, isPublicCommercialPlan } from "@/lib/planLimits";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check, X, Building2, UserCheck, Store,
  Crown, Star, Briefcase,
  ChevronDown, ArrowRight, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Helpers ─── */
const fmt = (cents: number | null | undefined) => {
  const val = (cents ?? 0) / 100;
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const limitDisplay = (val: number | null | undefined) => {
  if (val == null) return "0";
  if (val === -1) return "Ilimitado";
  return val.toLocaleString("pt-BR");
};

const getNumericFeature = (plan: SubscriptionPlan, key: string, fallback = 0) => {
  const features = (plan.features ?? {}) as Record<string, unknown>;
  const featureVal = features[key];
  if (typeof featureVal === "number") return featureVal;

  const topLevelVal = (plan as unknown as Record<string, unknown>)[key];
  if (typeof topLevelVal === "number") return topLevelVal;

  return fallback;
};

/* ─── Plan card config ─── */
interface PlanMeta { icon: React.ElementType; badge?: string; highlighted?: boolean; ctaLabel: string; ctaVariant: "default" | "outline" }

const planMeta: Record<string, PlanMeta> = {
  starter: { icon: Star, badge: "Entrada", ctaLabel: "Selecionar", ctaVariant: "default" },
  essencial: { icon: Briefcase, badge: "Melhor custo", ctaLabel: "Selecionar", ctaVariant: "default" },
  profissional: { icon: Crown, badge: "Mais popular", highlighted: true, ctaLabel: "Selecionar", ctaVariant: "default" },
  business: { icon: Building2, ctaLabel: "Selecionar", ctaVariant: "default" },
};

/* ─── Feature comparison table ─── */
interface FeatureRow {
  label: string;
  key: string;
  type: "bool" | "number";
  category: string;
}

const featureRows: FeatureRow[] = [
  { label: "Imóveis cadastrados", key: "max_own_properties", type: "number", category: "Limites" },
  { label: "Leads no CRM", key: "max_leads", type: "number", category: "Limites" },
  { label: "Imóveis no marketplace", key: "max_marketplace_properties", type: "number", category: "Limites" },
  { label: "Agenda", key: "has_schedule", type: "bool", category: "Recursos" },
  { label: "Marketplace de imóveis", key: "has_marketplace_publish", type: "bool", category: "Recursos" },
  { label: "Contato no marketplace", key: "has_marketplace_contact", type: "bool", category: "Recursos" },
  { label: "CRM", key: "has_crm", type: "bool", category: "Recursos" },
  { label: "CRM com integração", key: "has_import", type: "bool", category: "Recursos" },
  { label: "Financeiro", key: "has_financial", type: "bool", category: "Recursos" },
  { label: "Gerenciamento de equipe", key: "has_team_management", type: "bool", category: "Recursos" },
  { label: "Relatórios", key: "has_reports", type: "bool", category: "Recursos" },
  { label: "Automações", key: "automations_limit", type: "number", category: "Recursos" },
];

const FAQ_ITEMS = [
  { q: "Quais são os planos públicos?", a: "Starter, Essencial, Profissional e Imobiliária. Planos antigos ou internos não aparecem nos cards públicos de assinatura." },
  { q: "Posso testar antes de pagar?", a: "Sim. Os quatro planos têm 15 dias grátis para teste, sem necessidade de cartão no trial." },
  { q: "Posso trocar de plano?", a: "Sim. Upgrades podem ser feitos pelo checkout e a mensalidade recorrente continua sendo somente o valor do plano escolhido." },
  { q: "Posso cancelar?", a: "Sim, sem multa. Você mantém acesso até o fim do período pago." },
];


/* ─── Main Features for card display ─── */
const mainFeatureKeys = [
  { key: "has_schedule", label: "Agenda" },
  { key: "has_marketplace_publish", label: "Marketplace de imóveis" },
  { key: "has_crm", label: "CRM" },
  { key: "has_import", label: "CRM com integração" },
  { key: "has_financial", label: "Financeiro" },
  { key: "has_team_management", label: "Gerenciamento de equipe" },
  { key: "has_reports", label: "Relatórios" },
];

/* ─── Component ─── */
export default function Plans() {
  const [annual, setAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const navigate = useNavigate();
  const { session } = useAuth();
  const { subscription, currentPlan, isTrialActive, getTrialDaysRemaining, getCurrentPlanSlug, canUpgradeTo } = useSubscription({ enabled: !!session });
  const isLoggedIn = !!session;

  // Prices shown here must match the backend checkout amount from subscription_plans.

  const { data: allPlans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      // Filter out internal/non-public plans (e.g. internal_unlimited) so they
      // never appear in public plan listings or upgrade UIs.
      return (data as SubscriptionPlan[]).filter((p) => !isInternalPlan(p));
    },
  });

  const mainPlans = useMemo(() => allPlans.filter(isPublicCommercialPlan), [allPlans]);
  

  const currentSlug = isLoggedIn ? getCurrentPlanSlug() : null;
  const trialActive = isLoggedIn ? isTrialActive() : false;
  const trialDays = isLoggedIn ? getTrialDaysRemaining() : 0;

  // Check if user needs to pay (trial, trial expired, free plan, or subscription not truly active)
  const isOnTrial = subscription?.status === "trial";
  const isSubPaidActive = subscription?.status === "active";
  const needsToPay = isLoggedIn && (
    !isSubPaidActive ||
    currentSlug === "gratuito" ||
    isOnTrial ||
    subscription?.status === "expired" ||
    subscription?.status === "cancelled"
  );

  const getCtaProps = (plan: SubscriptionPlan) => {
    const meta = planMeta[plan.slug] || { ctaLabel: "Selecionar", ctaVariant: "default" as const };
    const isCurrent = currentSlug === plan.slug;
    const trialDaysPlan = (plan as any).trial_days || 0;

    if (!isLoggedIn) {
      // Show trial info for non-logged-in users
      const label = trialDaysPlan > 0 ? `Testar ${trialDaysPlan} dias grátis` : meta.ctaLabel;
      return { label, disabled: false, action: () => navigate("/auth") };
    }
    
    // If user needs to pay (trial expired, free plan, etc), allow selecting ANY paid plan
    if (needsToPay) {
      return { 
        label: isCurrent ? "Assinar este plano" : "Selecionar plano", 
        disabled: false, 
        action: () => setCheckoutPlan(plan) 
      };
    }

    // Active paid subscription — normal upgrade/current logic
    if (isCurrent) return { label: "Plano atual", disabled: true, action: () => {} };
    if (canUpgradeTo(plan.slug)) return { label: "Fazer upgrade", disabled: false, action: () => setCheckoutPlan(plan) };
    return { label: "Plano inferior", disabled: true, action: () => {} };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Skeleton className="h-12 w-96 mx-auto mb-4" />
          <Skeleton className="h-6 w-64 mx-auto mb-12" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-[500px] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Current plan banner (logged in) ─── */}
      {isLoggedIn && currentPlan && (
        <div className="bg-muted/50 border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                {currentPlan.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {trialActive
                  ? `Trial — ${trialDays} ${trialDays === 1 ? "dia restante" : "dias restantes"}`
                  : "Plano ativo"}
              </span>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]" onClick={() => navigate("/configuracoes?tab=billing")}>
              Gerenciar assinatura
            </Button>
          </div>
        </div>
      )}


      {/* ─── HEADER ─── */}
      <section className="py-16 sm:py-20 text-center px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-foreground mb-4">
          {isLoggedIn ? "Escolha o plano ideal" : "Gerencie sua imobiliária com"}{" "}
          <span className="text-primary">{isLoggedIn ? "para sua operação" : "imobiliária"}</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          {isLoggedIn
            ? "Compare os planos e faça upgrade para desbloquear mais recursos"
            : "CRM, Marketplace, Agenda e Financeiro — tudo em um só lugar"}
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 bg-muted/50 rounded-full px-4 py-2 border my-2">
          <span className={cn("text-sm font-medium transition-colors", !annual ? "text-foreground" : "text-muted-foreground")}>Mensal</span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={cn("text-sm font-medium transition-colors", annual ? "text-foreground" : "text-muted-foreground")}>Anual</span>
          {annual && (
            <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-xs">
              Economize 2 meses
            </Badge>
          )}
        </div>
      </section>

      {/* ─── PLAN CARDS ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mainPlans.map((plan) => {
            const f = plan.features as Record<string, any> || {};
            const meta: PlanMeta = planMeta[plan.slug] || { icon: Star, ctaLabel: "Selecionar", ctaVariant: "default" as const };
            const Icon = meta.icon;
            const isCurrent = currentSlug === plan.slug;
            const maxOwnProperties = getNumericFeature(plan, "max_own_properties");
            const maxLeads = getNumericFeature(plan, "max_leads");
            const maxMarketplaceProperties = getNumericFeature(plan, "max_marketplace_properties");
            const monthlyPrice = annual ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
            const trialDaysPlan = (plan as any).trial_days || 0;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col relative transition-all",
                  meta.highlighted && "border-primary ring-2 ring-primary/20 shadow-lg sm:scale-[1.02]",
                  isCurrent && !meta.highlighted && "ring-2 ring-primary shadow-lg shadow-primary/20 border-primary/50"
                )}
              >
                {meta.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">{meta.badge}</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-3">
                    <Badge variant="secondary" className="shadow-sm">
                      {trialActive ? `${trialDays}d restantes` : "Plano atual"}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2 pt-6">
                  <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">R${fmt(monthlyPrice)}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                  {annual && plan.price_yearly > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      R${fmt(plan.price_yearly)} cobrado anualmente
                    </p>
                  )}
                  {trialDaysPlan > 0 && !needsToPay && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {trialDaysPlan} dias grátis
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <Separator className="mb-4" />

                  {/* Limits */}
                  <div className="space-y-2.5 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{limitDisplay(maxOwnProperties)} imóveis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{limitDisplay(maxLeads)} leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{maxMarketplaceProperties === 0 ? "Sem marketplace" : `${limitDisplay(maxMarketplaceProperties)} no marketplace`}</span>
                    </div>
                  </div>

                  {/* Main features */}
                  <div className="space-y-1.5 mb-4 text-sm flex-1">
                    {mainFeatureKeys.map(({ key, label }) => {
                      const has = f[key] === true;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          {has ? (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={cn(!has && "text-muted-foreground/60")}>{label}</span>
                        </div>
                      );
                    })}
                  </div>


                  {/* CTA */}
                  {(() => {
                    const cta = getCtaProps(plan);
                    return (
                      <Button
                        variant={meta.ctaVariant}
                        className={cn("w-full mt-auto min-h-[44px]", meta.highlighted && "shadow-md")}
                        onClick={cta.action}
                        disabled={cta.disabled}
                      >
                        {cta.label}
                        {!cta.disabled && <ArrowRight className="h-4 w-4 ml-1" />}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>


      {/* ─── COMPARISON TABLE ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="flex items-center gap-2 mx-auto text-sm font-medium text-primary hover:underline mb-4"
        >
          Comparar todos os planos em detalhe
          <ChevronDown className={cn("h-4 w-4 transition-transform", showComparison && "rotate-180")} />
        </button>

        {showComparison && (
          <div className="relative">
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium min-w-[200px]">Recurso</th>
                    {mainPlans.map((p) => (
                      <th
                        key={p.id}
                        className={cn(
                          "text-center p-3 font-medium min-w-[120px]",
                          p.slug === "profissional" && "bg-primary/5"
                        )}
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const categories = [...new Set(featureRows.map(r => r.category))];
                    return categories.map(cat => (
                      <>
                        <tr key={`cat-${cat}`} className="border-b bg-muted/10">
                          <td colSpan={mainPlans.length + 1} className="p-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            {cat}
                          </td>
                        </tr>
                        {featureRows.filter(r => r.category === cat).map(row => (
                          <tr key={row.key} className="border-b hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{row.label}</td>
                            {mainPlans.map(p => {
                              const f = (p.features as Record<string, any>) || {};
                              const val = f[row.key] ?? (p as Record<string, any>)[row.key];
                              const isPro = p.slug === "profissional";

                              let display: React.ReactNode;
                              if (row.type === "bool") {
                                display = val ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
                              } else {
                                display = val === -1 ? "∞" : val === 0 ? "—" : val?.toLocaleString("pt-BR") || "—";
                              }

                              return (
                                <td key={p.id} className={cn("p-3 text-center", isPro && "bg-primary/5")}>
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden rounded-r-xl" />
          </div>
        )}
      </section>

      {/* ─── FAQ ─── */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
              <AccordionTrigger className="text-left font-medium text-sm hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ─── FINAL CTA ─── */}
      {!isLoggedIn && (
        <section className="bg-muted/30 border-t">
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Pronto para transformar sua imobiliária?
            </h2>
            <p className="text-muted-foreground mb-8">
              Comece grátis e teste por 15 dias sem compromisso
            </p>
            <Button size="lg" className="text-base px-8 py-6 shadow-lg" onClick={() => navigate("/auth")}>
              Criar conta grátis
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Sem cartão · Sem compromisso · Cancele quando quiser
            </p>
            <a
              href="https://wa.me/5562984459171?text=Ol%C3%A1%2C%20tenho%20d%C3%BAvidas%20sobre%20os%20planos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-3 inline-block"
            >
              Dúvidas? Fale conosco
            </a>
          </div>
        </section>
      )}

      {/* Checkout dialog */}
      <CheckoutDialog
        open={!!checkoutPlan}
        onOpenChange={(open) => { if (!open) setCheckoutPlan(null); }}
        plan={checkoutPlan}
      />
    </div>
  );
}
