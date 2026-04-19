ALTER TABLE public.retell_agent_config
ADD COLUMN IF NOT EXISTS conversation_flow_id text;