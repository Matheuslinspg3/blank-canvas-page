## Final consolidated fix — production RLS 42501 on `POST /rest/v1/leads`

I'm currently in plan mode (read-only) so writes were blocked. Approving this plan switches me to default mode and I will execute the steps below in this exact order.

### Pre-flight evidence already collected (read-only)

`pg_policies` for `public.leads` confirms:
- Legacy permissive policies still present: `Users can create leads`, `Users can view leads based on role`, `Users can update leads based on role`.
- Maintenance policies present and **PERMISSIVE** (not RESTRICTIVE): `Block inserts during maintenance`, `Block updates during maintenance`, `Block deletes during maintenance`.
- v2 policies present: `leads_insert_v2`, `leads_select_v2`, `leads_update_v2`. Manager DELETE policy (`Managers can delete leads`) preserved.

`pg_proc` for the helpers confirms:
- `is_lead_eligible_responsible(_uid, _org)` joins `user_roles ur ON ur.user_id = p.id` and filters `p.id = _uid` — bug: `_uid` is an auth user id, must match `p.user_id`.
- `protect_lead_authorship_and_broker` does `SELECT organization_id FROM profiles WHERE id = NEW.broker_id` — same bug.
- `is_leads_org_manager(_uid)` is correct (filters `user_roles.user_id = _uid`); will keep as-is.

### Step 1 — Create new migration

`supabase/migrations/<timestamp>_fix_leads_rls_dedup_restrictive_profile_lookup.sql`

```sql
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
  ON public.leads AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance"
  ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked())
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance"
  ON public.leads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- 3) Fix is_lead_eligible_responsible — lookup by profiles.user_id (auth uid)
CREATE OR REPLACE FUNCTION public.is_lead_eligible_responsible(_uid uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_broker_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
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

-- 5) Verification — fail migration if anything is off
DO $$
DECLARE
  r record;
  legacy_cnt int;
  maintenance_cnt int;
BEGIN
  SELECT count(*) INTO legacy_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='leads'
     AND policyname IN ('Users can create leads',
                        'Users can view leads based on role',
                        'Users can update leads based on role');
  IF legacy_cnt <> 0 THEN
    RAISE EXCEPTION 'Legacy policies still present on public.leads (% remaining)', legacy_cnt;
  END IF;

  SELECT count(*) INTO maintenance_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='leads'
     AND policyname IN ('Block inserts during maintenance',
                        'Block updates during maintenance',
                        'Block deletes during maintenance');
  IF maintenance_cnt <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 maintenance policies on public.leads, found %', maintenance_cnt;
  END IF;

  FOR r IN SELECT policyname, permissive FROM pg_policies
            WHERE schemaname='public' AND tablename='leads'
              AND policyname IN ('Block inserts during maintenance',
                                 'Block updates during maintenance',
                                 'Block deletes during maintenance')
  LOOP
    IF r.permissive <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION 'Maintenance policy % is not RESTRICTIVE (got %)', r.policyname, r.permissive;
    END IF;
  END LOOP;
END $$;

COMMIT;
```

### Step 2 — Edit `src/hooks/useLeadCRUD.ts` (only error toasts/logs)

In `createLead.onError` and `updateLead.onError` blocks (lines ~195–209 and ~230–237):

- New copy when `isRlsError(error)` is true:
  *"Não foi possível salvar o lead por falta de permissão ou organização inválida. Atualize a página e tente novamente."*
- Enhanced `console.error` payload (no PII):
  ```ts
  console.error('[leads] RLS denied', {
    mutation: 'createLead' | 'updateLead',
    table: 'leads',
    operation: 'insert' | 'update',
    code: error?.code,
    status: error?.status,
    hint: error?.hint,
    orgId: profile?.organization_id,
    userId: user?.id,
  });
  ```
No other behavior changes; gates by role and trigger preservation remain intact.

### Step 3 — Validation (ran after migration applies)

1. `supabase--read_query` →
   ```sql
   SELECT policyname, permissive, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename='leads' ORDER BY policyname;
   ```
   Expect: `Block …` rows show `permissive='RESTRICTIVE'`; no `Users can …` rows; v2 + Managers delete preserved.
2. `supabase--read_query` → eligibility check using a real broker user id from `user_roles` (role='corretor') and their `profiles.organization_id`:
   ```sql
   SELECT public.is_lead_eligible_responsible(<auth_uid>, <org_id>);
   ```
   Expect `true`.
3. `supabase--linter` — confirm no new errors on `public.leads` policies/functions.
4. `npx tsc --noEmit` — expect clean.
5. `npx vite build` — expect clean.

### Out of scope (will NOT touch)

- `src/components/crm/KanbanBoard.tsx`
- Edge function `website-lead` (uses service_role, bypasses RLS)
- Schema of `public.leads`
- Multi-tenant helpers (`is_member_of_org`, `get_user_organization_id`, `is_leads_org_manager`)
- No new permissive policy will be created

### Deliverables I will return after execution

1. Final migration SQL (as applied).
2. Diff of `src/hooks/useLeadCRUD.ts`.
3. `pg_policies` output for `public.leads` post-migration.
4. Result of `is_lead_eligible_responsible(<real corretor uid>, <org>)`.
5. `npx tsc --noEmit` output.
6. `npx vite build` output.
7. `supabase--linter` output.

Approve this plan to switch out of plan mode so I can write the migration file, edit `useLeadCRUD.ts`, and run the validations.