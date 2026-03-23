-- Add default-deny policy for scrape_cache (only accessed via service_role which bypasses RLS)
-- This silences the "RLS Enabled No Policy" linter warning
CREATE POLICY "No direct access" ON scrape_cache
  FOR SELECT TO authenticated
  USING (false);