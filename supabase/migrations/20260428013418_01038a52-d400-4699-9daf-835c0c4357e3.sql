-- Fix production RLS error 42501 on POST /rest/v1/leads
BEGIN;

-- 1) Drop legacy permissive policies that conflict with v2
DROP POLICY IF EXISTS "Users can create leads"               ON public.leads;
DROP POLICY IF EXISTS "Users can view leads based on role"   ON public.leads;
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;

-- 2) Recreate maintenance blocks as RESTRICTIVE (AND-combined)
DROP POLICY IF EXISTS "Block inserts during maintenance" ON public.leads;
DROP POLICY IF EXISTS "Block updates during maintenance" ON public.leads;
DROP POLICY IF EXISTS "Block deletes during maintenance" ON public.leads;

CREATE POLICY "Block inserts during maintenance"
  ON public.leads
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance"
  ON public.leads
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT public.is_maintenance_blocked())
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance"
  ON public.leads
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- 3) Fix is_lead_eligible_responsible: lookup by profiles.user_id (auth uid)
CREATE OR REPLACE FUNCTION public.is_lead_eligible_responsible(_uid uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id = _uid
      AND p.organization_id = _org
      AND ur.role::text IN ('corretor','admin','sub_admin','leader','developer')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_lead_eligible_responsible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_lead_eligible_responsible(uuid, uuid) TO authenticated;

-- 4) Fix trigger to look up broker by profiles.user_id
CREATE OR REPLACE FUNCTION public.protect_lead_authorship_and_broker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_broker_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    -- created_by is immutable
    NEW.created_by := OLD.created_by;

    -- Only managers can change broker_id (transfer / assign / unassign)
    IF NEW.broker_id IS DISTINCT FROM OLD.broker_id
       AND auth.uid() IS NOT NULL
       AND NOT public.is_leads_org_manager(auth.uid())
    THEN
      RAISE EXCEPTION 'Only organization managers can change lead responsible'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.broker_id IS NOT NULL THEN
    SELECT organization_id INTO v_broker_org
    FROM public.profiles
    WHERE user_id = NEW.broker_id;

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
$function$;

-- 5) Verification — fail the migration if anything is off
DO $$
DECLARE
  r record;
  legacy_cnt int;
  maintenance_cnt int;
BEGIN
  SELECT count(*) INTO legacy_cnt
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='leads'
    AND policyname IN (
      'Users can create leads',
      'Users can view leads based on role',
      'Users can update leads based on role'
    );
  IF legacy_cnt <> 0 THEN
    RAISE EXCEPTION 'Legacy policies still present on public.leads (% remaining)', legacy_cnt;
  END IF;

  SELECT count(*) INTO maintenance_cnt
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='leads'
    AND policyname IN (
      'Block inserts during maintenance',
      'Block updates during maintenance',
      'Block deletes during maintenance'
    );
  IF maintenance_cnt <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 maintenance policies on public.leads, found %', maintenance_cnt;
  END IF;

  FOR r IN
    SELECT policyname, permissive
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='leads'
      AND policyname IN (
        'Block inserts during maintenance',
        'Block updates during maintenance',
        'Block deletes during maintenance'
      )
  LOOP
    IF r.permissive <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION 'Maintenance policy % is not RESTRICTIVE (got %)', r.policyname, r.permissive;
    END IF;
  END LOOP;
END $$;

COMMIT;