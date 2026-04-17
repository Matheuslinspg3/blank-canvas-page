-- Public RPC to fetch invite data for the acceptance page (no RLS conflict)
-- Returns minimal, non-sensitive fields. Email is returned only to allow the
-- frontend to validate that the invitee is opening the right link.
CREATE OR REPLACE FUNCTION public.get_invite_for_acceptance(p_invite_id uuid)
RETURNS TABLE (
  id uuid,
  role text,
  organization_id uuid,
  status text,
  expires_at timestamptz,
  email text,
  org_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.id,
    oi.role::text,
    oi.organization_id,
    oi.status::text,
    oi.expires_at,
    oi.email,
    o.name::text AS org_name
  FROM public.organization_invites oi
  JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.id = p_invite_id
  LIMIT 1;
$$;

-- Allow anyone (anon + authenticated) to call it; it only exposes one row by exact UUID
GRANT EXECUTE ON FUNCTION public.get_invite_for_acceptance(uuid) TO anon, authenticated;

-- Cleanup duplicate DELETE policy (keep the more permissive one)
DROP POLICY IF EXISTS "Admins can delete invites" ON public.organization_invites;