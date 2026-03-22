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
BEGIN
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
  )
  ON CONFLICT (provider_key, task_type, period_date) DO UPDATE SET
    total_requests = ai_router_provider_stats.total_requests + 1,
    successful_requests = ai_router_provider_stats.successful_requests + v_success_int,
    failed_requests = ai_router_provider_stats.failed_requests + v_fail_int,
    total_latency_ms = ai_router_provider_stats.total_latency_ms + p_latency_ms,
    avg_latency_ms = (ai_router_provider_stats.total_latency_ms + p_latency_ms) / (ai_router_provider_stats.total_requests + 1),
    min_latency_ms = LEAST(ai_router_provider_stats.min_latency_ms, p_latency_ms),
    max_latency_ms = GREATEST(ai_router_provider_stats.max_latency_ms, p_latency_ms),
    requests_today = ai_router_provider_stats.requests_today + 1,
    rate_limit_hits = ai_router_provider_stats.rate_limit_hits + v_rate_hit,
    total_tokens_in = ai_router_provider_stats.total_tokens_in + p_tokens_in,
    total_tokens_out = ai_router_provider_stats.total_tokens_out + p_tokens_out,
    estimated_cost_usd = ai_router_provider_stats.estimated_cost_usd + p_cost_usd,
    updated_at = now();

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
  )
  ON CONFLICT (provider_key, task_type, period_date) DO UPDATE SET
    total_requests = ai_router_provider_stats.total_requests + 1,
    successful_requests = ai_router_provider_stats.successful_requests + v_success_int,
    failed_requests = ai_router_provider_stats.failed_requests + v_fail_int,
    total_latency_ms = ai_router_provider_stats.total_latency_ms + p_latency_ms,
    avg_latency_ms = (ai_router_provider_stats.total_latency_ms + p_latency_ms) / (ai_router_provider_stats.total_requests + 1),
    min_latency_ms = LEAST(ai_router_provider_stats.min_latency_ms, p_latency_ms),
    max_latency_ms = GREATEST(ai_router_provider_stats.max_latency_ms, p_latency_ms),
    requests_today = ai_router_provider_stats.requests_today + 1,
    rate_limit_hits = ai_router_provider_stats.rate_limit_hits + v_rate_hit,
    total_tokens_in = ai_router_provider_stats.total_tokens_in + p_tokens_in,
    total_tokens_out = ai_router_provider_stats.total_tokens_out + p_tokens_out,
    estimated_cost_usd = ai_router_provider_stats.estimated_cost_usd + p_cost_usd,
    updated_at = now();
END;
$$;