-- 1. Add broker_token to property_share_links
ALTER TABLE public.property_share_links
  ADD COLUMN IF NOT EXISTS broker_token text;

-- Backfill tokens for existing rows
UPDATE public.property_share_links
SET broker_token = 'b' || substr(md5(id::text || random()::text), 1, 9)
WHERE broker_token IS NULL;

ALTER TABLE public.property_share_links
  ADD CONSTRAINT property_share_links_broker_token_key UNIQUE (broker_token);

CREATE INDEX IF NOT EXISTS idx_share_links_token_active
  ON public.property_share_links(broker_token) WHERE active = true;

-- 2. Visits tracking table
CREATE TABLE IF NOT EXISTS public.property_share_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid NOT NULL REFERENCES public.property_share_links(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  referrer text
);

CREATE INDEX IF NOT EXISTS idx_share_visits_link ON public.property_share_visits(share_link_id, visited_at DESC);

ALTER TABLE public.property_share_visits ENABLE ROW LEVEL SECURITY;

-- Anyone can record a visit (public tracking)
CREATE POLICY "Anyone can insert share visits"
  ON public.property_share_visits FOR INSERT
  WITH CHECK (true);

-- Only org members can read visits for their properties
CREATE POLICY "Org members read their share visits"
  ON public.property_share_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.property_share_links sl
      JOIN public.properties p ON p.id = sl.property_id
      JOIN public.profiles pr ON pr.user_id = auth.uid()
      WHERE sl.id = property_share_visits.share_link_id
        AND pr.organization_id = p.organization_id
    )
  );

-- 3. RPC: get_landing_contact
CREATE OR REPLACE FUNCTION public.get_landing_contact(
  p_property_id uuid,
  p_broker_token text DEFAULT NULL
)
RETURNS TABLE (
  broker_name text,
  broker_phone text,
  broker_avatar text,
  broker_email text,
  org_name text,
  org_logo text,
  org_phone text,
  attribution_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_broker_id uuid;
  v_source text := 'org_fallback';
BEGIN
  -- Resolve organization_id from property
  SELECT organization_id INTO v_org_id
  FROM public.properties
  WHERE id = p_property_id;

  IF v_org_id IS NULL THEN
    -- try marketplace_properties
    SELECT organization_id INTO v_org_id
    FROM public.marketplace_properties
    WHERE id = p_property_id OR property_id = p_property_id
    LIMIT 1;
  END IF;

  -- 1) Token-based attribution
  IF p_broker_token IS NOT NULL THEN
    SELECT sl.broker_id INTO v_broker_id
    FROM public.property_share_links sl
    WHERE sl.broker_token = p_broker_token
      AND sl.active = true
      AND sl.property_id = p_property_id
    LIMIT 1;
    IF v_broker_id IS NOT NULL THEN
      v_source := 'shared_link';
    END IF;
  END IF;

  -- 2) Captador fallback
  IF v_broker_id IS NULL THEN
    SELECT captador_id INTO v_broker_id FROM public.properties WHERE id = p_property_id;
    IF v_broker_id IS NOT NULL THEN v_source := 'captador'; END IF;
  END IF;

  -- 3) created_by fallback
  IF v_broker_id IS NULL THEN
    SELECT created_by INTO v_broker_id FROM public.properties WHERE id = p_property_id;
    IF v_broker_id IS NOT NULL THEN v_source := 'created_by'; END IF;
  END IF;

  -- 4) Admin with phone fallback
  IF v_broker_id IS NULL AND v_org_id IS NOT NULL THEN
    SELECT pr.user_id INTO v_broker_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.user_id
    WHERE pr.organization_id = v_org_id
      AND pr.phone IS NOT NULL AND length(trim(pr.phone)) > 0
      AND ur.role IN ('admin','sub_admin','owner')
    LIMIT 1;
    IF v_broker_id IS NOT NULL THEN v_source := 'org_admin'; END IF;
  END IF;

  RETURN QUERY
  SELECT
    pr.full_name::text,
    pr.phone::text,
    pr.avatar_url::text,
    pr.email::text,
    o.name::text,
    o.logo_url::text,
    o.phone::text,
    v_source
  FROM public.organizations o
  LEFT JOIN public.profiles pr ON pr.user_id = v_broker_id
  WHERE o.id = v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_contact(uuid, text) TO anon, authenticated;

-- 4. Trigger: require broker phone before creating share link
CREATE OR REPLACE FUNCTION public.trg_share_link_require_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  SELECT phone INTO v_phone FROM public.profiles WHERE user_id = NEW.broker_id;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN
    RAISE EXCEPTION 'Cadastre seu telefone no perfil antes de compartilhar a landing page.'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Auto-generate token if missing
  IF NEW.broker_token IS NULL THEN
    NEW.broker_token := 'b' || substr(md5(gen_random_uuid()::text), 1, 9);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_broker_phone_before_share ON public.property_share_links;
CREATE TRIGGER check_broker_phone_before_share
  BEFORE INSERT ON public.property_share_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_share_link_require_phone();

-- 5. Health check view
CREATE OR REPLACE VIEW public.vw_landing_links_without_contact AS
SELECT
  sl.id AS share_link_id,
  sl.property_id,
  sl.broker_id,
  sl.broker_token,
  pr.full_name AS broker_name,
  pr.phone AS broker_phone,
  p.organization_id,
  o.name AS org_name
FROM public.property_share_links sl
LEFT JOIN public.profiles pr ON pr.user_id = sl.broker_id
LEFT JOIN public.properties p ON p.id = sl.property_id
LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE sl.active = true
  AND (pr.phone IS NULL OR length(trim(pr.phone)) = 0);