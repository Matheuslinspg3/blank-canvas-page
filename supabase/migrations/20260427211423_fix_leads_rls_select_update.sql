-- Fix: leads INSERT returning 42501/403 for corretor/assistente roles
--
-- Root cause: PostgREST INSERT + .select() requires both the INSERT WITH CHECK
-- and the SELECT USING policy to pass for the new row. The current SELECT
-- policy only allows corretor/assistente to see leads where broker_id =
-- auth.uid(). When a corretor creates a lead without setting broker_id, the
-- INSERT succeeds but the implicit returning SELECT fails, raising the generic
-- "new row violates row-level security policy" error.

-- 1. Tighten INSERT: organization_id must match AND created_by = auth.uid()
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
CREATE POLICY "Users can create leads"
ON public.leads
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND created_by = auth.uid()
);

-- 2. SELECT — corretor/assistente see own broker leads OR self-created with no broker yet
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
USING (
  is_member_of_org(organization_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR broker_id = auth.uid()
    OR (created_by = auth.uid() AND broker_id IS NULL)
  )
);

-- 3. UPDATE — same visibility model + WITH CHECK preventing org change
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;
CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
USING (
  is_member_of_org(organization_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR broker_id = auth.uid()
    OR (created_by = auth.uid() AND broker_id IS NULL)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
);

-- 4. Trigger: protect created_by from spoofing on UPDATE and validate broker org
CREATE OR REPLACE FUNCTION public.protect_lead_authorship_and_broker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_broker_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  IF NEW.broker_id IS NOT NULL THEN
    SELECT organization_id INTO v_broker_org
    FROM public.profiles
    WHERE user_id = NEW.broker_id
    LIMIT 1;

    IF v_broker_org IS NULL THEN
      RAISE EXCEPTION 'broker_id % does not match a known profile', NEW.broker_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_broker_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'broker_id % belongs to a different organization', NEW.broker_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_protect_lead_authorship_and_broker ON public.leads;
CREATE TRIGGER trg_protect_lead_authorship_and_broker
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.protect_lead_authorship_and_broker();
