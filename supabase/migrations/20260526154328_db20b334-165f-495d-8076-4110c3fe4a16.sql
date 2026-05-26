CREATE OR REPLACE FUNCTION public.developer_credit_organization(
  _organization_id uuid,
  _amount_brl numeric,
  _description text DEFAULT 'Crédito manual (developer)',
  _type text DEFAULT 'manual_credit'
)
RETURNS public.automation_credit_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  w_id uuid;
  new_balance numeric;
  tx public.automation_credit_transactions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'developer') THEN
    RAISE EXCEPTION 'Apenas developers podem creditar manualmente';
  END IF;
  IF _amount_brl = 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  INSERT INTO public.automation_credit_wallets (organization_id, balance_brl)
  VALUES (_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.automation_credit_wallets
  SET balance_brl = balance_brl + _amount_brl,
      total_recharged_brl = total_recharged_brl + GREATEST(_amount_brl, 0),
      updated_at = now()
  WHERE organization_id = _organization_id
  RETURNING id, balance_brl INTO w_id, new_balance;

  INSERT INTO public.automation_credit_transactions
    (organization_id, wallet_id, type, amount_brl, balance_after, description, metadata)
  VALUES
    (_organization_id, w_id,
     CASE WHEN _amount_brl >= 0 THEN COALESCE(_type, 'manual_credit') ELSE 'manual_debit' END,
     _amount_brl, new_balance,
     COALESCE(_description, 'Ajuste manual (developer)'),
     jsonb_build_object('approved_by', auth.uid(), 'manual', true))
  RETURNING * INTO tx;

  RETURN tx;
END;
$$;

REVOKE ALL ON FUNCTION public.developer_credit_organization(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_credit_organization(uuid, numeric, text, text) TO authenticated;