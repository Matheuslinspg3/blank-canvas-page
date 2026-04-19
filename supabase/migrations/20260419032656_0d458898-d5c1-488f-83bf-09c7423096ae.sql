CREATE OR REPLACE FUNCTION public.trg_enqueue_voice_call_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
  e164 text;
  recent_call_count int;
BEGIN
  IF NEW.phone IS NULL OR NEW.is_active = false OR NEW.consent_voice_call = false THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=% phone=% active=% consent=%',
      NEW.id, NEW.organization_id,
      CASE
        WHEN NEW.phone IS NULL THEN 'no_phone'
        WHEN NEW.is_active = false THEN 'inactive'
        ELSE 'no_consent'
      END,
      (NEW.phone IS NOT NULL), NEW.is_active, NEW.consent_voice_call;
    RETURN NEW;
  END IF;

  e164 := public.normalize_phone_br_e164(NEW.phone);
  IF e164 IS NULL THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=invalid_phone raw=%', NEW.id, NEW.organization_id, NEW.phone;
    RETURN NEW;
  END IF;

  SELECT enabled, auto_outbound_enabled, agent_id, retell_from_number
    INTO cfg
    FROM public.retell_agent_config
   WHERE organization_id = NEW.organization_id
   LIMIT 1;

  IF cfg IS NULL THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=config_not_found', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  IF cfg.enabled = false THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=integration_disabled', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  IF cfg.auto_outbound_enabled = false THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=auto_outbound_disabled', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  IF cfg.agent_id IS NULL OR cfg.agent_id = '' THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=missing_agent_id', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  IF cfg.retell_from_number IS NULL OR cfg.retell_from_number = '' THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=missing_from_number', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_call_count
    FROM public.voice_calls
   WHERE lead_id = NEW.id
     AND created_at > now() - interval '24 hours';

  IF recent_call_count > 0 THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=recent_call_exists count=%', NEW.id, NEW.organization_id, recent_call_count;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.voice_call_queue WHERE lead_id = NEW.id AND status IN ('pending','calling')) THEN
    RAISE LOG 'retell.enqueue skipped lead=% org=% reason=already_queued', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.voice_call_queue (organization_id, lead_id, phone_e164, metadata)
  VALUES (
    NEW.organization_id,
    NEW.id,
    e164,
    jsonb_build_object('source', NEW.source, 'lead_name', NEW.name)
  );

  RAISE LOG 'retell.enqueue ok lead=% org=% e164=% source=%', NEW.id, NEW.organization_id, e164, NEW.source;

  RETURN NEW;
END;
$$;