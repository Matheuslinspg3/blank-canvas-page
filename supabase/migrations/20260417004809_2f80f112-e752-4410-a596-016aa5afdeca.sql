
-- =============================================================
-- 1. ADD COLUMNS
-- =============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consent_voice_call boolean NOT NULL DEFAULT false;

ALTER TABLE public.retell_agent_config
  ADD COLUMN IF NOT EXISTS retell_phone_number_id text,
  ADD COLUMN IF NOT EXISTS retell_from_number text,
  ADD COLUMN IF NOT EXISTS auto_outbound_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_call_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS min_minutes_between_attempts integer NOT NULL DEFAULT 30;

-- =============================================================
-- 2. INDEXES on voice_calls
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_voice_calls_call_id ON public.voice_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_org_created ON public.voice_calls(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_lead ON public.voice_calls(lead_id) WHERE lead_id IS NOT NULL;

-- =============================================================
-- 3. voice_call_queue
-- =============================================================
CREATE TABLE IF NOT EXISTS public.voice_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','calling','done','failed','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  call_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcq_due ON public.voice_call_queue(status, next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vcq_lead ON public.voice_call_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_vcq_org ON public.voice_call_queue(organization_id);

ALTER TABLE public.voice_call_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view voice queue" ON public.voice_call_queue;
CREATE POLICY "Org admins can view voice queue"
  ON public.voice_call_queue FOR SELECT
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin') OR public.has_role(auth.uid(), 'developer'))
  );

DROP POLICY IF EXISTS "Org admins can manage voice queue" ON public.voice_call_queue;
CREATE POLICY "Org admins can manage voice queue"
  ON public.voice_call_queue FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin') OR public.has_role(auth.uid(), 'developer'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin') OR public.has_role(auth.uid(), 'developer'))
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_vcq_updated_at ON public.voice_call_queue;
CREATE TRIGGER trg_vcq_updated_at
  BEFORE UPDATE ON public.voice_call_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 4. Function: normalize phone to E.164 BR
-- =============================================================
CREATE OR REPLACE FUNCTION public.normalize_phone_br_e164(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(p, '\D', '', 'g');
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  IF left(digits, 2) = '55' AND length(digits) >= 12 THEN
    RETURN '+' || digits;
  END IF;
  IF length(digits) IN (10, 11) THEN
    RETURN '+55' || digits;
  END IF;
  RETURN '+' || digits;
END;
$$;

-- =============================================================
-- 5. Trigger: enqueue voice call on lead insert
-- =============================================================
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
  -- Need phone + consent + active
  IF NEW.phone IS NULL OR NEW.is_active = false OR NEW.consent_voice_call = false THEN
    RETURN NEW;
  END IF;

  e164 := public.normalize_phone_br_e164(NEW.phone);
  IF e164 IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check org config
  SELECT enabled, auto_outbound_enabled, agent_id, retell_from_number
    INTO cfg
    FROM public.retell_agent_config
   WHERE organization_id = NEW.organization_id
   LIMIT 1;

  IF cfg IS NULL OR cfg.enabled = false OR cfg.auto_outbound_enabled = false THEN
    RETURN NEW;
  END IF;

  IF cfg.agent_id IS NULL OR cfg.agent_id = '' OR cfg.retell_from_number IS NULL OR cfg.retell_from_number = '' THEN
    RETURN NEW;
  END IF;

  -- Debounce: skip if a call exists for this lead in last 24h
  SELECT COUNT(*) INTO recent_call_count
    FROM public.voice_calls
   WHERE lead_id = NEW.id
     AND created_at > now() - interval '24 hours';

  IF recent_call_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Already queued?
  IF EXISTS (SELECT 1 FROM public.voice_call_queue WHERE lead_id = NEW.id AND status IN ('pending','calling')) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.voice_call_queue (organization_id, lead_id, phone_e164, metadata)
  VALUES (
    NEW.organization_id,
    NEW.id,
    e164,
    jsonb_build_object('source', NEW.source, 'lead_name', NEW.name)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_voice_call ON public.leads;
CREATE TRIGGER trg_enqueue_voice_call
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_voice_call_fn();

-- =============================================================
-- 6. pg_cron job to invoke worker every minute
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
