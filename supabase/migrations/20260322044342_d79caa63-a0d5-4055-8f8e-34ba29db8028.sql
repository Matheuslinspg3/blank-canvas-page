DROP POLICY IF EXISTS "Service role full access to provider stats" ON ai_router_provider_stats;

CREATE POLICY "Authenticated users can read provider stats"
  ON ai_router_provider_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage provider stats"
  ON ai_router_provider_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);