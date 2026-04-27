-- Helpers SECURITY DEFINER (nomes específicos para evitar conflito com is_org_manager existente)
CREATE OR REPLACE FUNCTION public.is_leads_org_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text IN ('admin','sub_admin','leader','developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lead_eligible_responsible(_uid uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _uid
      AND p.organization_id = _org
      AND ur.role::text IN ('corretor','admin','sub_admin','leader','developer')
  );
$$;

-- Policies --------------------------------------------------------------------
DROP POLICY IF EXISTS "leads_insert_org" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_v2" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "leads_select_org" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_select_v2" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "leads_update_org" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_update_v2" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their organization" ON public.leads;

CREATE POLICY "leads_insert_v2" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_leads_org_manager(auth.uid())
    OR broker_id IS NULL
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "leads_select_v2" ON public.leads
FOR SELECT TO authenticated
USING (
  public.is_member_of_org(organization_id) AND (
    public.is_leads_org_manager(auth.uid())
    OR broker_id = auth.uid()
    OR (created_by = auth.uid() AND broker_id IS NULL)
  )
);

CREATE POLICY "leads_update_v2" ON public.leads
FOR UPDATE TO authenticated
USING (
  public.is_member_of_org(organization_id) AND (
    public.is_leads_org_manager(auth.uid())
    OR broker_id = auth.uid()
    OR (created_by = auth.uid() AND broker_id IS NULL)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_leads_org_manager(auth.uid())
    OR broker_id = auth.uid()
    OR (broker_id IS NULL AND created_by = auth.uid())
  )
);

-- Trigger ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_lead_authorship_and_broker()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broker_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
  END IF;

  IF NEW.broker_id IS NOT NULL THEN
    SELECT organization_id INTO v_broker_org
    FROM public.profiles
    WHERE id = NEW.broker_id;

    IF v_broker_org IS NULL OR v_broker_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Broker does not belong to the lead organization'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT public.is_lead_eligible_responsible(NEW.broker_id, NEW.organization_id) THEN
      RAISE EXCEPTION 'Broker role is not eligible to be assigned as lead responsible'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_authorship_and_broker ON public.leads;
CREATE TRIGGER trg_protect_lead_authorship_and_broker
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.protect_lead_authorship_and_broker();