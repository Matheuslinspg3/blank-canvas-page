
CREATE OR REPLACE FUNCTION public.dev_save_draft_v2(p_org_id uuid, p_layout jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE site_documents
  SET draft_v2 = p_layout
  WHERE organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.dev_set_editor_mode(p_org_id uuid, p_mode text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE site_documents
  SET editor_mode = p_mode
  WHERE organization_id = p_org_id;
$$;
