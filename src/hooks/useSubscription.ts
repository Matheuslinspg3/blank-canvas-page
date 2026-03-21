import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

export type PlanLine = "marketplace" | "erp" | "combo";

export function getPlanLine(plan: SubscriptionPlan | null | undefined): PlanLine | null {
  if (!plan?.features) return null;
  return (plan.features as Record<string, any>).line as PlanLine ?? null;
}

export function hasFeature(plan: SubscriptionPlan | null | undefined, key: string): boolean {
  if (!plan?.features) return false;
  const features = plan.features as Record<string, any>;
  // For combo plans, check both marketplace and erp sub-objects
  if (features.line === "combo") {
    if (features.marketplace?.[key]) return true;
    if (features.erp?.[key]) return true;
    return false;
  }
  return !!features[key];
}

export function getFeatureLimit(plan: SubscriptionPlan | null | undefined, key: string): number | null {
  if (!plan?.features) return 0;
  const features = plan.features as Record<string, any>;
  // For combo plans, check both sub-objects and return max
  if (features.line === "combo") {
    const mpVal = features.marketplace?.[key];
    const erpVal = features.erp?.[key];
    if (mpVal === null || erpVal === null) return null; // null = unlimited
    return Math.max(mpVal ?? 0, erpVal ?? 0);
  }
  const val = features[key];
  if (val === null) return null; // null = unlimited
  return typeof val === "number" ? val : 0;
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
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SubscriptionPlan[];
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
      const { data, error } = await supabase
        .from("billing_payments")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as BillingPayment[];
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
    mutationFn: async (params: { planId: string; billingCycle: string; paymentMethod: string; customerName?: string; customerCpf?: string }) => {
      const { customerId } = await callBilling("create-customer", {
        customerName: params.customerName,
        customerCpf: params.customerCpf,
      });
      return callBilling("create-subscription", { ...params, customerId });
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
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => callBilling("cancel-subscription"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Assinatura cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: (params: { planId: string; billingCycle: string; paymentMethod: string }) =>
      callBilling("renew", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
      toast.success("Assinatura renovada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const isActive = subscription?.status === "active" || 
    subscription?.status === "pending" ||
    (subscription?.status === "trial" && subscription.trial_end && new Date(subscription.trial_end) > new Date());
  const isOverdue = subscription?.status === "overdue";
  const isCancelled = subscription?.status === "cancelled";

  const currentPlan = subscription?.plan as SubscriptionPlan | undefined;

  const checkFeature = useCallback((key: string) => hasFeature(currentPlan, key), [currentPlan]);
  const checkLimit = useCallback((key: string) => getFeatureLimit(currentPlan, key), [currentPlan]);

  // Helpers to group plans by line
  const marketplacePlans = plans.filter(p => (p.features as any)?.line === "marketplace");
  const erpPlans = plans.filter(p => (p.features as any)?.line === "erp");
  const comboPlans = plans.filter(p => (p.features as any)?.line === "combo");

  return {
    plans,
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
    isOverdue,
    isCancelled,
    currentPlan,
    hasFeature: checkFeature,
    getFeatureLimit: checkLimit,
  };
}
