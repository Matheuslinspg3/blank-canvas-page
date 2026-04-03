
-- Tabela granular de custos IA por mensagem WhatsApp
CREATE TABLE public.whatsapp_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  message_id TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
  total_cost_brl NUMERIC(12,6) NOT NULL DEFAULT 0,
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wau_org_date ON public.whatsapp_ai_usage(organization_id, processed_at DESC);
CREATE INDEX idx_wau_remote_jid ON public.whatsapp_ai_usage(remote_jid, processed_at DESC);
CREATE INDEX idx_wau_instance ON public.whatsapp_ai_usage(instance_name);

ALTER TABLE public.whatsapp_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org usage"
  ON public.whatsapp_ai_usage FOR SELECT TO authenticated
  USING (public.is_org_manager_or_above(organization_id));

CREATE POLICY "System can insert usage"
  ON public.whatsapp_ai_usage FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON public.whatsapp_ai_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- View: custo por mensagem
CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_per_message AS
SELECT
  id,
  organization_id,
  instance_name,
  remote_jid,
  message_type,
  steps,
  total_input_tokens,
  total_output_tokens,
  total_cost_usd,
  total_cost_brl,
  voice_enabled,
  processed_at
FROM public.whatsapp_ai_usage
ORDER BY processed_at DESC;

-- View: custo por conversa (remote_jid)
CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_per_conversation AS
SELECT
  organization_id,
  instance_name,
  remote_jid,
  COUNT(*) AS total_messages,
  SUM(total_input_tokens) AS total_input_tokens,
  SUM(total_output_tokens) AS total_output_tokens,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_cost_brl) AS total_cost_brl,
  MIN(processed_at) AS first_message_at,
  MAX(processed_at) AS last_message_at
FROM public.whatsapp_ai_usage
GROUP BY organization_id, instance_name, remote_jid;

-- View: custo diário por org
CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_daily AS
SELECT
  organization_id,
  DATE(processed_at) AS date,
  COUNT(*) AS total_messages,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_cost_brl) AS total_cost_brl,
  SUM(total_input_tokens) AS total_input_tokens,
  SUM(total_output_tokens) AS total_output_tokens,
  COUNT(*) FILTER (WHERE voice_enabled) AS voice_messages,
  COUNT(*) FILTER (WHERE message_type = 'audio') AS audio_messages,
  COUNT(*) FILTER (WHERE message_type = 'image') AS image_messages
FROM public.whatsapp_ai_usage
GROUP BY organization_id, DATE(processed_at);

-- View: custo mensal por org
CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_monthly AS
SELECT
  organization_id,
  TO_CHAR(processed_at, 'YYYY-MM') AS month,
  COUNT(*) AS total_messages,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_cost_brl) AS total_cost_brl,
  ROUND(SUM(total_cost_usd) / NULLIF(COUNT(*), 0), 6) AS avg_cost_per_message,
  COUNT(DISTINCT remote_jid) AS unique_contacts,
  COUNT(*) FILTER (WHERE voice_enabled) AS voice_messages
FROM public.whatsapp_ai_usage
GROUP BY organization_id, TO_CHAR(processed_at, 'YYYY-MM');

-- View: top conversas mais caras
CREATE OR REPLACE VIEW public.v_whatsapp_ai_top_conversations AS
SELECT
  organization_id,
  remote_jid,
  COUNT(*) AS total_messages,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_cost_brl) AS total_cost_brl,
  MAX(processed_at) AS last_activity
FROM public.whatsapp_ai_usage
GROUP BY organization_id, remote_jid
ORDER BY total_cost_usd DESC;

-- RPC para resumo rápido no dashboard
CREATE OR REPLACE FUNCTION public.get_whatsapp_ai_cost_summary(
  p_organization_id UUID,
  p_period TEXT DEFAULT 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_since := CASE p_period
    WHEN 'day' THEN NOW() - INTERVAL '1 day'
    WHEN 'week' THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    WHEN 'year' THEN NOW() - INTERVAL '365 days'
    ELSE NOW() - INTERVAL '30 days'
  END;

  SELECT jsonb_build_object(
    'period', p_period,
    'total_messages', COUNT(*),
    'unique_contacts', COUNT(DISTINCT remote_jid),
    'total_cost_usd', COALESCE(SUM(total_cost_usd), 0),
    'total_cost_brl', COALESCE(SUM(total_cost_brl), 0),
    'avg_cost_per_message', ROUND(COALESCE(SUM(total_cost_usd) / NULLIF(COUNT(*), 0), 0), 6),
    'total_input_tokens', COALESCE(SUM(total_input_tokens), 0),
    'total_output_tokens', COALESCE(SUM(total_output_tokens), 0),
    'voice_messages', COUNT(*) FILTER (WHERE voice_enabled),
    'audio_messages', COUNT(*) FILTER (WHERE message_type = 'audio'),
    'image_messages', COUNT(*) FILTER (WHERE message_type = 'image'),
    'by_step', (
      SELECT jsonb_object_agg(step_name, step_data)
      FROM (
        SELECT
          s->>'step' AS step_name,
          jsonb_build_object(
            'count', COUNT(*),
            'total_cost_usd', SUM((s->>'cost_usd')::NUMERIC),
            'total_tokens', SUM(COALESCE((s->>'input_tokens')::INT, 0) + COALESCE((s->>'output_tokens')::INT, 0))
          ) AS step_data
        FROM public.whatsapp_ai_usage u,
             jsonb_array_elements(u.steps) AS s
        WHERE u.organization_id = p_organization_id
          AND u.processed_at >= v_since
        GROUP BY s->>'step'
      ) sub
    )
  )
  INTO v_result
  FROM public.whatsapp_ai_usage
  WHERE organization_id = p_organization_id
    AND processed_at >= v_since;

  RETURN v_result;
END;
$$;
