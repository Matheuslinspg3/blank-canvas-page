INSERT INTO public.app_runtime_config (id, maintenance_mode, maintenance_message)
VALUES ('singleton', false, 'Sistema em manutenção. Voltaremos em breve.')
ON CONFLICT (id) DO NOTHING;