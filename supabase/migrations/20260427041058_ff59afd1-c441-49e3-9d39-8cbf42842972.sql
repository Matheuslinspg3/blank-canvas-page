-- =========================================================================
-- Fase 3 - Controle de Revisão de Imóveis
-- =========================================================================

-- 1) Tabela property_review_settings (1 linha por organização)
CREATE TABLE IF NOT EXISTS public.property_review_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  overdue_after_days  integer NOT NULL DEFAULT 60,
  warning_before_days integer NOT NULL DEFAULT 15,
  show_dashboard_card boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prs_overdue_range  CHECK (overdue_after_days  BETWEEN 7 AND 365),
  CONSTRAINT prs_warning_range  CHECK (warning_before_days BETWEEN 1 AND 60),
  CONSTRAINT prs_warning_lt_overdue CHECK (warning_before_days < overdue_after_days)
);

ALTER TABLE public.property_review_settings ENABLE ROW LEVEL SECURITY;

-- Policies (separadas, sem FOR ALL, sem DELETE)
DROP POLICY IF EXISTS "prs_select_own_org"  ON public.property_review_settings;
DROP POLICY IF EXISTS "prs_insert_admins"   ON public.property_review_settings;
DROP POLICY IF EXISTS "prs_update_admins"   ON public.property_review_settings;

CREATE POLICY "prs_select_own_org"
  ON public.property_review_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "prs_insert_admins"
  ON public.property_review_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sub_admin'::app_role)
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  );

CREATE POLICY "prs_update_admins"
  ON public.property_review_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sub_admin'::app_role)
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  )
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_prs_updated_at ON public.property_review_settings;
CREATE TRIGGER trg_prs_updated_at
  BEFORE UPDATE ON public.property_review_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Índice de performance (genérico)
CREATE INDEX IF NOT EXISTS idx_properties_org_last_reviewed
  ON public.properties (organization_id, last_reviewed_at NULLS FIRST);

-- 3) Atualizar search_properties_advanced
--    - tenant guard (rejeita p_organization_id != org do usuário)
--    - LEFT JOIN com property_review_settings (defaults 60/15)
--    - 3 novos valores em p_review_status
CREATE OR REPLACE FUNCTION public.search_properties_advanced(
  p_organization_id uuid,
  p_search_text text DEFAULT NULL::text,
  p_property_code text DEFAULT NULL::text,
  p_transaction_type text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_property_type_id uuid DEFAULT NULL::uuid,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_bedrooms integer DEFAULT NULL::integer,
  p_neighborhood text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_min_area numeric DEFAULT NULL::numeric,
  p_limit integer DEFAULT 2000,
  p_offset integer DEFAULT 0,
  p_min_suites integer DEFAULT NULL::integer,
  p_min_parking integer DEFAULT NULL::integer,
  p_max_area numeric DEFAULT NULL::numeric,
  p_min_condominium numeric DEFAULT NULL::numeric,
  p_max_condominium numeric DEFAULT NULL::numeric,
  p_amenities text[] DEFAULT NULL::text[],
  p_property_condition text DEFAULT NULL::text,
  p_max_beach_distance integer DEFAULT NULL::integer,
  p_launch_stage text DEFAULT NULL::text,
  p_neighborhoods text[] DEFAULT NULL::text[],
  p_cities text[] DEFAULT NULL::text[],
  p_sort_by text DEFAULT 'recent'::text,
  p_owner_id uuid DEFAULT NULL::uuid,
  p_review_status text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, property_code text, title text, description text,
  address_city text, address_neighborhood text, address_state text,
  sale_price numeric, rent_price numeric,
  bedrooms integer, bathrooms integer, parking_spots integer,
  area_total numeric, area_built numeric,
  status text, transaction_type text, property_type_id uuid,
  cover_image_url text, beach_distance_meters integer,
  created_at timestamptz, updated_at timestamptz, last_reviewed_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_org   uuid := public.get_user_organization_id();
  v_overdue    int;
  v_warning    int;
  v_safe       int;
BEGIN
  -- Tenant guard
  IF v_user_org IS NULL OR p_organization_id IS NULL OR p_organization_id <> v_user_org THEN
    RETURN;
  END IF;

  SELECT COALESCE(s.overdue_after_days, 60),
         COALESCE(s.warning_before_days, 15)
    INTO v_overdue, v_warning
  FROM (SELECT v_user_org AS oid) x
  LEFT JOIN public.property_review_settings s
    ON s.organization_id = x.oid;

  v_safe := v_overdue - v_warning;

  RETURN QUERY
  WITH filtered AS (
    SELECT p.*
    FROM public.properties p
    WHERE p.organization_id = p_organization_id
      AND (p_search_text IS NULL
        OR p.title ILIKE '%' || p_search_text || '%'
        OR p.address_street ILIKE '%' || p_search_text || '%'
        OR p.address_city ILIKE '%' || p_search_text || '%'
        OR p.address_neighborhood ILIKE '%' || p_search_text || '%'
        OR p.property_code ILIKE '%' || p_search_text || '%'
        OR p.description ILIKE '%' || p_search_text || '%')
      AND (p_property_code IS NULL OR p.property_code ILIKE p_property_code || '%')
      AND (p_transaction_type IS NULL OR p_transaction_type = 'all'
        OR p.transaction_type::text = p_transaction_type
        OR (p_transaction_type IN ('venda', 'aluguel') AND p.transaction_type = 'ambos'))
      AND (p_status IS NULL OR p_status = 'all' OR p.status::text = p_status)
      AND (p_property_type_id IS NULL OR p.property_type_id = p_property_type_id)
      AND (p_min_price IS NULL OR COALESCE(p.sale_price, 0) >= p_min_price OR COALESCE(p.rent_price, 0) >= p_min_price)
      AND (p_max_price IS NULL OR (p.sale_price IS NOT NULL AND p.sale_price <= p_max_price) OR (p.rent_price IS NOT NULL AND p.rent_price <= p_max_price))
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
      AND (
        (p_neighborhoods IS NOT NULL AND array_length(p_neighborhoods, 1) > 0 AND p.address_neighborhood = ANY(p_neighborhoods))
        OR (p_neighborhood IS NOT NULL AND p.address_neighborhood ILIKE '%' || p_neighborhood || '%')
        OR (p_neighborhoods IS NULL AND p_neighborhood IS NULL)
      )
      AND (
        (p_cities IS NOT NULL AND array_length(p_cities, 1) > 0 AND p.address_city = ANY(p_cities))
        OR (p_city IS NOT NULL AND p.address_city ILIKE '%' || p_city || '%')
        OR (p_cities IS NULL AND p_city IS NULL)
      )
      AND (p_min_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) >= p_min_area)
      AND (p_min_suites IS NULL OR COALESCE(p.suites, 0) >= p_min_suites)
      AND (p_min_parking IS NULL OR COALESCE(p.parking_spots, 0) >= p_min_parking)
      AND (p_max_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) <= p_max_area)
      AND (p_min_condominium IS NULL OR COALESCE(p.condominium_fee, 0) >= p_min_condominium)
      AND (p_max_condominium IS NULL OR COALESCE(p.condominium_fee, 0) <= p_max_condominium)
      AND (p_amenities IS NULL OR p.amenities @> p_amenities)
      AND (p_property_condition IS NULL OR p.property_condition::text = p_property_condition)
      AND (p_max_beach_distance IS NULL OR (p.beach_distance_meters IS NOT NULL AND p.beach_distance_meters <= p_max_beach_distance))
      AND (p_launch_stage IS NULL OR p.launch_stage::text = p_launch_stage)
      AND (
        p_owner_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.property_owners po
           WHERE po.property_id = p.id
             AND po.owner_id = p_owner_id
             AND po.organization_id = p_organization_id
        )
      )
      AND (
        p_review_status IS NULL OR p_review_status = 'all'
        OR (p_review_status = 'reviewed_30' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '30 days')
        OR (p_review_status = 'reviewed_60' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '60 days')
        OR (p_review_status = 'reviewed_90' AND p.last_reviewed_at IS NOT NULL AND p.last_reviewed_at >= now() - interval '90 days')
        OR (p_review_status = 'overdue_30' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '30 days'))
        OR (p_review_status = 'overdue_60' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '60 days'))
        OR (p_review_status = 'overdue_90' AND (p.last_reviewed_at IS NULL OR p.last_reviewed_at < now() - interval '90 days'))
        OR (p_review_status = 'never'      AND p.last_reviewed_at IS NULL)
        -- Novos valores Fase 3 (configuração por organização)
        OR (p_review_status = 'overdue_configured'
            AND (p.last_reviewed_at IS NULL
                 OR p.last_reviewed_at < now() - (v_overdue * interval '1 day')))
        OR (p_review_status = 'near_due'
            AND p.last_reviewed_at IS NOT NULL
            AND p.last_reviewed_at <  now() - (v_safe    * interval '1 day')
            AND p.last_reviewed_at >= now() - (v_overdue * interval '1 day'))
        OR (p_review_status = 'within_due'
            AND p.last_reviewed_at IS NOT NULL
            AND p.last_reviewed_at >= now() - (v_safe * interval '1 day'))
      )
  ),
  counted AS (SELECT count(*) AS cnt FROM filtered)
  SELECT
    f.id,
    f.property_code::text,
    f.title::text,
    f.description::text,
    f.address_city::text,
    f.address_neighborhood::text,
    f.address_state::text,
    f.sale_price,
    f.rent_price,
    f.bedrooms,
    f.bathrooms,
    f.parking_spots,
    f.area_total,
    f.area_built,
    f.status::text,
    f.transaction_type::text,
    f.property_type_id,
    COALESCE(f.cover_image_url,
      (SELECT pi.url FROM public.property_images pi
        WHERE pi.property_id = f.id AND pi.is_cover = true LIMIT 1)) AS cover_image_url,
    f.beach_distance_meters,
    f.created_at,
    f.updated_at,
    f.last_reviewed_at,
    c.cnt AS total_count
  FROM filtered f, counted c
  ORDER BY
    CASE WHEN p_sort_by = 'oldest' THEN f.created_at END ASC,
    CASE WHEN p_sort_by = 'price_asc' THEN f.sale_price END ASC,
    CASE WHEN p_sort_by = 'price_desc' THEN f.sale_price END DESC,
    CASE WHEN p_sort_by = 'beach_asc' THEN f.beach_distance_meters END ASC,
    CASE WHEN p_sort_by = 'beach_desc' THEN f.beach_distance_meters END DESC,
    CASE WHEN p_sort_by = 'recent' OR p_sort_by IS NULL THEN f.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- 4) Nova RPC get_property_review_dashboard
CREATE OR REPLACE FUNCTION public.get_property_review_dashboard(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := public.get_user_organization_id();
  v_overdue  int;
  v_warning  int;
  v_safe     int;
  v_counts   jsonb;
  v_critical jsonb;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object(
      'overdue_count', 0,
      'never_count', 0,
      'warning_count', 0,
      'overdue_after_days', 60,
      'warning_before_days', 15,
      'critical', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(s.overdue_after_days, 60),
         COALESCE(s.warning_before_days, 15)
    INTO v_overdue, v_warning
  FROM (SELECT v_org AS oid) x
  LEFT JOIN public.property_review_settings s
    ON s.organization_id = x.oid;

  v_safe := v_overdue - v_warning;

  -- Sem dupla contagem:
  --  never_count   = NULL
  --  overdue_count = NOT NULL e vencido
  --  warning_count = NOT NULL e na janela de aviso, ainda nao vencido
  SELECT jsonb_build_object(
    'never_count',   count(*) FILTER (WHERE last_reviewed_at IS NULL),
    'overdue_count', count(*) FILTER (WHERE last_reviewed_at IS NOT NULL
                       AND last_reviewed_at <  now() - (v_overdue * interval '1 day')),
    'warning_count', count(*) FILTER (WHERE last_reviewed_at IS NOT NULL
                       AND last_reviewed_at <  now() - (v_safe    * interval '1 day')
                       AND last_reviewed_at >= now() - (v_overdue * interval '1 day')),
    'overdue_after_days', v_overdue,
    'warning_before_days', v_warning
  ) INTO v_counts
  FROM public.properties
  WHERE organization_id = v_org
    AND status::text IN ('disponivel','reservado');

  -- Lista critica: nunca + vencidos + proximos do prazo
  SELECT jsonb_agg(row_to_json(t))
    INTO v_critical
  FROM (
    SELECT
      p.id,
      p.title,
      p.property_code::text AS property_code,
      p.status::text AS status,
      p.last_reviewed_at,
      CASE WHEN p.last_reviewed_at IS NULL THEN NULL
           ELSE EXTRACT(day FROM now() - p.last_reviewed_at)::int END AS days_since,
      CASE
        WHEN p.last_reviewed_at IS NULL THEN 1
        WHEN p.last_reviewed_at < now() - (v_overdue * interval '1 day') THEN 2
        ELSE 3
      END AS priority,
      (
        SELECT o.primary_name
        FROM public.property_owners po
        JOIN public.owners o ON o.id = po.owner_id
        WHERE po.property_id = p.id
        ORDER BY po.is_primary DESC NULLS LAST
        LIMIT 1
      ) AS owner_name
    FROM public.properties p
    WHERE p.organization_id = v_org
      AND p.status::text IN ('disponivel','reservado')
      AND (
        p.last_reviewed_at IS NULL
        OR p.last_reviewed_at < now() - (v_safe * interval '1 day')
      )
    ORDER BY priority ASC, days_since DESC NULLS FIRST
    LIMIT GREATEST(COALESCE(p_limit, 10), 1)
  ) t;

  RETURN v_counts || jsonb_build_object('critical', COALESCE(v_critical, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_property_review_dashboard(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_property_review_dashboard(int) TO authenticated;