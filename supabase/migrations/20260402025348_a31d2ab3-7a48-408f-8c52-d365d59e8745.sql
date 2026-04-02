CREATE OR REPLACE FUNCTION public.fn_auto_create_lead_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_create boolean;
  v_existing_lead_id uuid;
  v_normalized_phone text;
  v_stage_id uuid;
  v_created_by uuid;
  v_phone_raw text;
BEGIN
  IF NEW.from_me = true OR NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;

  SELECT auto_create_leads INTO v_auto_create
  FROM whatsapp_agent_config
  WHERE organization_id = NEW.organization_id
  LIMIT 1;

  IF v_auto_create IS NOT true THEN
    RETURN NEW;
  END IF;

  v_phone_raw := regexp_replace(NEW.remote_jid, '@.*$', '');
  v_normalized_phone := regexp_replace(v_phone_raw, '\D', '', 'g');

  IF length(v_normalized_phone) < 8 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_lead_id
  FROM leads
  WHERE organization_id = NEW.organization_id
    AND is_active = true
    AND phone IS NOT NULL
    AND right(regexp_replace(phone, '\D', '', 'g'), 8) = right(v_normalized_phone, 8)
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    UPDATE leads SET updated_at = now() WHERE id = v_existing_lead_id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_stage_id
  FROM lead_stages
  WHERE organization_id = NEW.organization_id
  ORDER BY position ASC
  LIMIT 1;

  SELECT id INTO v_created_by
  FROM profiles
  WHERE organization_id = NEW.organization_id
  LIMIT 1;

  IF v_created_by IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO leads (
    organization_id, created_by, name, phone, source,
    temperature, stage, lead_stage_id, notes
  ) VALUES (
    NEW.organization_id, v_created_by,
    'WhatsApp ' || v_phone_raw, v_phone_raw,
    'whatsapp', 'morno', 'novo', v_stage_id,
    '[Auto] Lead criado automaticamente a partir de conversa no WhatsApp.'
  );

  RETURN NEW;
END;
$$;