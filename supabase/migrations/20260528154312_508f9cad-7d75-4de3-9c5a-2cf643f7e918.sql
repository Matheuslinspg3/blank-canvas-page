CREATE OR REPLACE FUNCTION public.notify_lead_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
  v_message TEXT;
BEGIN
  -- Construir mensagem detalhada
  v_message := format('%s', COALESCE(NEW.name, 'Lead sem nome'));
  
  IF NEW.email IS NOT NULL THEN
    v_message := v_message || format(' (%s)', NEW.email);
  END IF;
  
  IF NEW.phone IS NOT NULL THEN
    v_message := v_message || format(' - %s', NEW.phone);
  END IF;

  IF NEW.source IS NOT NULL THEN
    v_message := v_message || format(' [Origem: %s]', NEW.source);
  END IF;

  -- Notify the assigned broker (lead_assigned event)
  IF NEW.broker_id IS NOT NULL THEN
    PERFORM public.dispatch_notification(
      NEW.broker_id,
      NEW.organization_id,
      'lead_assigned',
      'Novo lead atribuído a você',
      v_message,
      NEW.id,
      'lead'
    );
  END IF;

  -- Notify all admins/managers of the org (lead_created event)
  FOR admin_rec IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE p.organization_id = NEW.organization_id
      AND ur.role IN ('admin', 'manager', 'owner')
      AND (NEW.broker_id IS NULL OR ur.user_id <> NEW.broker_id)
  LOOP
    PERFORM public.dispatch_notification(
      admin_rec.user_id,
      NEW.organization_id,
      'lead_created',
      'Novo lead recebido',
      v_message,
      NEW.id,
      'lead'
    );
  END LOOP;

  RETURN NEW;
END;
$$;