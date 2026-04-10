
-- 1. whatsapp_welcome_messages - new columns
ALTER TABLE whatsapp_welcome_messages
  ADD COLUMN IF NOT EXISTS time_period text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS target_audience text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS campaign_tag text,
  ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_rate numeric(5,2) DEFAULT 0;

-- 2. whatsapp_agent_config - new columns
ALTER TABLE whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS welcome_delay_min integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS welcome_delay_max integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS welcome_ab_test boolean DEFAULT false;

-- 3. whatsapp_welcome_log - new column
ALTER TABLE whatsapp_welcome_log
  ADD COLUMN IF NOT EXISTS replied boolean DEFAULT false;

-- 4. Trigger function to update reply metrics
CREATE OR REPLACE FUNCTION public.update_welcome_reply_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.replied = true AND (OLD.replied IS DISTINCT FROM true) AND NEW.welcome_message_id IS NOT NULL THEN
    UPDATE whatsapp_welcome_messages
    SET
      reply_count = reply_count + 1,
      reply_rate = CASE
        WHEN usage_count > 0 THEN ROUND(((reply_count + 1)::numeric / usage_count) * 100, 2)
        ELSE 0
      END
    WHERE id = NEW.welcome_message_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicates
DROP TRIGGER IF EXISTS trg_update_welcome_reply_metrics ON whatsapp_welcome_log;

CREATE TRIGGER trg_update_welcome_reply_metrics
  AFTER UPDATE ON whatsapp_welcome_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_welcome_reply_metrics();
