import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

serve(async (req) => {
  const log = createLogger("billing-webhook", req);

  if (req.method !== "POST") {
    log.warn("Method not allowed", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  // A02: Validate Asaas webhook token
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    log.error("Unauthorized webhook request", { has_token: !!receivedToken });
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    const event = payload.event;
    const paymentId = payload.payment?.id;
    const subscriptionId = payload.payment?.subscription;

    const providerEventId = payload.id || `${event}_${paymentId || 'noid'}`;

    log.info("Webhook received", { event, payment_id: paymentId, subscription_id: subscriptionId, provider_event_id: providerEventId });

    // A03: Sanitize payload — only persist non-sensitive fields
    const sanitizedMeta = {
      event,
      payment_id: paymentId || null,
      subscription_id: subscriptionId || null,
      billing_type: payload.payment?.billingType || null,
      value: payload.payment?.value || null,
      status: payload.payment?.status || null,
    };

    // A04: Compute payload hash for deduplication
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(payload)));
    const payloadHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // A02: Check idempotency — skip if already processed
    const { data: existing } = await supabase
      .from("billing_webhook_logs")
      .select("id, processed")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    if (existing?.processed) {
      log.info("Duplicate event skipped", { provider_event_id: providerEventId });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // A03: Log webhook with sanitized payload (no PII)
    const { data: logEntry } = await supabase.from("billing_webhook_logs").insert({
      provider: "asaas",
      event_type: event,
      payload: sanitizedMeta,
      provider_event_id: providerEventId,
      event_status: payload.payment?.status || null,
      payload_hash: payloadHash,
    }).select("id").single();

    if (!paymentId) {
      if (logEntry?.id) {
        await supabase.from("billing_webhook_logs")
          .update({ processed: true })
          .eq("id", logEntry.id);
      }
      log.info("No payment id, marked processed");
      return new Response(JSON.stringify({ ok: true, msg: "No payment id" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const initialFeeDescription = "Taxa inicial de acesso aos imóveis";
    const publicCommercialPlanSlugs = new Set(["essencial", "profissional", "business"]);

    async function orgInitialFeeIsSatisfied(organizationId: string, planRequiresInitialFee: boolean) {
      if (!planRequiresInitialFee) return true;

      const { data: orgPayments } = await supabase
        .from("billing_payments")
        .select("id, status, description")
        .eq("organization_id", organizationId);

      const payments = orgPayments ?? [];
      const initialFeeConfirmed = payments.some((payment: any) =>
        payment.description === initialFeeDescription && payment.status === "confirmed"
      );
      if (initialFeeConfirmed) return true;

      const hasInitialFeeAttempt = payments.some((payment: any) =>
        payment.description === initialFeeDescription
      );
      const hasHistoricalConfirmedPaidSubscription = payments.some((payment: any) =>
        payment.description !== initialFeeDescription && payment.status === "confirmed"
      );

      // Existing paying orgs that never had the new initial-fee flow are grandfathered.
      // Once an org has any initial-fee attempt, switching checkout/subscription cannot
      // remove the org-level requirement: one such fee must be confirmed.
      return hasHistoricalConfirmedPaidSubscription && !hasInitialFeeAttempt;
    }

    async function activateSubscriptionIfReady(sub: { id: string; organization_id: string }) {
      const { data: paymentRows } = await supabase
        .from("billing_payments")
        .select("id, status, description")
        .eq("subscription_id", sub.id);

      const payments = paymentRows ?? [];
      const recurringPaymentConfirmed = payments.some((payment: any) =>
        payment.description !== initialFeeDescription && payment.status === "confirmed"
      );

      const { data: subRecord } = await supabase
        .from("subscriptions")
        .select("billing_cycle, plan:subscription_plans(slug, features)")
        .eq("id", sub.id)
        .single();

      const plan = (subRecord?.plan ?? {}) as { slug?: string; features?: Record<string, unknown> };
      const initialFeeCents = typeof plan.features?.initial_property_access_fee_cents === "number"
        ? Number(plan.features.initial_property_access_fee_cents)
        : 0;
      const planRequiresInitialFee = publicCommercialPlanSlugs.has(plan.slug ?? "") && initialFeeCents > 0;
      const initialFeeSatisfied = await orgInitialFeeIsSatisfied(sub.organization_id, planRequiresInitialFee);

      if (!recurringPaymentConfirmed || !initialFeeSatisfied) {
        log.info("Subscription activation waiting for required payments", {
          sub_id: sub.id,
          recurring_payment_confirmed: recurringPaymentConfirmed,
          initial_fee_required: planRequiresInitialFee,
          initial_fee_satisfied: initialFeeSatisfied,
        });
        return false;
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (subRecord?.billing_cycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await supabase.from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", sub.id);

      await supabase.from("subscriptions")
        .update({ status: "cancelled", cancelled_at: now.toISOString() })
        .eq("organization_id", sub.organization_id)
        .in("status", ["active", "trial", "pending", "overdue"])
        .neq("id", sub.id);

      log.info("Subscription activated after all required payments", { org_id: sub.organization_id, new_sub_id: sub.id });
      return true;
    }

    async function activateEligibleSubscriptionForPayment(paymentSub: { id: string; organization_id: string }) {
      const { data: paymentSubscription } = await supabase
        .from("subscriptions")
        .select("id, organization_id, status, created_at")
        .eq("id", paymentSub.id)
        .maybeSingle();

      if (!paymentSubscription) {
        log.info("Payment subscription not found for activation", { sub_id: paymentSub.id });
        return false;
      }

      const { data: newerEligible } = await supabase
        .from("subscriptions")
        .select("id, organization_id")
        .eq("organization_id", paymentSub.organization_id)
        .in("status", ["pending", "overdue"])
        .gt("created_at", paymentSubscription.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newerEligible) {
        log.info("Newer eligible subscription found; avoiding stale activation", {
          payment_sub_id: paymentSub.id,
          newer_sub_id: newerEligible.id,
        });
        return activateSubscriptionIfReady(newerEligible);
      }

      if (!["pending", "overdue"].includes(paymentSubscription.status)) {
        log.info("Payment subscription is not eligible for activation", {
          sub_id: paymentSubscription.id,
          status: paymentSubscription.status,
        });
        return false;
      }

      return activateSubscriptionIfReady(paymentSubscription);
    }

    // Find subscription
    let sub: { id: string; organization_id: string } | null = null;
    let isInitialPropertyAccessFee = false;
    if (subscriptionId) {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, organization_id")
        .eq("provider_subscription_id", subscriptionId)
        .maybeSingle();
      sub = data;
    }
    if (!sub) {
      const { data: payment } = await supabase
        .from("billing_payments")
        .select("subscription_id, organization_id, description")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (payment?.subscription_id) {
        sub = { id: payment.subscription_id, organization_id: payment.organization_id };
        isInitialPropertyAccessFee = payment.description === initialFeeDescription;
      }
    }

    // Process events
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      log.info("Payment confirmed", { payment_id: paymentId, subscription_found: !!sub });

      await supabase.from("billing_payments")
        .update({ status: "confirmed", paid_at: new Date().toISOString() })
        .eq("provider_payment_id", paymentId);

      // PIX first charges may include the one-time property access fee in the same
      // Asaas payment. Keep a synthetic local audit row in sync with the real
      // payment so finance can verify the fee was paid exactly once.
      await supabase.from("billing_payments")
        .update({ status: "confirmed", paid_at: new Date().toISOString() })
        .eq("provider_payment_id", `${paymentId}:initial_property_access_fee`);

      if (sub && payload.payment?.value && !isInitialPropertyAccessFee) {
        await supabase.from("billing_payments").upsert({
          organization_id: sub.organization_id,
          subscription_id: sub.id,
          provider: "asaas",
          provider_payment_id: paymentId,
          amount_cents: Math.round(payload.payment.value * 100),
          method: (payload.payment.billingType || "").toLowerCase(),
          status: "confirmed",
          paid_at: new Date().toISOString(),
          invoice_url: payload.payment.invoiceUrl || null,
        }, { onConflict: "provider_payment_id" });
      }

      if (sub) {
        await activateEligibleSubscriptionForPayment(sub);
      }
    }

    if (event === "PAYMENT_OVERDUE") {
      log.warn("Payment overdue", { payment_id: paymentId, subscription_found: !!sub });
      if (sub && !isInitialPropertyAccessFee) {
        await supabase.from("subscriptions")
          .update({ status: "overdue" })
          .eq("id", sub.id);
      }
      await supabase.from("billing_payments")
        .update({ status: "failed" })
        .eq("provider_payment_id", paymentId);
      await supabase.from("billing_payments")
        .update({ status: "failed" })
        .eq("provider_payment_id", `${paymentId}:initial_property_access_fee`);
    }

    if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      log.info("Payment refunded/deleted", { payment_id: paymentId, event });
      await supabase.from("billing_payments")
        .update({ status: "refunded" })
        .eq("provider_payment_id", paymentId);
      await supabase.from("billing_payments")
        .update({ status: "refunded" })
        .eq("provider_payment_id", `${paymentId}:initial_property_access_fee`);
    }

    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      log.info("Subscription cancelled", { subscription_found: !!sub, event });
      if (sub) {
        await supabase.from("subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    }

    // A04: Mark webhook as processed
    if (logEntry?.id) {
      await supabase.from("billing_webhook_logs")
        .update({ processed: true })
        .eq("id", logEntry.id);
    }

    log.info("Webhook processed successfully", { event, provider_event_id: providerEventId });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Webhook processing failed", { error_type: error instanceof Error ? error.constructor.name : "unknown" });

    await supabase.from("billing_webhook_logs").insert({
      provider: "asaas",
      event_type: "ERROR",
      payload: { error_type: "processing_failure" },
      error_message: "Webhook processing failed",
    });

    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
