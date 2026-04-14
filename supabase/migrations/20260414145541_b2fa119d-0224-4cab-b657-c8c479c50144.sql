INSERT INTO ai_router_config (task_type, display_name, complexity, provider_chain, is_active, routing_mode, temperature, max_tokens)
VALUES (
  'chat',
  'Chat Geral',
  'medium',
  '["groq_llama_70b", "google_gemini_flash", "openai_gpt4o_mini"]'::jsonb,
  true,
  'auto',
  0.7,
  2000
)
ON CONFLICT (task_type) DO NOTHING;