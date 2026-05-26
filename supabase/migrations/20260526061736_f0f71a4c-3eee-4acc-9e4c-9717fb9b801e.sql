
-- 1) Tabela de solicitações de recarga
CREATE TABLE public.credit_recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount_brl numeric(12,2) NOT NULL CHECK (amount_brl > 0),
  pix_key text NOT NULL DEFAULT '13996666432',
  receipt_path text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  credits_granted numeric(12,2),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crr_org ON public.credit_recharge_requests(organization_id);
CREATE INDEX idx_crr_status ON public.credit_recharge_requests(status);
CREATE INDEX idx_crr_user ON public.credit_recharge_requests(user_id);

ALTER TABLE public.credit_recharge_requests ENABLE ROW LEVEL SECURITY;

-- RLS: usuários veem solicitações de sua organização
CREATE POLICY "Users view own org recharge requests"
ON public.credit_recharge_requests FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id() OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Users create own recharge requests"
ON public.credit_recharge_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_organization_id()
  AND status = 'pending'
);

-- Apenas developers podem atualizar (aprovar/rejeitar)
CREATE POLICY "Developers update recharge requests"
ON public.credit_recharge_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'developer'))
WITH CHECK (public.has_role(auth.uid(),'developer'));

CREATE POLICY "Developers delete recharge requests"
ON public.credit_recharge_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'developer'));

-- Trigger updated_at
CREATE TRIGGER trg_crr_updated_at
BEFORE UPDATE ON public.credit_recharge_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storage bucket para comprovantes (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('recharge-receipts', 'recharge-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage: cada usuário grava em sua pasta (auth.uid()) e lê seus próprios; developers leem tudo
CREATE POLICY "Users upload own recharge receipt"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recharge-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users read own recharge receipt"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recharge-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'developer')
  )
);

CREATE POLICY "Developers delete recharge receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recharge-receipts' AND public.has_role(auth.uid(),'developer'));

-- 3) Função de aprovação: credita carteira, registra transação e marca como approved
CREATE OR REPLACE FUNCTION public.approve_recharge_request(
  _request_id uuid,
  _credits_brl numeric DEFAULT NULL
)
RETURNS public.credit_recharge_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.credit_recharge_requests;
  grant_amount numeric;
  w_id uuid;
  new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'developer') THEN
    RAISE EXCEPTION 'Apenas developers podem aprovar recargas';
  END IF;

  SELECT * INTO req FROM public.credit_recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já processada (%).', req.status; END IF;

  grant_amount := COALESCE(_credits_brl, req.amount_brl);
  IF grant_amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  -- Garante wallet
  INSERT INTO public.automation_credit_wallets (organization_id, balance_brl)
  VALUES (req.organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.automation_credit_wallets
  SET balance_brl = balance_brl + grant_amount,
      total_recharged_brl = total_recharged_brl + grant_amount,
      updated_at = now()
  WHERE organization_id = req.organization_id
  RETURNING id, balance_brl INTO w_id, new_balance;

  INSERT INTO public.automation_credit_transactions
    (organization_id, wallet_id, type, amount_brl, balance_after, description, metadata)
  VALUES
    (req.organization_id, w_id, 'recharge', grant_amount, new_balance,
     'Recarga PIX aprovada',
     jsonb_build_object('request_id', req.id, 'approved_by', auth.uid(), 'pix_key', req.pix_key));

  UPDATE public.credit_recharge_requests
  SET status = 'approved',
      credits_granted = grant_amount,
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_recharge_request(uuid, numeric) TO authenticated;

-- 4) Garantir constraint única em wallet por organização (necessário para ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_credit_wallets_organization_id_key'
  ) THEN
    ALTER TABLE public.automation_credit_wallets
      ADD CONSTRAINT automation_credit_wallets_organization_id_key UNIQUE (organization_id);
  END IF;
END$$;
