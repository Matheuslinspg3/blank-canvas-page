-- Fix SECRETS_EXPOSED: Remove permissive RLS policy that exposes API keys to all users
-- The ai-router edge function uses service_role key (bypasses RLS), so this is safe.
-- Client code uses ai_router_providers_safe view which excludes api_key column.

DROP POLICY IF EXISTS "Anyone can read providers" ON ai_router_providers;

-- Add a restricted read policy: only developers can read the full table (including api_key)
CREATE POLICY "Developers can read providers" ON ai_router_providers 
  FOR SELECT 
  TO authenticated 
  USING (has_role(auth.uid(), 'developer'::app_role));