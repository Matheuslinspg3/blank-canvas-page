-- Fix "RLS Policy Always True" linter warning
-- 1. ai_router_logs: restrict INSERT to authenticated users inserting their own logs
DROP POLICY IF EXISTS "System can insert logs" ON ai_router_logs;
CREATE POLICY "Authenticated users can insert own logs" ON ai_router_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Also allow service_role to insert (edge functions use service_role)
CREATE POLICY "Service role can insert logs" ON ai_router_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 2. Remove redundant service_role policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can manage provider stats" ON ai_router_provider_stats;
DROP POLICY IF EXISTS "Service role manages scrape cache" ON scrape_cache;