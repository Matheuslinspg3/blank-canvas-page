CREATE INDEX IF NOT EXISTS idx_properties_org_created_desc
  ON public.properties (organization_id, created_at DESC);