-- Website settings per organization
CREATE TABLE public.website_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hero_title text,
  hero_subtitle text,
  whatsapp_number text,
  whatsapp_message text DEFAULT 'Olá! Vi seu site e gostaria de mais informações.',
  show_whatsapp_float boolean DEFAULT true,
  contact_email text,
  contact_phone text,
  about_text text,
  meta_title text,
  meta_description text,
  custom_domain text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- Public read for active sites
CREATE POLICY "Public can read active website settings"
  ON public.website_settings FOR SELECT
  USING (is_active = true);

-- Org members can manage their own settings
CREATE POLICY "Org members can manage website settings"
  ON public.website_settings FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Index for fast lookup
CREATE INDEX idx_website_settings_org ON public.website_settings(organization_id);
