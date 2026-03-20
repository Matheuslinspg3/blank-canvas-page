-- Seed default property types for all organizations that have none
INSERT INTO property_types (name, is_default, organization_id)
SELECT t.name, true, o.id
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Apartamento'),
    ('Casa'),
    ('Casa em Condomínio'),
    ('Cobertura'),
    ('Kitnet'),
    ('Studio'),
    ('Flat'),
    ('Terreno'),
    ('Chácara'),
    ('Fazenda'),
    ('Sala Comercial'),
    ('Loja'),
    ('Galpão')
) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM property_types pt WHERE pt.organization_id = o.id
)
ON CONFLICT DO NOTHING;

-- Create a function to auto-seed property types for new organizations
CREATE OR REPLACE FUNCTION public.seed_property_types_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_types (name, is_default, organization_id)
  VALUES
    ('Apartamento', true, NEW.id),
    ('Casa', true, NEW.id),
    ('Casa em Condomínio', true, NEW.id),
    ('Cobertura', true, NEW.id),
    ('Kitnet', true, NEW.id),
    ('Studio', true, NEW.id),
    ('Flat', true, NEW.id),
    ('Terreno', true, NEW.id),
    ('Chácara', true, NEW.id),
    ('Fazenda', true, NEW.id),
    ('Sala Comercial', true, NEW.id),
    ('Loja', true, NEW.id),
    ('Galpão', true, NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to auto-seed on new org creation
DROP TRIGGER IF EXISTS trg_seed_property_types ON organizations;
CREATE TRIGGER trg_seed_property_types
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_property_types_for_org();