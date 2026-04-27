DO $$
DECLARE
  v_org uuid := 'cdf3f0e6-da64-4090-bc76-1758796bea28';
  v_targets int;
  v_updated_props int;
  v_updated_mp int;
  v_from_org int;
  v_from_custom int;
  v_already_owner int;
  v_remaining_not_owner int;
  v_desync int;
  v_leftover_phone_props int;
  v_leftover_phone_mp int;
  r record;
BEGIN
  CREATE TEMP TABLE _pcaicara_targets ON COMMIT DROP AS
  WITH primary_owner AS (
    SELECT DISTINCT ON (po.property_id)
      po.property_id, ow.phone, ow.primary_name
    FROM public.property_owners po
    JOIN public.owners ow ON ow.id = po.owner_id
    ORDER BY po.property_id,
             COALESCE(po.is_primary,false) DESC,
             po.created_at ASC
  )
  SELECT p.id AS property_id,
         p.title,
         p.marketplace_contact_phone_source AS old_source,
         p.marketplace_contact_phone        AS old_custom_phone,
         po.phone                           AS owner_phone,
         po.primary_name                    AS owner_name
  FROM public.properties p
  JOIN public.marketplace_properties mp ON mp.id = p.id
  JOIN primary_owner po ON po.property_id = p.id
  WHERE p.organization_id = v_org
    AND length(regexp_replace(coalesce(po.phone,''), '\D','','g')) >= 10;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE old_source = 'organization'),
         COUNT(*) FILTER (WHERE old_source = 'custom'),
         COUNT(*) FILTER (WHERE old_source = 'owner')
    INTO v_targets, v_from_org, v_from_custom, v_already_owner
  FROM _pcaicara_targets;

  RAISE NOTICE '[BACKFILL] Targets=% (org->%, custom->%, ja owner=%)',
    v_targets, v_from_org, v_from_custom, v_already_owner;

  -- 1) UPDATE properties (trigger de sanitizacao zera marketplace_contact_phone)
  UPDATE public.properties p
     SET marketplace_contact_phone_source = 'owner'
    FROM _pcaicara_targets t
   WHERE p.id = t.property_id;
  GET DIAGNOSTICS v_updated_props = ROW_COUNT;

  -- 2) UPDATE espelhado em marketplace_properties (defesa em profundidade)
  UPDATE public.marketplace_properties mp
     SET marketplace_contact_phone_source = 'owner',
         marketplace_contact_phone = NULL
    FROM _pcaicara_targets t
   WHERE mp.id = t.property_id
     AND (mp.marketplace_contact_phone_source IS DISTINCT FROM 'owner'
          OR mp.marketplace_contact_phone IS NOT NULL);
  GET DIAGNOSTICS v_updated_mp = ROW_COUNT;

  -- Verificacoes
  SELECT COUNT(*) INTO v_remaining_not_owner
  FROM public.properties p
  JOIN _pcaicara_targets t ON t.property_id = p.id
  WHERE p.marketplace_contact_phone_source <> 'owner';

  SELECT COUNT(*) INTO v_desync
  FROM public.properties p
  JOIN public.marketplace_properties mp ON mp.id = p.id
  JOIN _pcaicara_targets t ON t.property_id = p.id
  WHERE p.marketplace_contact_phone_source IS DISTINCT FROM mp.marketplace_contact_phone_source;

  SELECT COUNT(*) INTO v_leftover_phone_props
  FROM public.properties p
  JOIN _pcaicara_targets t ON t.property_id = p.id
  WHERE p.marketplace_contact_phone IS NOT NULL;

  SELECT COUNT(*) INTO v_leftover_phone_mp
  FROM public.marketplace_properties mp
  JOIN _pcaicara_targets t ON t.property_id = mp.id
  WHERE mp.marketplace_contact_phone IS NOT NULL;

  RAISE NOTICE '[BACKFILL] updated_props=%, updated_mp=%, remaining_not_owner=%, desync=%, leftover_props=%, leftover_mp=%',
    v_updated_props, v_updated_mp, v_remaining_not_owner, v_desync,
    v_leftover_phone_props, v_leftover_phone_mp;

  -- Amostra de 5 atualizados (dentro do DO porque a temp table morre no COMMIT)
  RAISE NOTICE '[BACKFILL] Amostra de 5 atualizados:';
  FOR r IN
    SELECT t.property_id, t.title, t.old_source, t.owner_name, t.owner_phone,
           p.marketplace_contact_phone_source AS new_source,
           p.marketplace_contact_phone AS new_custom_phone
      FROM _pcaicara_targets t
      JOIN public.properties p ON p.id = t.property_id
      ORDER BY t.title NULLS LAST, t.property_id
      LIMIT 5
  LOOP
    RAISE NOTICE '  - id=% | title=% | old=% -> new=% | owner=% | owner_phone=% | new_custom=%',
      r.property_id, r.title, r.old_source, r.new_source, r.owner_name, r.owner_phone, r.new_custom_phone;
  END LOOP;

  -- Criterios de commit
  IF v_updated_props <> v_targets THEN
    RAISE EXCEPTION 'ROLLBACK: updated_props (%) != targets (%)', v_updated_props, v_targets;
  END IF;
  IF v_remaining_not_owner <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % alvos nao ficaram com source=owner', v_remaining_not_owner;
  END IF;
  IF v_desync <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: desync properties<->marketplace_properties = %', v_desync;
  END IF;
  IF v_leftover_phone_props <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: properties.marketplace_contact_phone ainda preenchido em % atualizados', v_leftover_phone_props;
  END IF;
  IF v_leftover_phone_mp <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: marketplace_properties.marketplace_contact_phone ainda preenchido em % atualizados', v_leftover_phone_mp;
  END IF;
END $$;