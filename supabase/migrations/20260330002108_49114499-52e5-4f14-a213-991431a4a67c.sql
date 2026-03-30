-- Fix profiles_public view: use SECURITY INVOKER so RLS of querying user applies
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  p.id,
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.organization_id
FROM public.profiles p;

-- Grant access to authenticated users only
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
