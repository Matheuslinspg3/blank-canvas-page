
-- Buildings/Developments catalog table
CREATE TABLE public.buildings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  developer_name TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  year_built INTEGER,
  total_floors INTEGER,
  total_units INTEGER,
  description TEXT,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast org lookups
CREATE INDEX idx_buildings_org ON public.buildings(organization_id);
CREATE INDEX idx_buildings_city ON public.buildings(address_city);

-- Enable RLS
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- RLS: members can view their org's buildings + public buildings
CREATE POLICY "Users can view own org buildings"
  ON public.buildings FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT get_user_organization_id())
    OR is_public = true
  );

CREATE POLICY "Users can insert own org buildings"
  ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can update own org buildings"
  ON public.buildings FOR UPDATE TO authenticated
  USING (organization_id = (SELECT get_user_organization_id()))
  WITH CHECK (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can delete own org buildings"
  ON public.buildings FOR DELETE TO authenticated
  USING (organization_id = (SELECT get_user_organization_id()));

-- Add building_id reference to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_building ON public.properties(building_id);

-- Updated_at trigger
CREATE TRIGGER set_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
