-- Fix remaining warnings

-- Restrict ai_billing_config to system admins only (protect stripe_webhook_secret)
DROP POLICY IF EXISTS "Developers can manage billing config" ON public.ai_billing_config;
DROP POLICY IF EXISTS "Admins and developers can read billing config" ON public.ai_billing_config;
DROP POLICY IF EXISTS "Admins and developers can update billing config" ON public.ai_billing_config;
DROP POLICY IF EXISTS "Admins and developers can insert billing config" ON public.ai_billing_config;

-- Check existing policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'ai_billing_config' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_billing_config', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "System admins can read billing config"
ON public.ai_billing_config FOR SELECT TO authenticated
USING (is_system_admin());

CREATE POLICY "System admins can update billing config"
ON public.ai_billing_config FOR UPDATE TO authenticated
USING (is_system_admin()) WITH CHECK (is_system_admin());

CREATE POLICY "System admins can insert billing config"
ON public.ai_billing_config FOR INSERT TO authenticated
WITH CHECK (is_system_admin());

-- Restrict ticket_messages to ticket owner + admins
DROP POLICY IF EXISTS "Users can view messages from their org tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can view ticket messages" ON public.ticket_messages;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'ticket_messages' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ticket_messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view own ticket messages or admins"
ON public.ticket_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_messages.ticket_id
    AND (st.user_id = auth.uid() OR is_org_admin(auth.uid()))
  )
);

-- Mark marketplace_properties_public view as accepted (intentional SECURITY DEFINER for PII isolation)
COMMENT ON VIEW public.marketplace_properties_public IS 'SECURITY DEFINER view intentional: isolates owner PII from cross-org access while allowing marketplace browsing';