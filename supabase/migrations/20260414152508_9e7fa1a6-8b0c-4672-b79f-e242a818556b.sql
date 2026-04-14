
-- Drop broken policies
DROP POLICY IF EXISTS "Org members can view welcome messages" ON public.whatsapp_welcome_messages;
DROP POLICY IF EXISTS "Org members can insert welcome messages" ON public.whatsapp_welcome_messages;
DROP POLICY IF EXISTS "Org members can update welcome messages" ON public.whatsapp_welcome_messages;
DROP POLICY IF EXISTS "Org members can delete welcome messages" ON public.whatsapp_welcome_messages;

-- Recreate with correct user resolution
CREATE POLICY "Org members can view welcome messages"
  ON public.whatsapp_welcome_messages FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org members can insert welcome messages"
  ON public.whatsapp_welcome_messages FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org members can update welcome messages"
  ON public.whatsapp_welcome_messages FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org members can delete welcome messages"
  ON public.whatsapp_welcome_messages FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());
