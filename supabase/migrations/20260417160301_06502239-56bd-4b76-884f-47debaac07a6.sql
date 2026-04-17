-- Marketplace interest notification: cria notificação in-app para admins da org alvo
CREATE OR REPLACE FUNCTION public.notify_marketplace_interest(
  p_property_id uuid,
  p_consumer_name text DEFAULT NULL,
  p_consumer_phone text DEFAULT NULL,
  p_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_property_title text;
  v_property_code text;
  v_admin record;
  v_count int := 0;
  v_msg text;
BEGIN
  SELECT organization_id, title, external_code
    INTO v_org_id, v_property_title, v_property_code
  FROM properties
  WHERE id = p_property_id;

  IF v_org_id IS NULL THEN
    SELECT organization_id, title, external_code
      INTO v_org_id, v_property_title, v_property_code
    FROM marketplace_properties
    WHERE id = p_property_id;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'property_not_found');
  END IF;

  v_msg := COALESCE(p_message,
    'Um corretor demonstrou interesse no seu imóvel'
    || COALESCE(' "' || v_property_title || '"', '')
    || COALESCE(' (Cód: ' || v_property_code || ')', '')
    || '. Entre em contato para fechar a parceria.'
  );

  -- Notifica admin + sub_admin da org
  FOR v_admin IN
    SELECT DISTINCT pr.user_id
    FROM profiles pr
    JOIN user_roles ur ON ur.user_id = pr.user_id
    WHERE pr.organization_id = v_org_id
      AND ur.role IN ('admin', 'sub_admin')
  LOOP
    INSERT INTO notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
    VALUES (
      v_admin.user_id, v_org_id, 'marketplace_interest',
      'Novo interesse no Marketplace',
      v_msg, p_property_id, 'property'
    );
    v_count := v_count + 1;
  END LOOP;

  -- Registra também em marketplace_contact_intents para histórico
  INSERT INTO marketplace_contact_intents (
    organization_id, target_phone, contact_type, property_id,
    property_title, property_code, broker_name
  ) VALUES (
    v_org_id, NULL, 'org', p_property_id,
    v_property_title, v_property_code, p_consumer_name
  );

  RETURN jsonb_build_object('ok', true, 'notified', v_count, 'organization_id', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_marketplace_interest(uuid, text, text, text) TO anon, authenticated;