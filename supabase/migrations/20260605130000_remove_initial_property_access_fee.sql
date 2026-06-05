-- Remove the one-time "initial property access fee" from all subscription plans.
--
-- Context: this fee ("Taxa inicial de acesso aos imóveis") was introduced by
-- mistake during scaffolding and is NOT part of the commercial offer. It was
-- never advertised on the public site.
--
-- Why this is safe and sufficient:
-- The billing code reads the fee from the plan catalog
-- (features.initial_property_access_fee_cents) and every charge/display path is
-- already guarded by `initialFeeCents > 0` (see supabase/functions/billing,
-- billing-webhook, and src/components/billing/CheckoutDialog.tsx). Removing the
-- key from the catalog makes the configured value resolve to 0, which disables
-- the fee end-to-end without changing billing logic.
--
-- Non-destructive: historical billing_payments rows (including any past fee
-- charges) are preserved for audit. Idempotent: only touches plans that still
-- carry the key.

UPDATE public.subscription_plans
SET features = features - 'initial_property_access_fee_cents',
    updated_at = now()
WHERE features ? 'initial_property_access_fee_cents';
