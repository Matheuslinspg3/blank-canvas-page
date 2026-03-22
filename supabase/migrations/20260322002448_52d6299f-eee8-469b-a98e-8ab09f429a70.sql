-- 1. Configuração de tasks (editável via painel)
CREATE TABLE IF NOT EXISTS ai_router_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  complexity text NOT NULL DEFAULT 'medium',
  provider_chain jsonb NOT NULL,
  system_prompt text,
  max_tokens int DEFAULT 2000,
  temperature numeric(3,2) DEFAULT 0.70,
  is_active boolean DEFAULT true,
  requires_image boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Providers de IA (chaves e status)
CREATE TABLE IF NOT EXISTS ai_router_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  provider_type text NOT NULL,
  model_id text NOT NULL,
  env_secret_name text NOT NULL,
  api_base_url text NOT NULL,
  is_free boolean DEFAULT true,
  is_active boolean DEFAULT true,
  priority int DEFAULT 50,
  supports_image_input boolean DEFAULT false,
  supports_image_output boolean DEFAULT false,
  rate_limit_rpm int,
  rate_limit_rpd int,
  last_error_at timestamptz,
  consecutive_errors int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. Logs de cada chamada
CREATE TABLE IF NOT EXISTS ai_router_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  user_id uuid,
  task_type text NOT NULL,
  prompt_preview text,
  providers_attempted text[],
  provider_used text,
  model_used text,
  tokens_input int DEFAULT 0,
  tokens_output int DEFAULT 0,
  latency_ms int DEFAULT 0,
  is_free boolean DEFAULT true,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ai_router_config_task ON ai_router_config(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_org ON ai_router_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_task ON ai_router_logs(task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_provider ON ai_router_logs(provider_used, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_created ON ai_router_logs(created_at DESC);

-- RLS
ALTER TABLE ai_router_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON ai_router_config FOR SELECT USING (true);
CREATE POLICY "Developers can manage config" ON ai_router_config FOR ALL USING (has_role(auth.uid(), 'developer'::app_role));

ALTER TABLE ai_router_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read providers" ON ai_router_providers FOR SELECT USING (true);
CREATE POLICY "Developers can manage providers" ON ai_router_providers FOR ALL USING (has_role(auth.uid(), 'developer'::app_role));

ALTER TABLE ai_router_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can insert logs" ON ai_router_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Developers see all logs" ON ai_router_logs FOR SELECT USING (has_role(auth.uid(), 'developer'::app_role));
CREATE POLICY "Org members see own logs" ON ai_router_logs FOR SELECT USING (organization_id = get_user_organization_id());

-- Dados iniciais: Providers
INSERT INTO ai_router_providers (provider_key, display_name, provider_type, model_id, env_secret_name, api_base_url, is_free, supports_image_input, supports_image_output, rate_limit_rpm, rate_limit_rpd) VALUES
('groq_maverick_a',       'Groq Maverick (A)',       'groq',   'meta-llama/llama-4-maverick-17b-128e-instruct', 'GROQ_KEY_A',          'https://api.groq.com/openai/v1/chat/completions', true, false, false, 30, 1000),
('groq_maverick_b',       'Groq Maverick (B)',       'groq',   'meta-llama/llama-4-maverick-17b-128e-instruct', 'GROQ_KEY_B',          'https://api.groq.com/openai/v1/chat/completions', true, false, false, 30, 1000),
('groq_70b_a',            'Groq Llama 70B (A)',      'groq',   'llama-3.3-70b-versatile',                      'GROQ_KEY_A',          'https://api.groq.com/openai/v1/chat/completions', true, false, false, 30, 100),
('groq_70b_b',            'Groq Llama 70B (B)',      'groq',   'llama-3.3-70b-versatile',                      'GROQ_KEY_B',          'https://api.groq.com/openai/v1/chat/completions', true, false, false, 30, 100),
('gemini_flash_lite_a',   'Gemini Flash-Lite (A)',   'gemini', 'gemini-2.5-flash-lite-preview-06-17',          'GEMINI_KEY_TEXT',     'https://generativelanguage.googleapis.com/v1beta', true, false, false, 15, 1000),
('gemini_flash_lite_b',   'Gemini Flash-Lite (B)',   'gemini', 'gemini-2.5-flash-lite-preview-06-17',          'GEMINI_KEY_OVERFLOW', 'https://generativelanguage.googleapis.com/v1beta', true, false, false, 15, 1000),
('gemini_flash_a',        'Gemini Flash (A)',        'gemini', 'gemini-2.5-flash-preview-05-20',               'GEMINI_KEY_TEXT',     'https://generativelanguage.googleapis.com/v1beta', true, true, false, 10, 250),
('gemini_flash_b',        'Gemini Flash (B)',        'gemini', 'gemini-2.5-flash-preview-05-20',               'GEMINI_KEY_OVERFLOW', 'https://generativelanguage.googleapis.com/v1beta', true, true, false, 10, 250),
('gemini_pro_a',          'Gemini Pro (A)',          'gemini', 'gemini-2.5-pro-preview-05-06',                 'GEMINI_KEY_TEXT',     'https://generativelanguage.googleapis.com/v1beta', true, true, false, 5, 100),
('gemini_pro_b',          'Gemini Pro (B)',          'gemini', 'gemini-2.5-pro-preview-05-06',                 'GEMINI_KEY_IMAGE',    'https://generativelanguage.googleapis.com/v1beta', true, true, false, 5, 100),
('gemini_pro_c',          'Gemini Pro (C)',          'gemini', 'gemini-2.5-pro-preview-05-06',                 'GEMINI_KEY_OVERFLOW', 'https://generativelanguage.googleapis.com/v1beta', true, true, false, 5, 100),
('gemini_image',          'Gemini Flash Image',      'gemini', 'gemini-2.5-flash-preview-05-20',               'GEMINI_KEY_IMAGE',    'https://generativelanguage.googleapis.com/v1beta', true, false, true, 10, 500),
('openai_mini',           'OpenAI GPT-4o-mini',      'openai', 'gpt-4o-mini',                                  'OPENAI_KEY_BACKUP',   'https://api.openai.com/v1/chat/completions', false, true, false, 500, 10000),
('openai_dalle',          'OpenAI DALL-E 3',         'openai', 'dall-e-3',                                     'OPENAI_KEY_BACKUP',   'https://api.openai.com/v1/images/generations', false, false, true, 50, 1000);

-- Dados iniciais: Tasks com chains
INSERT INTO ai_router_config (task_type, display_name, description, complexity, provider_chain, system_prompt, max_tokens, temperature, requires_image) VALUES
('summarize',        'Resumo de Lead',            'Gera resumo conciso de um lead',                        'simple',  '["groq_maverick_a","groq_maverick_b","gemini_flash_lite_a","gemini_flash_lite_b"]', 'Você é um assistente imobiliário. Resuma as informações do lead em 3-4 frases objetivas, destacando interesse, orçamento e urgência.', 1000, 0.5, false),
('classify',         'Classificação',             'Classifica texto em categorias',                        'simple',  '["groq_maverick_a","groq_maverick_b","gemini_flash_lite_a"]', 'Classifique o conteúdo na categoria mais adequada. Responda apenas com a categoria.', 500, 0.3, false),
('ticket_chat',      'Chat de Suporte',           'Responde tickets de suporte',                           'simple',  '["groq_maverick_a","groq_maverick_b","gemini_flash_lite_a"]', 'Você é o assistente de suporte do Porta do Corretor. Responda de forma clara, amigável e objetiva em português brasileiro.', 1500, 0.7, false),
('ad_text',          'Texto de Anúncio',          'Gera texto persuasivo para anúncios de imóveis',        'medium',  '["gemini_flash_a","gemini_flash_b","groq_70b_a","groq_70b_b","openai_mini"]', 'Você é um copywriter especializado em anúncios imobiliários brasileiros. Crie textos persuasivos e profissionais destacando os diferenciais do imóvel. Use linguagem acessível.', 2000, 0.7, false),
('landing_page',     'Landing Page',              'Gera conteúdo completo para landing page de imóvel',    'medium',  '["gemini_flash_a","gemini_flash_b","groq_70b_a","openai_mini"]', 'Você é especialista em marketing imobiliário. Crie conteúdo completo para landing page incluindo headline, descrição, destaques e call-to-action. Em português brasileiro.', 3000, 0.7, false),
('contract_fill',    'Preenchimento de Contrato', 'Preenche templates de contrato com dados do negócio',   'medium',  '["gemini_flash_a","groq_70b_a","openai_mini"]', 'Você é um assistente jurídico imobiliário. Preencha o template com os dados fornecidos mantendo formatação e linguagem jurídica brasileira.', 4000, 0.3, false),
('contract_template','Template de Contrato',      'Gera templates de contrato imobiliário',                'medium',  '["gemini_flash_a","gemini_flash_b","openai_mini"]', 'Você é advogado especializado em direito imobiliário brasileiro. Gere um template de contrato profissional e completo.', 5000, 0.5, false),
('validate_document','Validação de Documento',    'Valida documentos de leads',                            'medium',  '["gemini_flash_a","gemini_flash_b","openai_mini"]', 'Valide se este documento é legível, está dentro da validade e contém as informações necessárias. Responda em JSON: { valid: boolean, issues: string[], confidence: number }.', 1000, 0.3, false),
('pdf_extract',      'Extração de PDF',           'Extrai dados estruturados de PDFs de imóveis',          'complex', '["gemini_pro_a","gemini_pro_b","gemini_pro_c","openai_mini"]', 'Extraia os dados do imóvel deste documento. Retorne em JSON: { title, address, price, bedrooms, bathrooms, area, suites, parking, amenities: [], description, property_type }.', 2000, 0.3, true),
('analyze_photo',    'Análise de Foto',           'Analisa qualidade e conteúdo de fotos de imóveis',      'complex', '["gemini_pro_a","gemini_pro_b","gemini_pro_c","openai_mini"]', 'Analise esta foto de imóvel. Avalie: qualidade (iluminação, enquadramento, resolução de 1-10), cômodo identificado, pontos positivos e negativos. Responda em JSON: { score: number, room: string, pros: [], cons: [], suggestion: string }.', 1000, 0.5, true),
('art',              'Arte para Imóvel',          'Gera arte/imagem para marketing de imóvel',             'image',   '["gemini_image","openai_dalle"]', null, 1000, 0.8, false),
('ad_image',         'Imagem de Anúncio',         'Gera imagem para anúncio de imóvel',                    'image',   '["gemini_image","openai_dalle"]', null, 1000, 0.8, false);