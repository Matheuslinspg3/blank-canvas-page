DO $$
DECLARE
  r RECORD;
  v_wallet_id UUID;
BEGIN
  FOR r IN
    SELECT s.organization_id, sp.automation_allowance_brl, sp.name AS plan_name
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status = 'active'
      AND sp.automation_allowance_brl > 0
      AND sp.slug NOT LIKE 'addon%'
      AND NOT EXISTS (SELECT 1 FROM automation_credit_wallets w WHERE w.organization_id = s.organization_id)
  LOOP
    INSERT INTO automation_credit_wallets (
      organization_id, balance_brl, plan_monthly_allowance_brl, markup_multiplier, last_plan_credit_at
    ) VALUES (
      r.organization_id, r.automation_allowance_brl, r.automation_allowance_brl, 1.5, now()
    ) RETURNING id INTO v_wallet_id;

    INSERT INTO automation_credit_transactions (
      wallet_id, organization_id, type, amount_brl, balance_after, description
    ) VALUES (
      v_wallet_id, r.organization_id, 'plan_allowance', r.automation_allowance_brl, r.automation_allowance_brl,
      'Crédito inicial do plano ' || r.plan_name
    );
  END LOOP;
END $$;