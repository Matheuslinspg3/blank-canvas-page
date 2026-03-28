ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS scheduling_days text[] NOT NULL DEFAULT '{seg,ter,qua,qui,sex}',
  ADD COLUMN IF NOT EXISTS scheduling_hour_start text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS scheduling_hour_end text NOT NULL DEFAULT '17:00';