import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_own_properties: number | null;
  max_users: number | null;
  max_leads: number | null;
  marketplace_access: boolean;
  partnership_access: boolean;
  priority_support: boolean;
  features: Record<string, any> | null;
  display_order: number;
  plan_type?: string;
  trial_days?: number;
  discount_percent?: number;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  payment_method: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  trial_end: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

export interface BillingPayment {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  provider: string;
  provider_payment_id: string | null;
  amount_cents: number;
  method: string | null;
  status: string;
  invoice_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  created_at: string;
  paid_at: string | null;
}

export type PlanLine = "marketplace" | "erp" | "combo" | "main";

const PLAN_ORDER = ['gratuito', 'starter', 'correspondente', 'essencial', 'profissional', 'business'];

const ENTERPRISE_UNLIMITED_KEYS = new Set([
  'max_own_properties',
  'max_leads',
  'max_users',
  'max_marketplace_properties',
  'max_storage_mb',
  'ai_credits_limit',
]);

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function getPlanLine(plan: SubscriptionPlan | null | undefined): PlanLine | null {
  if (!plan?.features) return null;
  return (plan.features as Record<string, any>).line as PlanLine ?? null;
}

export function hasFeature(plan: SubscriptionPlan | null | undefined, key: string): boolean {
  if (!plan) return false;
  // Enterprise/Business plans have access to all features
  const slug = (plan.slug || '').toLowerCase();
  if (slug.includes('enterprise') || slug.includes('business')) return true;
  if (!plan.features) return false;
  const val = (plan.features as Record<string, any>)[key];
  return val === true || (typeof val === 'number' && val !== 0);
}

// Fallback limits for the free plan when no subscription exists
const FREE_PLAN_LIMITS: Record<string, number> = {
  max_own_properties: 10,
  max_leads: 20,
  max_users: 1,
  max_marketplace_properties: 0,
  max_storage_mb: 512,
  ai_credits_limit: 0,
};

export function getFeatureLimit(plan: SubscriptionPlan | null | undefined, key: string): number {
  if (!plan) return FREE_PLAN_LIMITS[key] ?? 0;

  // Enterprise-class plans always get unlimited for core keys
  const slug = (plan.slug ?? '').toLowerCase();
  if ((slug.includes('enterprise') || slug.includes('business')) && ENTERPRISE_UNLIMITED_KEYS.has(key)) {
    return Infinity;
  }

  const features = (plan.features ?? {}) as Record<string, any>;
  const val = features[key];
  if (val === -1 || val === true) return Infinity;
  if (val === null || val === undefined) {
    // null in features JSON = unlimited
  } else if (typeof val === 'number') return val;

  const topLevelVal = (plan as Record<string, any>)[key];
  if (topLevelVal === -1 || topLevelVal === true) return Infinity;
  // null in top-level columns (e.g. max_own_properties) = unlimited
  if (topLevelVal === null) return Infinity;
  if (typeof topLevelVal === 'number') return topLevelVal;

  return FREE_PLAN_LIMITS[key] ?? 0;
}

export function useSubscription({ enabled = false }: { enabled?: boolean } = {}) {
  const { profile, session } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, description, price_monthly, price_yearly, max_own_properties, max_users, max_leads, marketplace_access, partnership_access, priority_support, features, display_order, plan_type, trial_days, discount_percent")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return ensureArray(data as SubscriptionPlan[] | null | undefined);
    },
  });

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ["subscription", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!orgId,
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["billing-payments", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      // COST OPT: exclude pix_qr_code (base64 image string) — pix_copy_paste kept for UI.
      const { data, error } = await supabase
        .from("billing_payments")
        .select("id, organization_id, subscription_id, provider, provider_payment_id, amount_cents, method, status, invoice_url, pix_copy_paste, created_at, paid_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ensureArray(data as BillingPayment[] | null | undefined);
    },
    enabled: !!orgId,
  });

  const callBilling = async (action: string, body?: any) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing?action=${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na operação");
    return data;
  };

  const subscribe = useMutation({
    mutationFn: async (params: { planId: string; billingCycle: string; paymentMethod: string; customerName?: string; customerCpf?: string; customModules?: { moduleId: string; quantity: number }[] }) => {
      const { customerId } = await callBilling("create-customer", {
        customerName: params.customerName,
        customerCpf: params.customerCpf,
      });
      return callBilling(params.customModules ? "create-custom-subscription" : "create-subscription", {
        ...params,
        customerId,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
      if (data.pixData) {
        toast.success("Assinatura criada! Escaneie o QR Code para pagar.");
      } else {
        toast.success("Assinatura ativada com sucesso!");
      }
    },
    onError: (e: Error) => toastError("Erro ao criar assinatura", e, { module: "useSubscription" }),
  });

  const cancel = useMutation({
    mutationFn: () => callBilling("cancel-subscription"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Assinatura cancelada");
    },
    onError: (e: Error) => toastError("Erro ao cancelar assinatura", e, { module: "useSubscription" }),
  });

  const renew = useMutation({
    mutationFn: (params: { planId: string; billingCycle: string; paymentMethod: string }) =>
      callBilling("renew", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
      toast.success("Assinatura renovada com sucesso!");
    },
    onError: (e: Error) => toastError("Erro ao renovar assinatura", e, { module: "useSubscription" }),
  });

  useEffect(() => {
    if (!orgId || !enabled) return;
    const channel = supabase
      .channel(`billing-${orgId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'subscriptions',
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["subscription", orgId] });
        if (payload.new?.status === "active" && payload.old?.status !== "active") {
          toast.success("Assinatura ativada com sucesso!");
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'billing_payments',
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["billing-payments", orgId] });
        if (payload.new?.status === "confirmed" && payload.old?.status !== "confirmed") {
          toast.success("Pagamento confirmado!");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient, enabled]);

  const isActive = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status === "active") return true;
    if (subscription.status !== "trial") return false;

    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

    const trialStillValid = !!trialEnd && trialEnd > now;
    const periodStillValid = periodEnd ? periodEnd > now : true;

    return trialStillValid && periodStillValid;
  }, [subscription]);
  const isPending = subscription?.status === "pending";
  const isOverdue = subscription?.status === "overdue";
  const isCancelled = subscription?.status === "cancelled";

  const currentPlan = subscription?.plan as SubscriptionPlan | undefined;

  const checkFeature = useCallback((key: string) => hasFeature(currentPlan, key), [currentPlan]);
  const checkLimit = useCallback((key: string) => getFeatureLimit(currentPlan, key), [currentPlan]);

  // Plan groupings
  const safePlans = ensureArray(plans);
  const mainPlans = safePlans.filter(p => (p as any).plan_type !== 'addon');
  const addonPlans = safePlans.filter(p => (p as any).plan_type === 'addon');

  // Legacy groupings (kept for backward compat)
  const marketplacePlans = safePlans.filter(p => (p.features as any)?.line === "marketplace");
  const erpPlans = safePlans.filter(p => (p.features as any)?.line === "erp");
  const comboPlans = safePlans.filter(p => (p.features as any)?.line === "combo");

  // --- New helpers ---
  const getAiCreditsLimit = useCallback(() => checkLimit('ai_credits_limit'), [checkLimit]);
  const getStorageLimitMB = useCallback(() => checkLimit('max_storage_mb'), [checkLimit]);

  const isWithinLimit = useCallback((key: string, currentCount: number) => {
    const limit = checkLimit(key);
    return limit === Infinity || currentCount < limit;
  }, [checkLimit]);

  const isTrialActive = useCallback(() => {
    if (!subscription) return false;
    if (subscription.status !== "trial") return false;

    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

    const trialStillValid = !!trialEnd && trialEnd > now;
    const periodStillValid = periodEnd ? periodEnd > now : true;

    return trialStillValid && periodStillValid;
  }, [subscription]);

  const getTrialDaysRemaining = useCallback(() => {
    if (!isTrialActive()) return 0;
    const end = new Date(subscription!.trial_end!);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  }, [isTrialActive, subscription]);

  const getCurrentPlanSlug = useCallback(() => {
    return subscription?.plan?.slug ?? 'gratuito';
  }, [subscription]);

  const canUpgradeTo = useCallback((planSlug: string) => {
    return PLAN_ORDER.indexOf(planSlug) > PLAN_ORDER.indexOf(getCurrentPlanSlug());
  }, [getCurrentPlanSlug]);

  const getDiscountPercent = useCallback(() => {
    return (subscription?.plan as any)?.discount_percent ?? 0;
  }, [subscription]);

  const getDiscountedPrice = useCallback((priceMonthly: number) => {
    const disc = getDiscountPercent();
    if (disc <= 0) return priceMonthly;
    return Math.round(priceMonthly * (1 - disc / 100));
  }, [getDiscountPercent]);

  const getSupportLevel = useCallback(() => {
    return (subscription?.plan?.features as any)?.support_level ?? 'chat_ai';
  }, [subscription]);

  const canBuyAddon = useCallback((addonType: string) => {
    return (subscription?.plan?.features as any)?.['can_buy_addon_' + addonType] === true;
  }, [subscription]);

  const getExtraUserPrice = useCallback(() => {
    return (subscription?.plan?.features as any)?.extra_user_price ?? 0;
  }, [subscription]);

  return {
    plans: safePlans,
    mainPlans,
    addonPlans,
    marketplacePlans,
    erpPlans,
    comboPlans,
    subscription,
    payments,
    loadingPlans,
    loadingSub,
    loadingPayments,
    subscribe,
    cancel,
    renew,
    isActive,
    isPending,
    isOverdue,
    isCancelled,
    currentPlan,
    hasFeature: checkFeature,
    getFeatureLimit: checkLimit,
    // New helpers
    getAiCreditsLimit,
    getStorageLimitMB,
    isWithinLimit,
    isTrialActive,
    getTrialDaysRemaining,
    getCurrentPlanSlug,
    canUpgradeTo,
    getDiscountPercent,
    getDiscountedPrice,
    getSupportLevel,
    canBuyAddon,
    getExtraUserPrice,
  };
}
