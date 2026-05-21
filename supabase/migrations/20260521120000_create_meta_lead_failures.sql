CREATE TABLE IF NOT EXISTS public.meta_lead_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  leadgen_id text NOT NULL,
  page_id text,
  form_id text,
  payload jsonb NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_lead_failures_provider_leadgen ON public.meta_lead_failures(provider, leadgen_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_failures_status ON public.meta_lead_failures(status, created_at DESC);

ALTER TABLE public.meta_lead_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org meta lead failures"
ON public.meta_lead_failures
FOR SELECT
USING (organization_id = public.get_user_organization_id());
