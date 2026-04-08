CREATE OR REPLACE FUNCTION public.dev_save_draft_v2(p_org_id uuid, p_layout jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO site_documents (organization_id, editor_mode)
  VALUES (p_org_id, 'simple')
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE site_documents SET draft_v2 = p_layout WHERE organization_id = p_org_id;
END;
$$;