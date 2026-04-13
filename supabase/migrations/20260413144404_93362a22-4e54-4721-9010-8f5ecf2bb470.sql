-- Add AI provider configuration to whatsapp_agent_config
ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'gpt-4o',
  ADD COLUMN IF NOT EXISTS ai_mode text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS byok_api_key text;

-- Add check constraint for valid providers
ALTER TABLE public.whatsapp_agent_config
  ADD CONSTRAINT chk_ai_provider CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'groq'));

-- Add check constraint for valid modes
ALTER TABLE public.whatsapp_agent_config
  ADD CONSTRAINT chk_ai_mode CHECK (ai_mode IN ('platform', 'byok'));

COMMENT ON COLUMN public.whatsapp_agent_config.ai_provider IS 'AI provider: openai, anthropic, gemini, groq';
COMMENT ON COLUMN public.whatsapp_agent_config.ai_model IS 'Specific model ID (e.g., gpt-4o, claude-3-sonnet, gemini-2.5-flash)';
COMMENT ON COLUMN public.whatsapp_agent_config.ai_mode IS 'platform = uses platform AI (included in plan), byok = bring your own key';
COMMENT ON COLUMN public.whatsapp_agent_config.byok_api_key IS 'Customer API key for BYOK mode (encrypted at rest by Supabase)';