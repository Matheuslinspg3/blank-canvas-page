
-- Table for organization-level amenities/characteristics
CREATE TABLE public.property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, name)
);

ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;

-- Members can read amenities of their org
CREATE POLICY "Members can view org amenities"
  ON public.property_amenities FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Managers can insert/update/delete
CREATE POLICY "Managers can manage amenities"
  ON public.property_amenities FOR ALL
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Function to seed default amenities for an organization
CREATE OR REPLACE FUNCTION public.seed_default_amenities(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_amenities (organization_id, name, category, is_default)
  VALUES
    -- Lazer
    (org_id, 'Piscina', 'Lazer', true),
    (org_id, 'Churrasqueira', 'Lazer', true),
    (org_id, 'Sacada com Churrasqueira', 'Lazer', true),
    (org_id, 'Academia', 'Lazer', true),
    (org_id, 'Salão de Festas', 'Lazer', true),
    (org_id, 'Salão de Jogos', 'Lazer', true),
    (org_id, 'Playground', 'Lazer', true),
    (org_id, 'Quadra Esportiva', 'Lazer', true),
    (org_id, 'Cinema', 'Lazer', true),
    (org_id, 'Sauna', 'Lazer', true),
    -- Vista e Localização
    (org_id, 'Vista Mar', 'Vista e Localização', true),
    (org_id, 'Frente Mar', 'Vista e Localização', true),
    (org_id, 'Varanda', 'Vista e Localização', true),
    (org_id, 'Jardim', 'Vista e Localização', true),
    -- Infraestrutura
    (org_id, 'Segurança 24h', 'Infraestrutura', true),
    (org_id, 'Portaria', 'Infraestrutura', true),
    (org_id, 'Elevador', 'Infraestrutura', true),
    (org_id, 'Ar Condicionado', 'Infraestrutura', true),
    (org_id, 'Garagem', 'Infraestrutura', true),
    (org_id, 'Entrada Independente', 'Infraestrutura', true),
    -- Mobília
    (org_id, 'Mobiliado', 'Mobília', true),
    (org_id, 'Semi Mobiliado', 'Mobília', true),
    (org_id, 'Sala de TV', 'Mobília', true),
    (org_id, 'Sala de Jantar', 'Mobília', true),
    -- Conveniência
    (org_id, 'Mini Mercado', 'Conveniência', true),
    -- Tipo de Construção
    (org_id, 'Sobreposta Alta', 'Tipo de Construção', true),
    (org_id, 'Térreo', 'Tipo de Construção', true),
    -- Zona Fiscal
    (org_id, 'Zona 1', 'Zona Fiscal', true),
    (org_id, 'Zona 2', 'Zona Fiscal', true),
    (org_id, 'Zona 3', 'Zona Fiscal', true),
    -- Banheiros
    (org_id, 'Lavabo', 'Banheiros', true)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- Seed defaults for all existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_amenities(org.id);
  END LOOP;
END;
$$;
