-- Create a safe view for ad_accounts that hides auth_payload
CREATE OR REPLACE VIEW public.ad_accounts_safe
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id,
  organization_id,
  provider,
  external_account_id,
  name,
  is_active,
  status,
  created_at,
  updated_at,
  (auth_payload IS NOT NULL) AS is_connected
FROM public.ad_accounts;

GRANT SELECT ON public.ad_accounts_safe TO authenticated;
REVOKE ALL ON public.ad_accounts_safe FROM anon;

-- Tighten the SELECT policy on ad_accounts to admin only (not all managers)
-- First drop existing select policy
DROP POLICY IF EXISTS "Org managers can view ad accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "Org members can view ad accounts" ON public.ad_accounts;

-- Recreate with admin-only access for raw table (edge functions use service role anyway)
CREATE POLICY "Only admins can select ad_accounts directly"
ON public.ad_accounts
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.has_role(auth.uid(), 'admin')
);
