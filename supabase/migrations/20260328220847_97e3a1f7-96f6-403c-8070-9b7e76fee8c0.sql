-- 1. Adicionar colunas
ALTER TABLE public.whatsapp_agent_config 
  ADD COLUMN IF NOT EXISTS cached_property_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cached_bairros jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cache_updated_at timestamptz;

-- 2. Função que atualiza o cache
CREATE OR REPLACE FUNCTION refresh_agent_config_cache(org_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.whatsapp_agent_config
  SET 
    cached_property_types = COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', pt.id, 'name', pt.name))
      FROM properties p
      JOIN property_types pt ON pt.id = p.property_type_id
      WHERE p.organization_id = org_id
      AND p.property_type_id IS NOT NULL
    ), '[]'::jsonb),
    cached_bairros = COALESCE((
      SELECT jsonb_agg(DISTINCT p.address_neighborhood)
      FROM properties p
      WHERE p.organization_id = org_id
      AND p.address_neighborhood IS NOT NULL
      AND p.address_neighborhood != ''
    ), '[]'::jsonb),
    cache_updated_at = now()
  WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger automático quando propriedades mudam
CREATE OR REPLACE FUNCTION trigger_refresh_agent_cache()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_agent_config_cache(
    COALESCE(NEW.organization_id, OLD.organization_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_refresh_agent_cache ON properties;
CREATE TRIGGER trg_refresh_agent_cache
  AFTER INSERT OR UPDATE OF property_type_id, address_neighborhood 
  OR DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_agent_cache();

-- 4. Popular o cache AGORA para dados existentes
SELECT refresh_agent_config_cache(organization_id) 
FROM whatsapp_agent_config;