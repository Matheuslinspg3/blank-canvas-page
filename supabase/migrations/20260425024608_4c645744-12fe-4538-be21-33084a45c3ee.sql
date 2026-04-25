
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS secondary_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.leads.secondary_sources IS
  'Canais adicionais por onde o lead também foi captado, no formato [{external_source, source, traffic_source, conversion_identifier, external_id, captured_at}]. A origem principal continua nas colunas source/external_source/traffic_source.';

CREATE INDEX IF NOT EXISTS idx_leads_secondary_sources_gin
  ON public.leads USING gin (secondary_sources);

-- Helper: tenta mesclar um lead vindo de canal externo (RD/Meta) num lead já existente.
-- Retorna o id do lead existente (e mescla os metadados) ou NULL se não houver match.
CREATE OR REPLACE FUNCTION public.merge_external_lead(
  p_organization_id uuid,
  p_email text,
  p_phone text,
  p_external_source text,         -- ex.: 'meta_ads' | 'rdstation'
  p_source text,                   -- "tag" amigável (ex.: nome do anúncio)
  p_traffic_source text DEFAULT NULL,
  p_conversion_identifier text DEFAULT NULL,
  p_external_id text DEFAULT NULL,
  p_window_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
  v_norm_email  text;
  v_existing_id uuid;
  v_existing    public.leads%ROWTYPE;
  v_already     boolean := false;
  v_new_entry   jsonb;
  v_user_id     uuid;
BEGIN
  v_clean_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_norm_email  := lower(trim(coalesce(p_email, '')));

  -- 1) Match por e-mail (case-insensitive) na janela
  IF v_norm_email <> '' THEN
    SELECT * INTO v_existing
    FROM public.leads
    WHERE organization_id = p_organization_id
      AND is_active = true
      AND lower(trim(email)) = v_norm_email
      AND greatest(coalesce(updated_at, created_at), created_at) > (now() - make_interval(days => p_window_days))
    ORDER BY greatest(coalesce(updated_at, created_at), created_at) DESC
    LIMIT 1;
    IF FOUND THEN v_existing_id := v_existing.id; END IF;
  END IF;

  -- 2) Match por telefone normalizado, se ainda não achou
  IF v_existing_id IS NULL AND length(v_clean_phone) >= 8 THEN
    SELECT * INTO v_existing
    FROM public.leads
    WHERE organization_id = p_organization_id
      AND is_active = true
      AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND greatest(coalesce(updated_at, created_at), created_at) > (now() - make_interval(days => p_window_days))
    ORDER BY greatest(coalesce(updated_at, created_at), created_at) DESC
    LIMIT 1;
    IF FOUND THEN v_existing_id := v_existing.id; END IF;
  END IF;

  IF v_existing_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Já existe esse external_source registrado (principal ou secundário)? Evita repetir.
  IF v_existing.external_source = p_external_source THEN
    v_already := true;
  ELSIF v_existing.secondary_sources IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_existing.secondary_sources) e
      WHERE e->>'external_source' = p_external_source
        AND coalesce(e->>'external_id','') = coalesce(p_external_id,'')
    ) INTO v_already;
  END IF;

  IF NOT v_already THEN
    v_new_entry := jsonb_build_object(
      'external_source', p_external_source,
      'source', p_source,
      'traffic_source', p_traffic_source,
      'conversion_identifier', p_conversion_identifier,
      'external_id', p_external_id,
      'captured_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    UPDATE public.leads
       SET secondary_sources = coalesce(secondary_sources, '[]'::jsonb) || v_new_entry,
           updated_at = now()
     WHERE id = v_existing_id;

    -- Registra interação no histórico (created_by exigido — usa o created_by do lead existente)
    v_user_id := v_existing.created_by;
    BEGIN
      INSERT INTO public.lead_interactions (
        lead_id, organization_id, created_by, interaction_type, description, metadata
      ) VALUES (
        v_existing_id,
        p_organization_id,
        v_user_id,
        'note',
        format('Lead também captado por %s%s',
               coalesce(p_source, p_external_source),
               case when p_traffic_source is not null and p_traffic_source <> coalesce(p_source,'') 
                    then ' (' || p_traffic_source || ')' else '' end),
        v_new_entry
      );
    EXCEPTION WHEN OTHERS THEN
      -- Se a tabela tiver outro shape, não falha o merge
      NULL;
    END;
  END IF;

  RETURN v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_external_lead(uuid, text, text, text, text, text, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_external_lead(uuid, text, text, text, text, text, text, text, integer) TO authenticated, service_role;
