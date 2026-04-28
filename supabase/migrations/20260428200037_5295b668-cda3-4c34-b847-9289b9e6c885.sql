-- Fix RLS policies for public.transactions
-- Add sub_admin to managers; keep delete restricted to admin/developer

DROP POLICY IF EXISTS "Managers can view transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Managers can update transactions in their organization" ON public.transactions;

CREATE POLICY "Managers can view transactions in their organization"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

CREATE POLICY "Managers can create transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update transactions in their organization"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);