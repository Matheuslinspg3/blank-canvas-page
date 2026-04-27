DO $$
DECLARE
  v_org uuid := 'cdf3f0e6-da64-4090-bc76-1758796bea28';
  v_targets int;
  v_updated int;
BEGIN
  CREATE TEMP TABLE _pcaicara_targets3 ON COMMIT DROP AS
  WITH primary_owner AS (
    SELECT DISTINCT ON (po.property_id)
      po.property_id, ow.phone
    FROM public.property_owners po
    JOIN public.owners ow ON ow.id = po.owner_id
    ORDER BY po.property_id, COALESCE(po.is_primary,false) DESC, po.created_at ASC
  )
  SELECT p.id AS property_id
  FROM public.properties p
  JOIN primary_owner po ON po.property_id = p.id
  WHERE p.organization_id = v_org
    AND p.marketplace_contact_phone_source = 'organization'
    AND length(regexp_replace(coalesce(po.phone,''), '\D','','g')) >= 10;

  SELECT COUNT(*) INTO v_targets FROM _pcaicara_targets3;
  RAISE NOTICE '[BACKFILL3] Targets=%', v_targets;

  UPDATE public.properties p
     SET marketplace_contact_phone_source = 'owner'
    FROM _pcaicara_targets3 t
   WHERE p.id = t.property_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Espelhamento defensivo nos casos que tenham linha em marketplace_properties
  UPDATE public.marketplace_properties mp
     SET marketplace_contact_phone_source = 'owner',
         marketplace_contact_phone = NULL
    FROM _pcaicara_targets3 t
   WHERE mp.id = t.property_id
     AND (mp.marketplace_contact_phone_source IS DISTINCT FROM 'owner'
          OR mp.marketplace_contact_phone IS NOT NULL);

  RAISE NOTICE '[BACKFILL3] updated_props=%', v_updated;

  IF v_updated <> v_targets THEN
    RAISE EXCEPTION 'ROLLBACK: updated (%) != targets (%)', v_updated, v_targets;
  END IF;
END $$;