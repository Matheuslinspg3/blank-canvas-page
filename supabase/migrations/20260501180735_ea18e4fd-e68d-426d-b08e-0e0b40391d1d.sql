-- Create the internal unlimited plan (idempotent).
INSERT INTO public.subscription_plans (
  name, slug, description,
  price_monthly, price_yearly,
  max_own_properties, max_shared_properties, max_users, max_leads,
  marketplace_access, marketplace_views_limit,
  partnership_access, priority_support,
  features, is_active, display_order, plan_type, automation_allowance_brl
) VALUES (
  'Plano Interno Unlimited',
  'internal_unlimited',
  'Plano interno sem limites — atribuível somente por usuários com papel developer. Não público, não comprável.',
  0, 0,
  -1, -1, -1, -1,
  true, NULL,
  true, true,
  jsonb_build_object(
    'is_internal', true,
    'is_public', false,
    'is_purchasable', false,
    'max_custom_domains', -1,
    'max_marketplace_properties', -1,
    'max_storage_mb', -1,
    'ai_credits_limit', -1
  ),
  true,
  9999,
  'plan',
  0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_own_properties = -1,
  max_shared_properties = -1,
  max_users = -1,
  max_leads = -1,
  marketplace_access = true,
  features = COALESCE(public.subscription_plans.features, '{}'::jsonb)
    || jsonb_build_object(
      'is_internal', true,
      'is_public', false,
      'is_purchasable', false,
      'max_custom_domains', -1,
      'max_marketplace_properties', -1,
      'max_storage_mb', -1,
      'ai_credits_limit', -1
    ),
  is_active = true,
  plan_type = 'plan',
  display_order = 9999,
  updated_at = now();

-- Helper: returns true if the org currently uses the internal_unlimited plan.
CREATE OR REPLACE FUNCTION public.is_org_on_internal_unlimited(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.organization_id = _org_id
      AND p.slug = 'internal_unlimited'
      AND s.status IN ('active', 'trial')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_on_internal_unlimited(uuid) TO authenticated, anon;

-- Trigger: only developers may assign the internal_unlimited plan via SQL.
CREATE OR REPLACE FUNCTION public.guard_internal_unlimited_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_slug text;
  v_old_slug text;
BEGIN
  SELECT slug INTO v_target_slug
  FROM public.subscription_plans
  WHERE id = NEW.plan_id;

  IF v_target_slug IS DISTINCT FROM 'internal_unlimited' THEN
    RETURN NEW;
  END IF;

  -- Service role / migrations bypass.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- For UPDATE: allow if plan_id was already internal_unlimited (unrelated updates).
  IF TG_OP = 'UPDATE' THEN
    SELECT slug INTO v_old_slug
    FROM public.subscription_plans
    WHERE id = OLD.plan_id;
    IF v_old_slug = 'internal_unlimited' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT public.has_role(auth.uid(), 'developer'::public.app_role) THEN
    RAISE EXCEPTION 'Only developers can assign the internal_unlimited plan'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_internal_unlimited_ins ON public.subscriptions;
CREATE TRIGGER trg_guard_internal_unlimited_ins
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_internal_unlimited_assignment();

DROP TRIGGER IF EXISTS trg_guard_internal_unlimited_upd ON public.subscriptions;
CREATE TRIGGER trg_guard_internal_unlimited_upd
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_internal_unlimited_assignment();