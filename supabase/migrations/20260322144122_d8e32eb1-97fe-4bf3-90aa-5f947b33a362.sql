-- Update all Gemini providers from deprecated gemini-2.0-flash to gemini-2.5-flash
-- which actually has free-tier quota allocated (5 RPM, 20 RPD per key)
UPDATE ai_router_providers
SET model_id = 'gemini-2.5-flash',
    consecutive_errors = 0,
    last_error_at = NULL
WHERE provider_type = 'gemini'
  AND model_id = 'gemini-2.0-flash';
