-- Cadastrar Anthropic Claude Sonnet 4.5
INSERT INTO public.ai_router_providers (
  provider_key, display_name, provider_type, model_id,
  env_secret_name, api_base_url,
  is_free, is_active, priority,
  supports_image_input, supports_image_output,
  rate_limit_rpm, rate_limit_rpd,
  notes
) VALUES (
  'anthropic_claude_sonnet_45',
  'Claude Sonnet 4.5 (Anthropic)',
  'text',
  'claude-sonnet-4-5-20250929',
  'ANTHROPIC_API_KEY',
  'https://api.anthropic.com/v1',
  false, true, 100,
  true, false,
  50, 1000,
  'Premium fallback para extração de PDFs complexos/escaneados. Pago.'
)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  model_id = EXCLUDED.model_id,
  env_secret_name = EXCLUDED.env_secret_name,
  api_base_url = EXCLUDED.api_base_url,
  is_active = true,
  supports_image_input = true,
  notes = EXCLUDED.notes;

-- Anexar Claude no final da cascata do pdf_extract (sem duplicar)
UPDATE public.ai_router_config
SET provider_chain = (
  CASE
    WHEN provider_chain::jsonb ? 'anthropic_claude_sonnet_45'
      THEN provider_chain
    ELSE (provider_chain::jsonb || '["anthropic_claude_sonnet_45"]'::jsonb)
  END
),
updated_at = now()
WHERE task_type = 'pdf_extract';