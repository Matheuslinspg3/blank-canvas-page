DROP VIEW IF EXISTS public.vw_marketplace_orgs_missing_contact;

CREATE VIEW public.vw_marketplace_orgs_missing_contact
WITH (security_invoker = true) AS
SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.phone AS org_phone,
  COUNT(mp.id) AS marketplace_properties_count,
  EXISTS (SELECT 1 FROM profiles p WHERE p.organization_id = o.id AND p.phone IS NOT NULL) AS has_profile_with_phone
FROM organizations o
JOIN marketplace_properties mp ON mp.organization_id = o.id
WHERE (o.phone IS NULL OR length(btrim(o.phone)) < 10)
GROUP BY o.id, o.name, o.phone;

GRANT SELECT ON public.vw_marketplace_orgs_missing_contact TO authenticated;