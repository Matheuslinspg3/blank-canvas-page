-- ============================================================
-- COST OPTIMIZATIONS — Porta do Corretor
-- Created: 2026-03-23
-- Purpose: Reduce storage billing from unbounded log tables and
--          add indexes that make cleanup queries efficient.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Ensure ai_summary columns exist on leads table
--    (summarize-lead already uses them; this is a safety net)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'leads'
      AND column_name  = 'ai_summary'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN ai_summary TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'leads'
      AND column_name  = 'ai_summary_at'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN ai_summary_at TIMESTAMPTZ;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Indexes on created_at for cleanup query performance
-- ────────────────────────────────────────────────────────────

-- ai_router_logs: keep 90 days, prune older rows
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_created_at
  ON public.ai_router_logs (created_at);

-- ai_usage_logs: keep 30 days (rate-limit window is 1 hour)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at);

-- ai_token_usage_events: keep 90 days (billing audit trail)
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_events_created_at
  ON public.ai_token_usage_events (created_at);

-- ────────────────────────────────────────────────────────────
-- 3. Cleanup function for log tables
--    Call via pg_cron or a scheduled Edge Function.
--    Safe to run multiple times (idempotent DELETE WHERE).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_cost_logs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_router_logs   INTEGER := 0;
  deleted_usage_logs    INTEGER := 0;
  deleted_token_events  INTEGER := 0;
BEGIN
  -- ai_router_logs: retain last 90 days
  DELETE FROM public.ai_router_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_router_logs = ROW_COUNT;

  -- ai_usage_logs: retain last 30 days
  -- (rate-limit check only looks back 60 minutes, 30 days is generous)
  DELETE FROM public.ai_usage_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_usage_logs = ROW_COUNT;

  -- ai_token_usage_events: retain last 90 days
  -- (Stripe sync should have processed them by then)
  DELETE FROM public.ai_token_usage_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND stripe_sync_status = 'synced';
  GET DIAGNOSTICS deleted_token_events = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_router_logs',  deleted_router_logs,
    'deleted_usage_logs',   deleted_usage_logs,
    'deleted_token_events', deleted_token_events,
    'ran_at',               NOW()
  );
END;
$$;

-- Grant execute to service_role so Edge Functions can call it
GRANT EXECUTE ON FUNCTION public.cleanup_cost_logs() TO service_role;

-- ────────────────────────────────────────────────────────────
-- 4. Schedule cleanup via pg_cron (runs daily at 03:00 UTC)
--    Requires pg_cron extension to be enabled in Supabase dashboard.
--    If pg_cron is not enabled, remove this block and call the
--    function manually from a scheduled Edge Function instead.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only schedule if pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if it exists to avoid duplicates
    PERFORM cron.unschedule('cleanup-cost-logs')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cost-logs'
    );

    PERFORM cron.schedule(
      'cleanup-cost-logs',
      '0 3 * * *',  -- daily at 03:00 UTC
      $$SELECT public.cleanup_cost_logs()$$
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. Partial index on leads for ai_summary freshness checks
--    Speeds up the cache-hit lookup in summarize-lead Edge Fn.
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_ai_summary_at
  ON public.leads (ai_summary_at)
  WHERE ai_summary IS NOT NULL;
