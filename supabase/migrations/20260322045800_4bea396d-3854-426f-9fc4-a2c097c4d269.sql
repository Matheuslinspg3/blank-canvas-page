-- Clean up duplicate NULL rows first
DELETE FROM ai_router_provider_stats a
USING ai_router_provider_stats b
WHERE a.task_type IS NULL AND b.task_type IS NULL
  AND a.provider_key = b.provider_key
  AND a.period_date = b.period_date
  AND a.id > b.id;

-- Drop old constraint and create one that handles NULLs
ALTER TABLE ai_router_provider_stats DROP CONSTRAINT IF EXISTS ai_router_provider_stats_provider_key_task_type_period_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_stats_unique 
ON ai_router_provider_stats (provider_key, COALESCE(task_type, '__global__'), period_date);

-- Update the upsert function to use COALESCE for NULL handling
CREATE OR REPLACE FUNCTION public.upsert_ai_router_stats(
  p_provider_key text,
  p_task_type text,
  p_latency_ms int,
  p_success boolean,
  p_is_429 boolean,
  p_tokens_in int,
  p_tokens_out int,
  p_cost_usd numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_success_int int := CASE WHEN p_success THEN 1 ELSE 0 END;
  v_fail_int int := CASE WHEN p_success THEN 0 ELSE 1 END;
  v_rate_hit int := CASE WHEN p_is_429 THEN 1 ELSE 0 END;
  v_existing_id uuid;
BEGIN
  -- Upsert task-specific stats
  SELECT id INTO v_existing_id FROM ai_router_provider_stats
  WHERE provider_key = p_provider_key AND task_type = p_task_type AND period_date = CURRENT_DATE
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE ai_router_provider_stats SET
      total_requests = total_requests + 1,
      successful_requests = successful_requests + v_success_int,
      failed_requests = failed_requests + v_fail_int,
      total_latency_ms = total_latency_ms + p_latency_ms,
      avg_latency_ms = (total_latency_ms + p_latency_ms) / (total_requests + 1),
      min_latency_ms = LEAST(min_latency_ms, p_latency_ms),
      max_latency_ms = GREATEST(max_latency_ms, p_latency_ms),
      requests_today = requests_today + 1,
      rate_limit_hits = rate_limit_hits + v_rate_hit,
      total_tokens_in = total_tokens_in + p_tokens_in,
      total_tokens_out = total_tokens_out + p_tokens_out,
      estimated_cost_usd = estimated_cost_usd + p_cost_usd,
      updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO ai_router_provider_stats (
      provider_key, task_type, period_date,
      total_requests, successful_requests, failed_requests,
      total_latency_ms, avg_latency_ms, min_latency_ms, max_latency_ms,
      requests_today, rate_limit_hits,
      total_tokens_in, total_tokens_out, estimated_cost_usd,
      updated_at
    ) VALUES (
      p_provider_key, p_task_type, CURRENT_DATE,
      1, v_success_int, v_fail_int,
      p_latency_ms, p_latency_ms, p_latency_ms, p_latency_ms,
      1, v_rate_hit,
      p_tokens_in, p_tokens_out, p_cost_usd,
      now()
    );
  END IF;

  -- Upsert global stats (task_type = NULL)
  SELECT id INTO v_existing_id FROM ai_router_provider_stats
  WHERE provider_key = p_provider_key AND task_type IS NULL AND period_date = CURRENT_DATE
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE ai_router_provider_stats SET
      total_requests = total_requests + 1,
      successful_requests = successful_requests + v_success_int,
      failed_requests = failed_requests + v_fail_int,
      total_latency_ms = total_latency_ms + p_latency_ms,
      avg_latency_ms = (total_latency_ms + p_latency_ms) / (total_requests + 1),
      min_latency_ms = LEAST(min_latency_ms, p_latency_ms),
      max_latency_ms = GREATEST(max_latency_ms, p_latency_ms),
      requests_today = requests_today + 1,
      rate_limit_hits = rate_limit_hits + v_rate_hit,
      total_tokens_in = total_tokens_in + p_tokens_in,
      total_tokens_out = total_tokens_out + p_tokens_out,
      estimated_cost_usd = estimated_cost_usd + p_cost_usd,
      updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO ai_router_provider_stats (
      provider_key, task_type, period_date,
      total_requests, successful_requests, failed_requests,
      total_latency_ms, avg_latency_ms, min_latency_ms, max_latency_ms,
      requests_today, rate_limit_hits,
      total_tokens_in, total_tokens_out, estimated_cost_usd,
      updated_at
    ) VALUES (
      p_provider_key, NULL, CURRENT_DATE,
      1, v_success_int, v_fail_int,
      p_latency_ms, p_latency_ms, p_latency_ms, p_latency_ms,
      1, v_rate_hit,
      p_tokens_in, p_tokens_out, p_cost_usd,
      now()
    );
  END IF;
END;
$$;