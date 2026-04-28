-- Filter removed members out of profiles_public so UI selects (broker assignment, etc.)
-- never show "ghost" entries that were removed from the organization.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=true)
AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  organization_id
FROM public.profiles
WHERE removed_at IS NULL
  AND organization_id IS NOT NULL;