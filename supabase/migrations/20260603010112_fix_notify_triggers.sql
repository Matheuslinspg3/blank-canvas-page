-- ============================================================
-- FIX: notify_lead_created & notify_lead_updated
-- 
-- Bug 1: JOIN errado (profiles.id = user_roles.user_id)
--   profiles.id é o UUID do profile, NÃO o auth user id.
--   Correto: profiles.user_id = user_roles.user_id
--
-- Bug 2: enum values 'manager','owner' não existem em app_role
--   Valores válidos: admin, sub_admin, leader, corretor, etc.
--
-- Resultado antes do fix: 0 notificações in-app eram geradas.
-- ============================================================

-- 1. Fix notify_lead_created (INSERT trigger)
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
  v_message := COALESCE(NEW.name, 'Lead sem nome');

  -- Notifica o corretor atribuído (lead_assigned)
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

  -- Notifica admins/sub_admins/leaders da organização (lead_created)
  FOR admin_rec IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE p.organization_id = NEW.organization_id
      AND ur.role IN ('admin', 'sub_admin', 'leader')
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

-- 2. Fix notify_lead_updated (UPDATE trigger) - same JOIN bug
CREATE OR REPLACE FUNCTION public.notify_lead_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assignment changed to a new broker
  IF NEW.broker_id IS DISTINCT FROM OLD.broker_id AND NEW.broker_id IS NOT NULL THEN
    PERFORM public.dispatch_notification(
      NEW.broker_id,
      NEW.organization_id,
      'lead_assigned',
      'Novo lead atribuído a você',
      COALESCE(NEW.name, 'Lead sem nome'),
      NEW.id,
      'lead'
    );
  END IF;

  -- Stage changed → notify current responsible broker
  IF NEW.lead_stage_id IS DISTINCT FROM OLD.lead_stage_id AND NEW.broker_id IS NOT NULL THEN
    PERFORM public.dispatch_notification(
      NEW.broker_id,
      NEW.organization_id,
      'lead_stage_changed',
      'Lead mudou de estágio',
      COALESCE(NEW.name, 'Lead') || ' avançou no funil',
      NEW.id,
      'lead'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Reprocessar lead Meta que falhou pelo bug do enum
UPDATE public.ad_leads
SET status = 'new', status_reason = NULL, updated_at = now()
WHERE external_lead_id = '4373910639542008' AND status = 'send_failed';

-- 4. Limpar meta_lead_failures de teste (IDs falsos)
DELETE FROM public.meta_lead_failures
WHERE leadgen_id LIKE 'TEST_%' OR leadgen_id LIKE 'FAKE_%' OR leadgen_id LIKE '44444%';
