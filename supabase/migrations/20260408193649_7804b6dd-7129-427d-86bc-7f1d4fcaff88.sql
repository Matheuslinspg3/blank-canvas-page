
CREATE OR REPLACE FUNCTION public.dev_force_publish_v2(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE site_documents 
  SET published_v2 = draft_v2, 
      last_published_at = now()
  WHERE organization_id = p_org_id 
    AND draft_v2 IS NOT NULL;
$$;
