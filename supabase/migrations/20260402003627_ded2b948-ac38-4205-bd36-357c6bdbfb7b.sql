
CREATE TABLE public.ai_qualification_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  required_fields TEXT[] NOT NULL DEFAULT ARRAY['nome', 'telefone', 'email'],
  broker_assignment_mode TEXT NOT NULL DEFAULT 'manual',
  auto_qualify_leads BOOLEAN NOT NULL DEFAULT false,
  auto_create_leads BOOLEAN NOT NULL DEFAULT false,
  schedule_visits BOOLEAN NOT NULL DEFAULT false,
  scheduling_days TEXT[] NOT NULL DEFAULT ARRAY['seg', 'ter', 'qua', 'qui', 'sex'],
  scheduling_hour_start TEXT NOT NULL DEFAULT '09:00',
  scheduling_hour_end TEXT NOT NULL DEFAULT '17:00',
  prompt_qualify_leads TEXT DEFAULT '',
  prompt_create_leads TEXT DEFAULT '',
  prompt_schedule_visits TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE ai_qualification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org qualification config"
  ON ai_qualification_config FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Members can insert own org qualification config"
  ON ai_qualification_config FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Members can update own org qualification config"
  ON ai_qualification_config FOR UPDATE
  USING (organization_id = get_user_organization_id());
