CREATE OR REPLACE FUNCTION public.dev_list_org_rollout_status()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  editor_mode text,
  has_published_v1 boolean,
  has_draft_v2 boolean,
  has_published_v2 boolean,
  site_template text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name::text,
    COALESCE(sd.editor_mode, 'simple')::text,
    (sd.published IS NOT NULL),
    (sd.draft_v2 IS NOT NULL),
    (sd.published_v2 IS NOT NULL),
    ws.site_template::text
  FROM organizations o
  LEFT JOIN site_documents sd ON sd.organization_id = o.id
  LEFT JOIN website_settings ws ON ws.organization_id = o.id
  ORDER BY o.name;
$$;