CREATE OR REPLACE FUNCTION refresh_agent_config_cache(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_agent_config
  SET 
    cached_property_types = COALESCE((
      SELECT jsonb_agg(sub.obj)
      FROM (
        SELECT DISTINCT ON (pt.name)
          jsonb_build_object('id', pt.id, 'name', pt.name) AS obj
        FROM properties p
        JOIN property_types pt ON pt.id = p.property_type_id
        WHERE p.organization_id = org_id
        AND p.property_type_id IS NOT NULL
        ORDER BY pt.name, pt.created_at ASC
      ) sub
    ), '[]'::jsonb),
    cached_bairros = COALESCE((
      SELECT jsonb_agg(DISTINCT initcap(trim(p.address_neighborhood)))
      FROM properties p
      WHERE p.organization_id = org_id
      AND p.address_neighborhood IS NOT NULL
      AND trim(p.address_neighborhood) != ''
    ), '[]'::jsonb),
    cache_updated_at = now()
  WHERE organization_id = org_id;
END;
$$;

SELECT refresh_agent_config_cache(organization_id) 
FROM whatsapp_agent_config;