CREATE OR REPLACE FUNCTION public.protect_lead_authorship_and_broker()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broker_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    -- created_by é imutável
    NEW.created_by := OLD.created_by;

    -- Apenas gestores podem alterar broker_id (transferir, atribuir ou desatribuir)
    IF NEW.broker_id IS DISTINCT FROM OLD.broker_id
       AND auth.uid() IS NOT NULL
       AND NOT public.is_leads_org_manager(auth.uid())
    THEN
      RAISE EXCEPTION 'Only organization managers can change lead responsible'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.broker_id IS NOT NULL THEN
    SELECT organization_id INTO v_broker_org
    FROM public.profiles
    WHERE id = NEW.broker_id;

    IF v_broker_org IS NULL OR v_broker_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Broker does not belong to the lead organization'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT public.is_lead_eligible_responsible(NEW.broker_id, NEW.organization_id) THEN
      RAISE EXCEPTION 'Broker role is not eligible to be assigned as lead responsible'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;