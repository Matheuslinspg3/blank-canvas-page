
UPDATE public.ai_router_providers SET env_secret_name = 'GROQ_API_KEY_1' WHERE env_secret_name = 'GROQ_KEY_A';
UPDATE public.ai_router_providers SET env_secret_name = 'GROQ_API_KEY_2' WHERE env_secret_name = 'GROQ_KEY_B';
UPDATE public.ai_router_providers SET env_secret_name = 'GOOGLE_AI_KEY_1' WHERE env_secret_name = 'GEMINI_KEY_TEXT';
UPDATE public.ai_router_providers SET env_secret_name = 'GOOGLE_AI_KEY_2' WHERE env_secret_name IN ('GEMINI_KEY_OVERFLOW','GEMINI_KEY_IMAGE');
UPDATE public.ai_router_providers SET env_secret_name = 'OPENAI_IMAGE_API_KEY' WHERE env_secret_name = 'OPENAI_KEY_BACKUP';
UPDATE public.ai_router_providers SET consecutive_errors = 0, last_error_at = NULL;
