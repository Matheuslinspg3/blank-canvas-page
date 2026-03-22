ALTER TABLE ai_router_providers ADD COLUMN IF NOT EXISTS api_key text;
COMMENT ON COLUMN ai_router_providers.api_key IS 'API key do provider — protegida por RLS, só developers veem';

CREATE OR REPLACE VIEW ai_router_providers_safe AS
SELECT id, provider_key, display_name, provider_type, model_id, api_base_url,
       is_free, is_active, priority, supports_image_input, supports_image_output,
       rate_limit_rpm, rate_limit_rpd, last_error_at, consecutive_errors, notes, created_at,
       env_secret_name,
       (api_key IS NOT NULL AND LENGTH(api_key) > 0) AS has_api_key
FROM ai_router_providers;