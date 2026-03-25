-- Table: plan_modules (catalog of purchasable modules)
CREATE TABLE public.plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly integer NOT NULL DEFAULT 0,
  price_yearly integer NOT NULL DEFAULT 0,
  feature_key text NOT NULL,
  feature_value jsonb NOT NULL DEFAULT 'true'::jsonb,
  category text NOT NULL DEFAULT 'gestao',
  icon text DEFAULT 'Zap',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active modules"
  ON public.plan_modules FOR SELECT
  USING (is_active = true);

-- Table: custom_plan_selections (org's selected modules)
CREATE TABLE public.custom_plan_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.plan_modules(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_id)
);

ALTER TABLE public.custom_plan_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own selections"
  ON public.custom_plan_selections FOR SELECT
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert own selections"
  ON public.custom_plan_selections FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can delete own selections"
  ON public.custom_plan_selections FOR DELETE
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Seed modules
INSERT INTO public.plan_modules (name, slug, description, price_monthly, price_yearly, feature_key, feature_value, category, icon, display_order) VALUES
  ('+100 Imóveis', 'extra-imoveis-100', 'Adicione 100 imóveis ao seu plano', 1990, 19900, 'max_own_properties', '100', 'gestao', 'Building2', 1),
  ('+500 Leads', 'extra-leads-500', 'Adicione 500 leads ao seu plano', 2990, 29900, 'max_leads', '500', 'gestao', 'UserCheck', 2),
  ('+3 Usuários', 'extra-usuarios-3', 'Adicione 3 usuários ao seu plano', 2490, 24900, 'max_users', '3', 'gestao', 'Users', 3),
  ('CRM Kanban', 'modulo-crm', 'CRM completo com Kanban de leads', 3990, 39900, 'basic_crm', 'true', 'gestao', 'LayoutGrid', 4),
  ('Financeiro', 'modulo-financeiro', 'Controle financeiro completo', 4990, 49900, 'financial', 'true', 'gestao', 'DollarSign', 5),
  ('WhatsApp Connect', 'modulo-whatsapp', 'Integração com WhatsApp e Valentina IA', 5990, 59900, 'whatsapp', 'true', 'integracao', 'MessageCircle', 6),
  ('50 Artes IA/mês', 'extra-artes-ia-50', 'Geração de 50 artes por mês com IA', 2990, 29900, 'ai_art_limit', '50', 'ia', 'Palette', 7),
  ('100 Textos IA/mês', 'extra-textos-ia-100', 'Geração de 100 textos por mês com IA', 1990, 19900, 'ai_text_limit', '100', 'ia', 'FileText', 8),
  ('Meta Ads', 'modulo-meta-ads', 'Integração com Meta Ads', 3990, 39900, 'meta_ads', 'true', 'marketing', 'Megaphone', 9),
  ('Contratos IA', 'modulo-contratos-ia', 'Geração de contratos com IA', 4990, 49900, 'contracts_ai', 'true', 'ia', 'FileSignature', 10),
  ('Feed XML', 'modulo-feed-xml', 'Exportação de imóveis via Feed XML', 1990, 19900, 'xml_feed', 'true', 'integracao', 'Rss', 11),
  ('Suporte Prioritário', 'modulo-suporte-prio', 'Atendimento prioritário por chat e email', 2990, 29900, 'priority_support', 'true', 'gestao', 'Shield', 12);

-- Insert custom plan into subscription_plans
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, max_own_properties, max_users, max_leads, marketplace_access, partnership_access, priority_support, features, display_order, is_active, plan_type)
VALUES ('Personalizado', 'personalizado', 'Monte seu plano ideal escolhendo os módulos que precisa', 0, 0, 10, 1, 20, false, false, false, '{"line":"custom","custom":true}'::jsonb, 99, true, 'custom');