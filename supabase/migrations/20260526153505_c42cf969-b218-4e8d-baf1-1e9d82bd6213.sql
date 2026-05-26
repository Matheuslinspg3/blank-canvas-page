ALTER TABLE public.credit_recharge_requests
  ADD COLUMN IF NOT EXISTS receipt_validation jsonb,
  ADD COLUMN IF NOT EXISTS receipt_mime text,
  ADD COLUMN IF NOT EXISTS receipt_size_bytes integer;