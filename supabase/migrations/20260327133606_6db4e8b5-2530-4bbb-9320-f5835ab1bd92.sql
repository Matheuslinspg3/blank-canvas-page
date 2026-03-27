CREATE TABLE IF NOT EXISTS public.whatsapp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_audit_log_org ON public.whatsapp_audit_log(organization_id, created_at DESC);

ALTER TABLE public.whatsapp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view audit log"
  ON public.whatsapp_audit_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
