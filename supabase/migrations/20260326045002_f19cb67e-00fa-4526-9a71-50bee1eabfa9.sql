CREATE OR REPLACE FUNCTION public.delete_property_cascade(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM property_images WHERE property_id = p_property_id;
  DELETE FROM property_media WHERE property_id = p_property_id;
  DELETE FROM property_owners WHERE property_id = p_property_id;
  DELETE FROM property_visibility WHERE property_id = p_property_id;
  DELETE FROM property_partnerships WHERE property_id = p_property_id;
  DELETE FROM property_landing_content WHERE property_id = p_property_id;
  DELETE FROM import_run_items WHERE property_id = p_property_id;
  DELETE FROM marketplace_contact_access WHERE marketplace_property_id = p_property_id;
  DELETE FROM marketplace_properties WHERE id = p_property_id;
  DELETE FROM generated_arts WHERE property_id = p_property_id;
  DELETE FROM anuncios_gerados WHERE property_id = p_property_id;
  DELETE FROM property_visits WHERE property_id = p_property_id;

  UPDATE leads SET property_id = NULL WHERE property_id = p_property_id;
  UPDATE contracts SET property_id = NULL WHERE property_id = p_property_id;
  UPDATE appointments SET property_id = NULL WHERE property_id = p_property_id;

  DELETE FROM properties WHERE id = p_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_property_cascade(uuid) TO authenticated;