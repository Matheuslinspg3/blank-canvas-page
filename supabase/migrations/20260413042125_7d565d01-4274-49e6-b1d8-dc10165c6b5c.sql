
ALTER TABLE public.retell_agent_config
  ADD COLUMN IF NOT EXISTS notification_template_broker TEXT DEFAULT 'Novo lead qualificado via chamada de voz!\n\nNome: {{lead_name}}\nTelefone: {{lead_phone}}\nScore: {{score}}/100\nResumo: {{summary}}',
  ADD COLUMN IF NOT EXISTS notification_template_client TEXT DEFAULT 'Obrigado pela sua ligação! Um corretor especializado entrará em contato em breve.',
  ADD COLUMN IF NOT EXISTS broker_assignment_mode TEXT DEFAULT 'round_robin',
  ADD COLUMN IF NOT EXISTS score_criteria JSONB DEFAULT '{"interesse_compra": 30, "orcamento_definido": 25, "prazo_definido": 20, "regiao_definida": 15, "documentacao_pronta": 10}'::jsonb,
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS post_call_analysis_prompt TEXT DEFAULT 'Analise a transcrição da chamada e extraia: nome do cliente, telefone, orçamento, região de interesse, tipo de imóvel, prazo para compra e nível de interesse (1-10). Retorne em JSON.';
