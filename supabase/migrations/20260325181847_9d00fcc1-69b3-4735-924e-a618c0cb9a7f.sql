CREATE TABLE public.financing_bank_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  bank_code text NOT NULL,
  rate_min numeric(5,2) NOT NULL,
  rate_max numeric(5,2) NOT NULL,
  spread_over_selic numeric(5,2) DEFAULT 0,
  max_ltv numeric(5,2) DEFAULT 80,
  max_term_months integer DEFAULT 420,
  notes text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(organization_id, bank_code)
);

ALTER TABLE public.financing_bank_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org rates"
  ON public.financing_bank_rates FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Managers can manage rates"
  ON public.financing_bank_rates FOR ALL
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.is_org_manager_or_above(auth.uid())
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.is_org_manager_or_above(auth.uid())
  );