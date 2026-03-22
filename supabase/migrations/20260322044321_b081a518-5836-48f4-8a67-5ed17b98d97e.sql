CREATE TABLE IF NOT EXISTS ai_router_provider_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  task_type text,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  total_requests int DEFAULT 0,
  successful_requests int DEFAULT 0,
  failed_requests int DEFAULT 0,
  total_latency_ms bigint DEFAULT 0,
  avg_latency_ms int DEFAULT 0,
  min_latency_ms int DEFAULT 0,
  max_latency_ms int DEFAULT 0,
  total_tokens_in bigint DEFAULT 0,
  total_tokens_out bigint DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  requests_today int DEFAULT 0,
  rate_limit_hits int DEFAULT 0,
  quality_score numeric(3,2),
  quality_votes int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider_key, task_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_provider_stats_key ON ai_router_provider_stats(provider_key, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_stats_task ON ai_router_provider_stats(provider_key, task_type, period_date DESC);

ALTER TABLE ai_router_provider_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to provider stats"
  ON ai_router_provider_stats FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE ai_router_config ADD COLUMN IF NOT EXISTS routing_mode text DEFAULT 'auto';

UPDATE ai_router_config SET routing_mode = 'auto' WHERE routing_mode IS NULL;