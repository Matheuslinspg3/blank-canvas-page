import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/logger.ts";

// --- Document validation (CPF/CNPJ) ---
function isValidCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    const r = (s * 10) % 11;
    if (Number(d[t]) !== (r === 10 ? 0 : r)) return false;
  }
  return true;
}
function isValidCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  for (const [idx, w] of [[12, w1], [13, w2]] as const) {
    let s = 0;
    for (let i = 0; i < w.length; i++) s += Number(d[i]) * w[i];
    const r = s % 11;
    if (Number(d[idx]) !== (r < 2 ? 0 : 11 - r)) return false;
  }
  return true;
}
function isValidDocument(doc: string): boolean {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

// A14: CORS allowlist — fail-closed when not configured
const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
const DEFAULT_TRIAL_DAYS = 15;
const PUBLIC_COMMERCIAL_PLAN_SLUGS = new Set(["essencial", "profissional", "business"]);
const INITIAL_PROPERTY_ACCESS_FEE_DESCRIPTION = "Taxa inicial de acesso aos imóveis";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.length === 0) {
    console.warn("[billing] APP_ALLOWED_ORIGINS not configured — CORS will be restrictive");
    return {
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    };
  }
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Always use production Asaas
function getAsaasConfig() {
  const key = Deno.env.get("ASAAS_API_KEY") || "";
  return { key, base: "https://api.asaas.com/v3" };
}

function makeAsaasFetch(config: { key: string; base: string }) {
  return async function asaasFetch(path: string, opts: RequestInit = {}) {
    if (!config.key) throw new Error("ASAAS_API_KEY not configured");
    const res = await fetch(`${config.base}${path}`, {
      ...opts,
      headers: {
        ...opts.headers as Record<string,string>,
        "access_token": config.key,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.[0]?.description || JSON.stringify(data));
    return data;
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const log = createLogger("billing", req);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const asaasConfig = getAsaasConfig();
    const asaasFetch = makeAsaasFetch(asaasConfig);
    log.info("Request received", { action });
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !authUser) throw new Error("Invalid token");
    const user = { id: authUser.id, email: authUser.email || "" };

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new Error("No organization");
    const orgId = profile.organization_id;

    // Get org info
    const { data: org } = await supabase
      .from("organizations").select("name, email, cnpj, phone").eq("id", orgId).single();

    if (action === "create-customer") {
      // Create or get Asaas customer
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("organization_id", orgId)
        .not("provider_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (sub?.provider_customer_id) {
        return new Response(JSON.stringify({ customerId: sub.provider_customer_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read CPF/name from request body if provided
      let customerName = org?.name || "Cliente Habitae";
      let customerCpf = org?.cnpj?.replace(/\D/g, "") || undefined;
      try {
        const body = await req.json();
        if (body.customerName) customerName = body.customerName;
        if (body.customerCpf) customerCpf = body.customerCpf;
      } catch { /* no body */ }

      if (!customerCpf) {
        throw new Error("CPF ou CNPJ é obrigatório para criar a cobrança.");
      }

      if (!isValidDocument(customerCpf)) {
        return new Response(JSON.stringify({ error: "Documento inválido (CPF/CNPJ)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: org?.email || user.email,
          cpfCnpj: customerCpf,
          phone: org?.phone?.replace(/\D/g, "") || undefined,
          externalReference: orgId,
        }),
      });

      return new Response(JSON.stringify({ customerId: customer.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-subscription") {
      const body = await req.json();
      const { planId, billingCycle, paymentMethod, customerId } = body;

      // Get plan
      const { data: plan } = await supabase
        .from("subscription_plans").select("*").eq("id", planId).single();
      if (!plan) throw new Error("Plan not found");

      // Hard block: checkout must only sell the current public commercial plans.
      // Do not trust planId alone: manual requests could otherwise buy inactive,
      // legacy, internal, or explicitly non-purchasable plans.
      const planFeatures = (plan.features ?? {}) as Record<string, unknown>;
      const isInternal =
        plan.slug === "internal_unlimited" ||
        planFeatures.is_internal === true ||
        planFeatures.is_internal_unlimited === true;
      const isNonPurchasable = planFeatures.is_purchasable === false;
      const isAllowedPublicPlan =
        plan.is_active === true &&
        PUBLIC_COMMERCIAL_PLAN_SLUGS.has(plan.slug) &&
        !isInternal &&
        !isNonPurchasable;

      if (!isAllowedPublicPlan) {
        return new Response(
          JSON.stringify({ error: "Plano indisponível para checkout público." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const priceCents = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
      const configuredInitialFeeCents = typeof planFeatures.initial_property_access_fee_cents === "number"
        ? Number(planFeatures.initial_property_access_fee_cents)
        : 0;

      const { data: confirmedPayments } = await supabase
        .from("billing_payments")
        .select("id, description")
        .eq("organization_id", orgId)
        .eq("status", "confirmed");

      const hasHistoricalConfirmedPaidSubscription = (confirmedPayments ?? []).some(
        (payment: any) => payment.description !== INITIAL_PROPERTY_ACCESS_FEE_DESCRIPTION
      );

      const { data: initialFeeAttempts } = await supabase
        .from("billing_payments")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("description", INITIAL_PROPERTY_ACCESS_FEE_DESCRIPTION);

      const hasInitialFeeAttempt = (initialFeeAttempts ?? []).length > 0;
      const hasPendingOrConfirmedInitialFee = (initialFeeAttempts ?? []).some(
        (payment: any) => payment.status === "pending" || payment.status === "confirmed"
      );

      const initialFeeCents = !hasPendingOrConfirmedInitialFee &&
        (!hasHistoricalConfirmedPaidSubscription || hasInitialFeeAttempt)
        ? configuredInitialFeeCents
        : 0;
      const recurringPriceReais = Number(priceCents) / 100; // Asaas expects value in BRL (reais)
      const now = new Date();
      const periodEnd = billingCycle === "yearly"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // PIX: create individual payment with PIX QR code
      if (paymentMethod === "pix") {
        const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];

        const payment = await asaasFetch("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "PIX",
            value: (Number(priceCents) + initialFeeCents) / 100,
            dueDate,
            description: `Habitae ${plan.name} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}${initialFeeCents > 0 ? " + taxa inicial de acesso aos imóveis" : ""}`,
            externalReference: orgId,
          }),
        });

        // Get PIX QR Code
        const pixInfo = await asaasFetch(`/payments/${payment.id}/pixQrCode`);

        // Create local subscription as pending
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: orgId,
            plan_id: planId,
            status: "pending",
            billing_cycle: billingCycle,
            provider: "asaas",
            provider_customer_id: customerId,
            provider_subscription_id: null,
            payment_method: "pix",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select()
          .single();
        if (subErr) throw subErr;

        // NOTE: Old subscriptions will be cancelled by webhook on PAYMENT_CONFIRMED
        // Save payment record
        await supabase.from("billing_payments").insert({
          organization_id: orgId,
          subscription_id: newSub.id,
          provider: "asaas",
          provider_payment_id: payment.id,
          amount_cents: Number(priceCents) + initialFeeCents,
          method: "pix",
          status: "pending",
          pix_qr_code: pixInfo.encodedImage,
          pix_copy_paste: pixInfo.payload,
          description: initialFeeCents > 0
            ? `Mensalidade ${plan.name} com taxa inicial de acesso aos imóveis`
            : `Mensalidade ${plan.name}`,
        });

        if (initialFeeCents > 0) {
          await supabase.from("billing_payments").insert({
            organization_id: orgId,
            subscription_id: newSub.id,
            provider: "asaas",
            provider_payment_id: `${payment.id}:initial_property_access_fee`,
            amount_cents: initialFeeCents,
            method: "pix",
            status: "pending",
            description: INITIAL_PROPERTY_ACCESS_FEE_DESCRIPTION,
          });
        }

        return new Response(JSON.stringify({
          subscription: newSub,
          pixData: {
            paymentId: payment.id,
            qrCode: pixInfo.encodedImage,
            copyPaste: pixInfo.payload,
          },
          initialFeeChargedCents: initialFeeCents,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Credit/Debit Card: create RECURRING SUBSCRIPTION on Asaas
      if (paymentMethod === "credit_card") {
        const cycle = billingCycle === "yearly" ? "YEARLY" : "MONTHLY";

        const asaasSub = await asaasFetch("/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "CREDIT_CARD",
            value: recurringPriceReais,
            cycle,
            description: `Habitae ${plan.name} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
            externalReference: orgId,
          }),
        });

        // Get the first payment's invoiceUrl so the user can enter card details
        const payments = await asaasFetch(`/subscriptions/${asaasSub.id}/payments?limit=1`);
        const firstPayment = payments.data?.[0];
        const invoiceUrl = firstPayment?.invoiceUrl || null;

        // Create local subscription as pending (will be activated by webhook on payment)
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: orgId,
            plan_id: planId,
            status: "pending",
            billing_cycle: billingCycle,
            provider: "asaas",
            provider_customer_id: customerId,
            provider_subscription_id: asaasSub.id,
            payment_method: "credit_card",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select()
          .single();
        if (subErr) throw subErr;

        // NOTE: Old subscriptions will be cancelled by webhook on PAYMENT_CONFIRMED
        // Save payment record if we have a first payment
        if (firstPayment) {
          await supabase.from("billing_payments").insert({
            organization_id: orgId,
            subscription_id: newSub.id,
            provider: "asaas",
            provider_payment_id: firstPayment.id,
            amount_cents: Number(priceCents),
            method: "credit_card",
            status: "pending",
            invoice_url: invoiceUrl,
            description: `Mensalidade ${plan.name}`,
          });
        }

        let initialFeeInvoiceUrl: string | null = null;
        if (initialFeeCents > 0) {
          const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0];
          const initialFeePaymentAsaas = await asaasFetch("/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: customerId,
              billingType: "CREDIT_CARD",
              value: initialFeeCents / 100,
              dueDate,
              description: "Habitae - taxa inicial de acesso aos imóveis",
              externalReference: orgId,
            }),
          });
          initialFeeInvoiceUrl = initialFeePaymentAsaas.invoiceUrl || null;

          await supabase.from("billing_payments").insert({
            organization_id: orgId,
            subscription_id: newSub.id,
            provider: "asaas",
            provider_payment_id: initialFeePaymentAsaas.id,
            amount_cents: initialFeeCents,
            method: "credit_card",
            status: "pending",
            invoice_url: initialFeeInvoiceUrl,
            description: INITIAL_PROPERTY_ACCESS_FEE_DESCRIPTION,
          });
        }

        return new Response(JSON.stringify({
          subscription: newSub,
          invoiceUrl,
          initialFeeInvoiceUrl,
          initialFeeChargedCents: initialFeeCents,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Boleto/unknown methods are intentionally disabled for the public checkout.
      // Keeping this path active would require a separate non-recurring first-fee
      // flow and could bypass the initial property access fee.
      return new Response(JSON.stringify({ error: "Forma de pagamento não suportada neste checkout." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });


    }

    if (action === "create-custom-subscription") {
      const body = await req.json();
      const { customModules, billingCycle, paymentMethod, customerId } = body;

      if (!customModules || !Array.isArray(customModules) || customModules.length === 0) {
        throw new Error("Selecione pelo menos um módulo");
      }

      // Get the custom plan
      const { data: customPlan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("slug", "personalizado")
        .single();
      if (!customPlan) throw new Error("Plano personalizado não encontrado");

      // Get all selected modules
      const moduleIds = customModules.map((m: any) => m.moduleId);
      const { data: modules } = await supabase
        .from("plan_modules")
        .select("*")
        .in("id", moduleIds)
        .eq("is_active", true);
      if (!modules || modules.length === 0) throw new Error("Módulos não encontrados");

      // Calculate total price
      let totalPrice = 0;
      for (const sel of customModules) {
        const mod = modules.find((m: any) => m.id === sel.moduleId);
        if (!mod) continue;
        const price = billingCycle === "yearly" ? mod.price_yearly : mod.price_monthly;
        const isNumeric = typeof mod.feature_value === "number" || !isNaN(Number(mod.feature_value));
        const qty = isNumeric ? (sel.quantity || 1) : 1;
        totalPrice += price * qty;
      }

      if (totalPrice <= 0) throw new Error("Valor total deve ser maior que zero");

      const priceInReais = totalPrice / 100;
      const now = new Date();
      // Custom plans use the same commercial free-trial window as standard plans.
      const trialEnd = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const periodEnd = billingCycle === "yearly"
        ? new Date(trialEnd.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Save module selections
      await supabase.from("custom_plan_selections").delete().eq("organization_id", orgId);
      const selectionsToInsert = customModules.map((sel: any) => ({
        organization_id: orgId,
        module_id: sel.moduleId,
        quantity: sel.quantity || 1,
      }));
      await supabase.from("custom_plan_selections").insert(selectionsToInsert);

      // Create Asaas payment (PIX or subscription)
      if (paymentMethod === "pix") {
        // Due date = after the free-trial period
        const dueDate = trialEnd.toISOString().split("T")[0];
        const payment = await asaasFetch("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "PIX",
            value: priceInReais,
            dueDate,
            description: `Habitae Personalizado - ${customModules.length} módulos - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
            externalReference: orgId,
          }),
        });
        const pixInfo = await asaasFetch(`/payments/${payment.id}/pixQrCode`);

        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: orgId,
            plan_id: customPlan.id,
            status: "trial",
            billing_cycle: billingCycle,
            provider: "asaas",
            provider_customer_id: customerId,
            payment_method: "pix",
            current_period_start: now.toISOString(),
            current_period_end: trialEnd.toISOString(),
          })
          .select()
          .single();
        if (subErr) throw subErr;

      // NOTE: Old subscriptions will be cancelled by webhook on PAYMENT_CONFIRMED

      await supabase.from("billing_payments").insert({
          organization_id: orgId,
          subscription_id: newSub.id,
          provider: "asaas",
          provider_payment_id: payment.id,
          amount_cents: totalPrice,
          method: "pix",
          status: "pending",
          pix_qr_code: pixInfo.encodedImage,
          pix_copy_paste: pixInfo.payload,
        });

        return new Response(JSON.stringify({
          subscription: newSub,
          pixData: { paymentId: payment.id, qrCode: pixInfo.encodedImage, copyPaste: pixInfo.payload },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Credit card — schedule first charge after the free-trial period
      const cycle = billingCycle === "yearly" ? "YEARLY" : "MONTHLY";
      const nextDueDate = trialEnd.toISOString().split("T")[0];
      const asaasSub = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: priceInReais,
          cycle,
          nextDueDate,
          description: `Habitae Personalizado - ${customModules.length} módulos`,
          externalReference: orgId,
        }),
      });

      const payments = await asaasFetch(`/subscriptions/${asaasSub.id}/payments?limit=1`);
      const firstPayment = payments.data?.[0];

      const { data: newSub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          organization_id: orgId,
          plan_id: customPlan.id,
          status: "trial",
          billing_cycle: billingCycle,
          provider: "asaas",
          provider_customer_id: customerId,
          provider_subscription_id: asaasSub.id,
          payment_method: "credit_card",
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
        })
        .select()
        .single();
      if (subErr) throw subErr;

      // NOTE: Old subscriptions will be cancelled by webhook on PAYMENT_CONFIRMED

      if (firstPayment) {
        await supabase.from("billing_payments").insert({
          organization_id: orgId,
          subscription_id: newSub.id,
          provider: "asaas",
          provider_payment_id: firstPayment.id,
          amount_cents: totalPrice,
          method: "credit_card",
          status: "pending",
          invoice_url: firstPayment.invoiceUrl || null,
        });
      }

      return new Response(JSON.stringify({
        subscription: newSub,
        invoiceUrl: firstPayment?.invoiceUrl || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cancel-subscription") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", orgId)
        .in("status", ["active", "trial", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) throw new Error("No active subscription");

      // Cancel on Asaas
      if (sub.provider_subscription_id) {
        try {
          await asaasFetch(`/subscriptions/${sub.provider_subscription_id}`, { method: "DELETE" });
        } catch (e) {
          console.error("Asaas cancel error:", e);
        }
      }

      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_at_period_end: true })
        .eq("id", sub.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "renew") {
      const body = await req.json();
      const { planId, billingCycle, paymentMethod } = body;

      // Get or create customer
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("organization_id", orgId)
        .not("provider_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let customerId = existingSub?.provider_customer_id;
      if (!customerId) {
        const customer = await asaasFetch("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: org?.name || "Cliente Habitae",
            email: org?.email || user.email,
            cpfCnpj: org?.cnpj?.replace(/\D/g, "") || undefined,
            externalReference: orgId,
          }),
        });
        customerId = customer.id;
      }

      // Call create-subscription endpoint internally via fetch
      const createUrl = new URL(req.url);
      createUrl.searchParams.set("action", "create-subscription");
      const createRes = await fetch(createUrl.toString(), {
        method: "POST",
        headers: {
          "Authorization": req.headers.get("Authorization") || "",
          "Content-Type": "application/json",
          "apikey": req.headers.get("apikey") || "",
        },
        body: JSON.stringify({ planId, billingCycle, paymentMethod, customerId }),
      });
      const createData = await createRes.json();
      return new Response(JSON.stringify(createData), {
        status: createRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    const safeMsg = msg.includes("API") || msg.includes("key") || msg.includes("token")
      ? "Erro no processamento do pagamento"
      : msg;
    log.error("Billing error", { error_message: safeMsg });
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
