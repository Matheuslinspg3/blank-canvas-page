DROP POLICY "Admins can update ad_settings" ON public.ad_settings;

CREATE POLICY "Admins can update ad_settings"
ON public.ad_settings FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())))
WITH CHECK (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())));