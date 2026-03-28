CREATE OR REPLACE FUNCTION refresh_agent_config_cache(org_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.whatsapp_agent_config
  SET 
    cached_property_types = COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', pt.id, 'name', pt.name))
      FROM public.properties p
      JOIN public.property_types pt ON pt.id = p.property_type_id
      WHERE p.organization_id = org_id
      AND p.property_type_id IS NOT NULL
    ), '[]'::jsonb),
    cached_bairros = COALESCE((
      SELECT jsonb_agg(DISTINCT p.address_neighborhood)
      FROM public.properties p
      WHERE p.organization_id = org_id
      AND p.address_neighborhood IS NOT NULL
      AND p.address_neighborhood != ''
    ), '[]'::jsonb),
    cache_updated_at = now()
  WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_refresh_agent_cache()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_agent_config_cache(
    COALESCE(NEW.organization_id, OLD.organization_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;