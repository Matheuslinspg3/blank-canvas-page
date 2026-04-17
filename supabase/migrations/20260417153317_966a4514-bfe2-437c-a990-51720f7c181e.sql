-- Garante extensão para autocomplete por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================
-- 1. Catálogo IBGE de municípios (global)
-- =========================================
CREATE TABLE IF NOT EXISTS public.ibge_municipios (
  ibge_code        text PRIMARY KEY,
  uf               char(2) NOT NULL,
  name             text NOT NULL,
  name_normalized  text NOT NULL,
  capital          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_uf_name ON public.ibge_municipios (uf, name_normalized);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_name_trgm ON public.ibge_municipios USING gin (name_normalized gin_trgm_ops);

ALTER TABLE public.ibge_municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read municipios"
  ON public.ibge_municipios FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only system admins can manage municipios"
  ON public.ibge_municipios FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- =========================================
-- 2. Regras de ITBI (globais, versionadas)
-- =========================================
CREATE TABLE IF NOT EXISTS public.itbi_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           text NOT NULL CHECK (scope IN ('municipio','uf','nacional')),
  ibge_code       text REFERENCES public.ibge_municipios(ibge_code) ON DELETE SET NULL,
  uf              char(2),
  rule            jsonb NOT NULL,
  source_url      text,
  source_label    text,
  confidence      text NOT NULL CHECK (confidence IN ('oficial_validada','oficial','estimativa_uf','fallback')),
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  version         int NOT NULL DEFAULT 1,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itbi_rules_municipio ON public.itbi_rules (ibge_code, is_active, effective_from DESC) WHERE scope = 'municipio';
CREATE INDEX IF NOT EXISTS idx_itbi_rules_uf ON public.itbi_rules (uf, is_active, effective_from DESC) WHERE scope = 'uf';
CREATE INDEX IF NOT EXISTS idx_itbi_rules_nacional ON public.itbi_rules (is_active, effective_from DESC) WHERE scope = 'nacional';

ALTER TABLE public.itbi_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read itbi rules"
  ON public.itbi_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only system admins can manage itbi rules"
  ON public.itbi_rules FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE TRIGGER trg_itbi_rules_updated_at
  BEFORE UPDATE ON public.itbi_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3. Overrides por organização
-- =========================================
CREATE TABLE IF NOT EXISTS public.itbi_org_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ibge_code       text NOT NULL REFERENCES public.ibge_municipios(ibge_code) ON DELETE CASCADE,
  rule            jsonb NOT NULL,
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ibge_code)
);

CREATE INDEX IF NOT EXISTS idx_itbi_overrides_org ON public.itbi_org_overrides (organization_id, ibge_code);

ALTER TABLE public.itbi_org_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org overrides"
  ON public.itbi_org_overrides FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Org admins/leaders can manage overrides"
  ON public.itbi_org_overrides FOR ALL
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (
      public.is_org_admin(auth.uid())
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (
      public.is_org_admin(auth.uid())
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  );

CREATE TRIGGER trg_itbi_overrides_updated_at
  BEFORE UPDATE ON public.itbi_org_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4. Snapshot de ITBI nas simulações
-- =========================================
ALTER TABLE public.simulacoes_financiamento
  ADD COLUMN IF NOT EXISTS itbi_value numeric,
  ADD COLUMN IF NOT EXISTS itbi_ibge_code text,
  ADD COLUMN IF NOT EXISTS itbi_rule_version int,
  ADD COLUMN IF NOT EXISTS itbi_rule_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS itbi_confidence text;

-- =========================================
-- 5. Resolver: prioridade override → município → UF → nacional
-- =========================================
CREATE OR REPLACE FUNCTION public.resolve_itbi(
  p_ibge text,
  p_uf   text,
  p_org  uuid
)
RETURNS TABLE (
  source         text,
  confidence     text,
  rule           jsonb,
  rule_version   int,
  source_url     text,
  source_label   text,
  ibge_code      text,
  uf             text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Override da organização
  IF p_org IS NOT NULL AND p_ibge IS NOT NULL THEN
    RETURN QUERY
    SELECT 'org_override'::text, 'oficial_validada'::text, o.rule, 1::int,
           NULL::text, 'Regra personalizada da organização'::text,
           o.ibge_code, (SELECT m.uf FROM ibge_municipios m WHERE m.ibge_code = o.ibge_code)::text
    FROM itbi_org_overrides o
    WHERE o.organization_id = p_org AND o.ibge_code = p_ibge
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2) Regra municipal vigente
  IF p_ibge IS NOT NULL THEN
    RETURN QUERY
    SELECT 'municipio'::text, r.confidence, r.rule, r.version,
           r.source_url, r.source_label, r.ibge_code, r.uf::text
    FROM itbi_rules r
    WHERE r.scope = 'municipio'
      AND r.ibge_code = p_ibge
      AND r.is_active = true
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    ORDER BY r.effective_from DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3) Regra estadual
  IF p_uf IS NOT NULL THEN
    RETURN QUERY
    SELECT 'uf'::text, r.confidence, r.rule, r.version,
           r.source_url, r.source_label, NULL::text, r.uf::text
    FROM itbi_rules r
    WHERE r.scope = 'uf'
      AND r.uf = p_uf
      AND r.is_active = true
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    ORDER BY r.effective_from DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 4) Fallback nacional
  RETURN QUERY
  SELECT 'fallback'::text, 'fallback'::text,
         jsonb_build_object('type','flat','rate',3.0,'base','venda'),
         1::int, NULL::text, 'Estimativa nacional padrão (3%)'::text,
         NULL::text, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_itbi(text, text, uuid) TO anon, authenticated;

-- =========================================
-- 6. Seed estadual (27 UFs como estimativa_uf)
-- =========================================
INSERT INTO public.itbi_rules (scope, uf, rule, confidence, source_label, effective_from)
VALUES
  ('uf','SP', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual SP', CURRENT_DATE),
  ('uf','RJ', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual RJ', CURRENT_DATE),
  ('uf','MG', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual MG', CURRENT_DATE),
  ('uf','PR', jsonb_build_object('type','flat','rate',2.5,'base','venda'), 'estimativa_uf', 'Estimativa estadual PR', CURRENT_DATE),
  ('uf','SC', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual SC', CURRENT_DATE),
  ('uf','RS', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual RS', CURRENT_DATE),
  ('uf','BA', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual BA', CURRENT_DATE),
  ('uf','PE', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual PE', CURRENT_DATE),
  ('uf','CE', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual CE', CURRENT_DATE),
  ('uf','DF', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa distrital DF', CURRENT_DATE),
  ('uf','GO', jsonb_build_object('type','flat','rate',2.5,'base','venda'), 'estimativa_uf', 'Estimativa estadual GO', CURRENT_DATE),
  ('uf','ES', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual ES', CURRENT_DATE),
  ('uf','MA', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual MA', CURRENT_DATE),
  ('uf','PA', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual PA', CURRENT_DATE),
  ('uf','MT', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual MT', CURRENT_DATE),
  ('uf','MS', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual MS', CURRENT_DATE),
  ('uf','RN', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual RN', CURRENT_DATE),
  ('uf','PB', jsonb_build_object('type','flat','rate',3.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual PB', CURRENT_DATE),
  ('uf','AL', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual AL', CURRENT_DATE),
  ('uf','SE', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual SE', CURRENT_DATE),
  ('uf','PI', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual PI', CURRENT_DATE),
  ('uf','RO', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual RO', CURRENT_DATE),
  ('uf','TO', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual TO', CURRENT_DATE),
  ('uf','AC', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual AC', CURRENT_DATE),
  ('uf','AM', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual AM', CURRENT_DATE),
  ('uf','AP', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual AP', CURRENT_DATE),
  ('uf','RR', jsonb_build_object('type','flat','rate',2.0,'base','venda'), 'estimativa_uf', 'Estimativa estadual RR', CURRENT_DATE)
ON CONFLICT DO NOTHING;