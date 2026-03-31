ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS voice_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_percentage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_id text DEFAULT 'EXAVITQu4vr4xnSDxMaL';

ALTER TABLE public.whatsapp_agent_config
  ADD CONSTRAINT voice_percentage_range CHECK (voice_percentage >= 0 AND voice_percentage <= 100);

COMMENT ON COLUMN public.whatsapp_agent_config.voice_enabled IS 'Whether the agent sends voice messages';
COMMENT ON COLUMN public.whatsapp_agent_config.voice_percentage IS '0-100 chance of sending audio instead of text';
COMMENT ON COLUMN public.whatsapp_agent_config.voice_id IS 'ElevenLabs voice ID to use for TTS';