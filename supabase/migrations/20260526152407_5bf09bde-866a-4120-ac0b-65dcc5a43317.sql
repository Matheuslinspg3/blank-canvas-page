
-- whatsapp_agent_config: restrict SELECT to managers/admins
DROP POLICY IF EXISTS "Users can view own org config" ON public.whatsapp_agent_config;
CREATE POLICY "Managers can view own org config"
ON public.whatsapp_agent_config
FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

-- channel_account_credentials: split ALL into per-command, restrict SELECT to managers
DROP POLICY IF EXISTS "Org members can manage credentials" ON public.channel_account_credentials;

CREATE POLICY "Managers can view org credentials"
ON public.channel_account_credentials
FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

CREATE POLICY "Org members can insert credentials"
ON public.channel_account_credentials
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org members can update credentials"
ON public.channel_account_credentials
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org members can delete credentials"
ON public.channel_account_credentials
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id());

-- broker_whatsapp_channels: broker sees own row; managers/admins see all org rows
DROP POLICY IF EXISTS "broker_channel_select" ON public.broker_whatsapp_channels;
CREATE POLICY "broker_channel_select"
ON public.broker_whatsapp_channels
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()))
);
