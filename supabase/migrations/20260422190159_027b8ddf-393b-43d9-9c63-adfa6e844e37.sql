-- Add INSERT and UPDATE policies for authenticated users on follow_up_queue
CREATE POLICY "Users can insert followup items for own org"
ON public.follow_up_queue
FOR INSERT
TO authenticated
WITH CHECK (org_id = get_user_organization_id());

CREATE POLICY "Users can update followup items for own org"
ON public.follow_up_queue
FOR UPDATE
TO authenticated
USING (org_id = get_user_organization_id())
WITH CHECK (org_id = get_user_organization_id());