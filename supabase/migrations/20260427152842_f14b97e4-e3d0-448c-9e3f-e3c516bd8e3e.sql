DO $$
DECLARE
  v_org uuid := 'cdf3f0e6-da64-4090-bc76-1758796bea28';
  v_targets int;
  v_updated_props int;
  v_updated_mp int;
  v_desync int;
  v_leftover_phone_props int;
  v_leftover_phone_mp int;
  v_remaining_org int;
BEGIN
  CREATE TEMP TABLE _pcaicara_targets2 ON COMMIT DROP AS
  WITH primary_owner AS (
    SELECT DISTINCT ON (po.property_id)
      po.property_id, ow.phone, ow.primary_name
    FROM public.property_owners po
    JOIN public.owners ow ON ow.id = po.owner_id
    ORDER BY po.property_id,
             COALESCE(po.is_primary,false) DESC,
             po.created_at ASC
  )
  SELECT p.id AS property_id, p.title, po.phone AS owner_phone, po.primary_name AS owner_name
  FROM public.properties p
  JOIN public.marketplace_properties mp ON mp.id = p.id
  JOIN primary_owner po ON po.property_id = p.id
  WHERE p.organization_id = v_org
    AND p.marketplace_contact_phone_source = 'organization'
    AND length(regexp_replace(coalesce(po.phone,''), '\D','','g')) >= 10;

  SELECT COUNT(*) INTO v_targets FROM _pcaicara_targets2;
  RAISE NOTICE '[BACKFILL2] Targets=%', v_targets;

  UPDATE public.properties p
     SET marketplace_contact_phone_source = 'owner'
    FROM _pcaicara_targets2 t
   WHERE p.id = t.property_id;
  GET DIAGNOSTICS v_updated_props = ROW_COUNT;

  UPDATE public.marketplace_properties mp
     SET marketplace_contact_phone_source = 'owner',
         marketplace_contact_phone = NULL
    FROM _pcaicara_targets2 t
   WHERE mp.id = t.property_id
     AND (mp.marketplace_contact_phone_source IS DISTINCT FROM 'owner'
          OR mp.marketplace_contact_phone IS NOT NULL);
  GET DIAGNOSTICS v_updated_mp = ROW_COUNT;

  SELECT COUNT(*) INTO v_desync
  FROM public.properties p
  JOIN public.marketplace_properties mp ON mp.id = p.id
  WHERE p.organization_id = v_org
    AND p.marketplace_contact_phone_source IS DISTINCT FROM mp.marketplace_contact_phone_source;

  SELECT COUNT(*) INTO v_leftover_phone_props
  FROM public.properties p
  JOIN _pcaicara_targets2 t ON t.property_id = p.id
  WHERE p.marketplace_contact_phone IS NOT NULL;

  SELECT COUNT(*) INTO v_leftover_phone_mp
  FROM public.marketplace_properties mp
  JOIN _pcaicara_targets2 t ON t.property_id = mp.id
  WHERE mp.marketplace_contact_phone IS NOT NULL;

  SELECT COUNT(*) INTO v_remaining_org
  FROM public.properties
  WHERE organization_id = v_org
    AND marketplace_contact_phone_source = 'organization';

  RAISE NOTICE '[BACKFILL2] updated_props=%, updated_mp=%, desync=%, leftover_props=%, leftover_mp=%, remaining_org=%',
    v_updated_props, v_updated_mp, v_desync, v_leftover_phone_props, v_leftover_phone_mp, v_remaining_org;

  IF v_updated_props <> v_targets THEN
    RAISE EXCEPTION 'ROLLBACK: updated_props (%) != targets (%)', v_updated_props, v_targets;
  END IF;
  IF v_desync <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: desync = %', v_desync;
  END IF;
  IF v_leftover_phone_props <> 0 OR v_leftover_phone_mp <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: leftover phone props=%, mp=%', v_leftover_phone_props, v_leftover_phone_mp;
  END IF;
END $$;