import { useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { useFreeTrialExpired } from "@/hooks/useFreeTrialExpired";
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
  Check, X, Users, Building2, UserCheck, HardDrive, Sparkles, Store,
  Crown, Star, Briefcase, Zap, MessageCircle, Bot, Workflow,
  ChevronDown, ArrowRight, Shield, Clock, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Helpers ─── */
const fmt = (cents: number | null | undefined) => {
  const val = (cents ?? 0) / 100;
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (cents: number | null | undefined) => {
  return Math.floor((cents ?? 0) / 100).toLocaleString("pt-BR");
};

const storageFmt = (mb: number | null | undefined) => {
  const v = mb ?? 0;
  if (v >= 1024) return `${(v / 1024).toFixed(0)} GB`;
  return `${v} MB`;
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
  gratuito: { icon: Shield, ctaLabel: "Começar grátis", ctaVariant: "outline" },
  starter: { icon: Star, ctaLabel: "Selecionar", ctaVariant: "default" },
  correspondente: { icon: Landmark, badge: "Para Financiamentos", ctaLabel: "Selecionar", ctaVariant: "default" },
  essencial: { icon: Briefcase, badge: "Melhor custo", ctaLabel: "Selecionar", ctaVariant: "default" },
  profissional: { icon: Crown, badge: "Mais popular", highlighted: true, ctaLabel: "Selecionar", ctaVariant: "default" },
  business: { icon: Building2, ctaLabel: "Selecionar", ctaVariant: "default" },
};

/* ─── Feature comparison table ─── */
interface FeatureRow {
  label: string;
  key: string;
  type: "bool" | "number" | "storage" | "text";
  category: string;
}

const featureRows: FeatureRow[] = [
  // Limites
  { label: "Usuários", key: "max_users", type: "number", category: "Limites" },
  { label: "Imóveis próprios", key: "max_own_properties", type: "number", category: "Limites" },
  { label: "Leads", key: "max_leads", type: "number", category: "Limites" },
  { label: "Imóveis marketplace", key: "max_marketplace_properties", type: "number", category: "Limites" },
  { label: "Armazenamento", key: "max_storage_mb", type: "storage", category: "Limites" },
  // CRM
  { label: "Financeiro", key: "has_financial", type: "bool", category: "CRM" },
  { label: "Contratos", key: "has_contracts", type: "bool", category: "CRM" },
  { label: "Comissões", key: "has_commissions", type: "bool", category: "CRM" },
  { label: "Proprietários", key: "has_owners", type: "bool", category: "CRM" },
  { label: "Importação de dados", key: "has_import", type: "bool", category: "CRM" },
  { label: "Relatórios", key: "has_reports", type: "bool", category: "CRM" },
  { label: "Log de auditoria", key: "has_audit_log", type: "bool", category: "CRM" },
  // Créditos de IA
  { label: "Créditos de IA/mês", key: "ai_credits_limit", type: "number", category: "Créditos de IA" },
  { label: "Artes com IA/mês", key: "ai_art_limit", type: "number", category: "Créditos de IA" },
  { label: "Landing pages IA/mês", key: "ai_landing_limit", type: "number", category: "Créditos de IA" },
  { label: "Vídeos com IA/mês", key: "ai_video_limit", type: "number", category: "Créditos de IA" },
  { label: "Extração PDF com IA", key: "has_pdf_extract", type: "bool", category: "Créditos de IA" },
  { label: "Contratos com IA", key: "has_contract_ai", type: "bool", category: "Créditos de IA" },
  { label: "Análise de fotos IA", key: "has_photo_analysis", type: "bool", category: "Créditos de IA" },
  // WhatsApp / Automações
  { label: "WhatsApp integrado", key: "has_whatsapp", type: "bool", category: "WhatsApp / Automações" },
  { label: "Automações", key: "has_automations", type: "bool", category: "WhatsApp / Automações" },
  { label: "Limite automações", key: "automations_limit", type: "number", category: "WhatsApp / Automações" },
  { label: "Push notifications", key: "has_push_notifications", type: "bool", category: "WhatsApp / Automações" },
  { label: "Email automation", key: "has_email_automation", type: "bool", category: "WhatsApp / Automações" },
  // Integrações
  { label: "Marketplace publicação", key: "has_marketplace_publish", type: "bool", category: "Integrações" },
  { label: "Marketplace contato", key: "has_marketplace_contact", type: "bool", category: "Integrações" },
  { label: "Parcerias", key: "has_partnerships", type: "bool", category: "Integrações" },
  { label: "Meta Ads", key: "has_meta_ads", type: "bool", category: "Integrações" },
  { label: "RD Station", key: "has_rd_station", type: "bool", category: "Integrações" },
  { label: "Feed XML", key: "has_xml_feed", type: "bool", category: "Integrações" },
  { label: "Landing pages", key: "has_landing_pages", type: "bool", category: "Integrações" },
  // Extras
  { label: "Suporte prioritário", key: "has_priority_support", type: "bool", category: "Extras" },
  { label: "Nível suporte", key: "support_level", type: "text", category: "Extras" },
];

const supportLabels: Record<string, string> = {
  chat_ai: "Chat IA",
  email: "E-mail",
  whatsapp: "WhatsApp",
  priority: "Prioritário",
};

const FAQ_ITEMS = [
  { q: "Posso trocar de plano?", a: "Sim! O upgrade é imediato e o downgrade acontece no próximo ciclo de cobrança." },
  { q: "O que acontece quando o trial acaba?", a: "Você volta automaticamente para o plano Gratuito. Todos os seus dados são mantidos." },
  { q: "Preciso de cartão para o trial?", a: "Não. O período de teste é 100% gratuito, sem necessidade de cartão de crédito." },
  { q: "Posso adicionar mais usuários?", a: "Sim! No Essencial custa R$19,90/mês por membro extra, no Profissional R$14,90/mês. No Business é ilimitado." },
  { q: "O que são créditos de IA?", a: "Cada geração de texto, resumo ou análise consome 1 crédito de IA. Artes e vídeos têm contagem separada." },
  { q: "Posso comprar mais créditos?", a: "Sim! Com o Pacote IA Extra por R$29,90/mês você ganha +50 créditos, +10 artes e +5 landing pages." },
  { q: "Como funciona o WhatsApp?", a: "Integração com WhatsApp Business para notificações e atendimento. Incluso no Profissional e Business, ou disponível como addon por R$49,90/mês no Essencial." },
  { q: "O que são automações?", a: "Fluxos automáticos: lead chega → notificação WhatsApp, imóvel publicado → anúncio nos portais, e muito mais." },
  { q: "Meus dados ficam seguros?", a: "Sim! Criptografia SSL, Row Level Security (RLS), backups diários e infraestrutura de última geração." },
  { q: "Posso cancelar?", a: "Sim, sem multa. Você mantém acesso até o fim do período pago." },
];

const addonMeta: Record<string, { icon: React.ElementType; bullets: string[] }> = {
  ia: { icon: Sparkles, bullets: ["+50 créditos de IA", "+10 artes com IA", "+5 landing pages"] },
  whatsapp: { icon: MessageCircle, bullets: ["WhatsApp Business integrado", "Valentina IA no WhatsApp", "Notificações de leads"] },
  automations: { icon: Workflow, bullets: ["+5 automações extras", "Templates prontos de automação", "Fluxos avançados"] },
};

/* ─── Main Features for card display ─── */
const mainFeatureKeys = [
  { key: "has_financial", label: "Financeiro" },
  { key: "has_contracts", label: "Contratos" },
  { key: "has_owners", label: "Proprietários" },
  { key: "has_whatsapp", label: "WhatsApp" },
  { key: "has_automations", label: "Automações" },
  { key: "has_import", label: "Importação" },
  { key: "has_meta_ads", label: "Meta Ads" },
  { key: "has_reports", label: "Relatórios" },
];

/* ─── Component ─── */
export default function Plans() {
  const [annual, setAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { subscription, currentPlan, isTrialActive, getTrialDaysRemaining, getCurrentPlanSlug, canUpgradeTo } = useSubscription({ enabled: !!session });
  const { qualifiesForDiscount } = useFreeTrialExpired();
  const isLoggedIn = !!session;

  // 25% discount: from URL param (free expired redirect) or from being on free plan
  const hasDiscount = searchParams.get("discount") === "free25" || (isLoggedIn && qualifiesForDiscount);
  const DISCOUNT_PCT = 25;

  const { data: allPlans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  const mainPlans = useMemo(() => allPlans.filter((p) => (p as any).plan_type === 'plan'), [allPlans]);
  const addons = useMemo(() => allPlans.filter(p => (p as any).plan_type === 'addon'), [allPlans]);

  const currentSlug = isLoggedIn ? getCurrentPlanSlug() : null;
  const trialActive = isLoggedIn ? isTrialActive() : false;
  const trialDays = isLoggedIn ? getTrialDaysRemaining() : 0;

  const applyDiscount = (cents: number) => {
    if (!hasDiscount) return cents;
    return Math.round(cents * (1 - DISCOUNT_PCT / 100));
  };

  // Check if user needs to pay (trial, trial expired, free plan, or subscription not truly active)
  const isOnTrial = subscription?.status === "trial";
  const isSubPaidActive = subscription?.status === "active";
  const needsToPay = isLoggedIn && (
    !isSubPaidActive ||
    currentSlug === "gratuito" ||
    qualifiesForDiscount ||
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
    
    // Free plan can't be "selected" — it's the default
    if (plan.slug === "gratuito") {
      if (isCurrent) return { label: "Plano atual", disabled: true, action: () => {} };
      return { label: "Plano gratuito", disabled: true, action: () => {} };
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
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[500px] rounded-xl" />)}
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
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {currentPlan.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {trialActive
                  ? `Trial — ${trialDays} ${trialDays === 1 ? "dia restante" : "dias restantes"}`
                  : "Plano ativo"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes?tab=billing")}>
              Gerenciar assinatura
            </Button>
          </div>
        </div>
      )}

      {/* ─── Discount banner ─── */}
      {hasDiscount && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="max-w-7xl mx-auto px-4 py-3 text-center">
            <span className="text-sm font-medium text-primary">
              🎉 Desconto exclusivo de {DISCOUNT_PCT}% aplicado em todos os planos!
            </span>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <section className="py-16 sm:py-20 text-center px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-foreground mb-4">
          {isLoggedIn ? "Escolha o plano ideal" : "Gerencie sua imobiliária com"}{" "}
          <span className="text-primary">{isLoggedIn ? "para sua operação" : "Inteligência Artificial"}</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          {isLoggedIn
            ? "Compare os planos e faça upgrade para desbloquear mais recursos"
            : "CRM, Marketplace, IA e Automações — tudo em um só lugar"}
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 bg-muted/50 rounded-full px-4 py-2 border">
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
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-visible md:pb-0">
          {mainPlans.map((plan) => {
            const f = plan.features as Record<string, any> || {};
            const meta: PlanMeta = planMeta[plan.slug] || { icon: Star, ctaLabel: "Selecionar", ctaVariant: "default" as const };
            const Icon = meta.icon;
            const isCurrent = currentSlug === plan.slug;
            const maxUsers = getNumericFeature(plan, "max_users");
            const maxOwnProperties = getNumericFeature(plan, "max_own_properties");
            const maxLeads = getNumericFeature(plan, "max_leads");
            const maxStorageMb = getNumericFeature(plan, "max_storage_mb");
            const aiCreditsLimit = getNumericFeature(plan, "ai_credits_limit");
            const maxMarketplaceProperties = getNumericFeature(plan, "max_marketplace_properties");
            const extraUserPrice = getNumericFeature(plan, "extra_user_price");
            const originalPrice = annual ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
            const monthlyPrice = plan.slug !== 'gratuito' ? applyDiscount(originalPrice) : originalPrice;
            const showStrikethrough = hasDiscount && plan.slug !== 'gratuito' && monthlyPrice !== originalPrice;
            const trialDaysPlan = (plan as any).trial_days || 0;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "min-w-[280px] snap-center flex flex-col relative transition-all",
                  meta.highlighted && "border-primary ring-2 ring-primary/20 shadow-lg scale-[1.02]",
                  isCurrent && "border-primary/50"
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
                    {showStrikethrough && (
                      <span className="text-lg text-muted-foreground line-through mr-2">R${fmt(originalPrice)}</span>
                    )}
                    <span className="text-3xl font-bold">R${fmt(monthlyPrice)}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                    {showStrikethrough && (
                      <Badge className="ml-2 bg-green-500/15 text-green-600 border-green-500/20 text-xs">-{DISCOUNT_PCT}%</Badge>
                    )}
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
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{limitDisplay(maxUsers)} {maxUsers === 1 ? "usuário" : "usuários"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{limitDisplay(maxOwnProperties)} imóveis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{limitDisplay(maxLeads)} leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{storageFmt(maxStorageMb)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{aiCreditsLimit === 0 ? "Sem IA" : `${limitDisplay(aiCreditsLimit)} créditos IA`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{maxMarketplaceProperties === 0 ? "Sem marketplace" : `${limitDisplay(maxMarketplaceProperties)} marketplace`}</span>
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

                  {extraUserPrice > 0 && (
                    <p className="text-xs text-muted-foreground mb-4">
                      +R${fmt(extraUserPrice)} por membro extra
                    </p>
                  )}

                  {/* CTA */}
                  {(() => {
                    const cta = getCtaProps(plan);
                    return (
                      <Button
                        variant={meta.ctaVariant}
                        className={cn("w-full mt-auto", meta.highlighted && "shadow-md")}
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

      {/* ─── ADDONS ─── */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center mb-2">Potencialize seu plano</h2>
        <p className="text-muted-foreground text-center mb-8">Módulos extras para expandir sua operação</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {addons.map((addon) => {
            const f = addon.features as Record<string, any> || {};
            const type = f.addon_type as string;
            const meta = addonMeta[type];
            if (!meta) return null;
            const Icon = meta.icon;

            return (
              <Card key={addon.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{addon.name}</h3>
                      <p className="text-sm font-medium text-primary">
                        R${fmt(annual ? Math.round(addon.price_yearly / 12) : addon.price_monthly)}/mês
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-1.5 text-sm mb-4 flex-1">
                    {meta.bullets.map((b, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mb-3">
                    A partir do plano <span className="font-medium capitalize">{f.requires_min_plan}</span>
                  </p>
                  <Button variant="ghost" size="sm" className="w-full">
                    Saiba mais
                  </Button>
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
                            } else if (row.type === "storage") {
                              display = storageFmt(val || 0);
                            } else if (row.type === "text") {
                              display = supportLabels[val] || val || "—";
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
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20d%C3%BAvidas%20sobre%20os%20planos"
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
