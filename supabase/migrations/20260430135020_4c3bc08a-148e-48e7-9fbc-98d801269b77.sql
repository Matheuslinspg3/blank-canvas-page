
-- =============================================
-- Notification Preferences System
-- =============================================

-- 1. Event types enum (for type safety)
DO $$ BEGIN
  CREATE TYPE public.notification_event_type AS ENUM (
    'lead_created',
    'lead_assigned',
    'lead_stage_changed',
    'task_assigned',
    'task_due_soon',
    'message_received',
    'appointment_scheduled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Preferences table (per user)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type public.notification_event_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_notif_pref_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notif_pref_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Helper: check if user has event enabled (default = true if no row)
CREATE OR REPLACE FUNCTION public.is_notification_enabled(_user_id UUID, _event public.notification_event_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.notification_preferences
      WHERE user_id = _user_id AND event_type = _event LIMIT 1),
    true
  );
$$;

-- 4. Helper: dispatch notification respecting user preference
CREATE OR REPLACE FUNCTION public.dispatch_notification(
  _user_id UUID,
  _organization_id UUID,
  _event public.notification_event_type,
  _title TEXT,
  _message TEXT,
  _entity_id UUID DEFAULT NULL,
  _entity_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF _user_id IS NULL OR _organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_notification_enabled(_user_id, _event) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
  VALUES (_user_id, _organization_id, _event::text, _title, _message, _entity_id, _entity_type)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. TRIGGERS

-- 5a. Lead created / assigned
CREATE OR REPLACE FUNCTION public.notify_lead_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  -- Notify the assigned broker (lead_assigned event)
  IF NEW.broker_id IS NOT NULL THEN
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
      COALESCE(NEW.name, 'Lead sem nome'),
      NEW.id,
      'lead'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lead_created ON public.leads;
CREATE TRIGGER trg_notify_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_created();

-- 5b. Lead updated: assignment change or stage change
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

DROP TRIGGER IF EXISTS trg_notify_lead_updated ON public.leads;
CREATE TRIGGER trg_notify_lead_updated
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_updated();
