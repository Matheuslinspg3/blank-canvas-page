
-- Create property_groups table for batch variation tracking
CREATE TABLE public.property_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.property_groups ENABLE ROW LEVEL SECURITY;

-- RLS policy: org members only
CREATE POLICY "org_access" ON public.property_groups
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Add property_group_id to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_group_id uuid REFERENCES property_groups(id) ON DELETE SET NULL;

-- Partial index for group lookups
CREATE INDEX idx_properties_group ON properties(property_group_id) WHERE property_group_id IS NOT NULL;
