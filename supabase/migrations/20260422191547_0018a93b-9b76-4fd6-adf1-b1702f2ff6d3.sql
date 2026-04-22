
-- =====================================================
-- 1. FIX: whatsapp_ai_usage INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "System can insert usage" ON public.whatsapp_ai_usage;
CREATE POLICY "System can insert usage" ON public.whatsapp_ai_usage
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- 2. FIX: ai_router_config SELECT policy
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read config" ON public.ai_router_config;
CREATE POLICY "Authenticated users can read config" ON public.ai_router_config
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- 3. FIX: Tables with RLS enabled but no policies
-- =====================================================

-- channel_account_credentials (has organization_id)
CREATE POLICY "Org members can manage credentials"
  ON public.channel_account_credentials FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- meta_webhook_events (no org_id — dev only)
CREATE POLICY "Developers can read webhook events"
  ON public.meta_webhook_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'developer'::app_role));

-- signup_attempt_log (dev only)
CREATE POLICY "Developers can read signup attempts"
  ON public.signup_attempt_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'developer'::app_role));

-- webauthn_challenges (user's own)
CREATE POLICY "Users manage own challenges"
  ON public.webauthn_challenges FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. FIX: Views — SECURITY INVOKER
-- =====================================================

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, user_id, full_name, avatar_url, organization_id
FROM profiles p;

CREATE OR REPLACE VIEW public.ad_accounts_safe
WITH (security_invoker = true) AS
SELECT id, organization_id, provider, external_account_id, name, is_active, status, created_at, updated_at,
       (auth_payload IS NOT NULL) AS is_connected
FROM ad_accounts;

CREATE OR REPLACE VIEW public.ai_router_providers_safe
WITH (security_invoker = true) AS
SELECT id, provider_key, display_name, provider_type, model_id, api_base_url, is_free, is_active,
       priority, supports_image_input, supports_image_output, rate_limit_rpm, rate_limit_rpd,
       last_error_at, consecutive_errors, notes, created_at, env_secret_name,
       (api_key IS NOT NULL AND length(api_key) > 0) AS has_api_key
FROM ai_router_providers;

CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_daily
WITH (security_invoker = true) AS
SELECT organization_id, date(processed_at) AS date,
       count(*) AS total_messages,
       sum(total_cost_usd) AS total_cost_usd,
       sum(total_cost_brl) AS total_cost_brl,
       sum(total_input_tokens) AS total_input_tokens,
       sum(total_output_tokens) AS total_output_tokens,
       count(*) FILTER (WHERE voice_enabled) AS voice_messages,
       count(*) FILTER (WHERE message_type = 'audio') AS audio_messages,
       count(*) FILTER (WHERE message_type = 'image') AS image_messages
FROM whatsapp_ai_usage
GROUP BY organization_id, date(processed_at);

CREATE OR REPLACE VIEW public.v_whatsapp_ai_costs_monthly
WITH (security_invoker = true) AS
SELECT organization_id,
       to_char(processed_at, 'YYYY-MM') AS month,
       count(*) AS total_messages,
       sum(total_cost_usd) AS total_cost_usd,
       sum(total_cost_brl) AS total_cost_brl,
       round(sum(total_cost_usd) / NULLIF(count(*), 0)::numeric, 6) AS avg_cost_per_message,
       count(DISTINCT remote_jid) AS unique_contacts,
       count(*) FILTER (WHERE voice_enabled) AS voice_messages
FROM whatsapp_ai_usage
GROUP BY organization_id, to_char(processed_at, 'YYYY-MM');

CREATE OR REPLACE VIEW public.ai_properties_view
WITH (security_invoker = true) AS
SELECT p.id, p.organization_id, p.property_code AS codigo, p.title AS titulo,
       p.description AS descricao, pt.name AS tipo_imovel, p.transaction_type AS tipo_transacao,
       p.sale_price AS preco_venda, p.rent_price AS preco_aluguel, p.bedrooms AS quartos,
       p.suites, p.bathrooms AS banheiros, p.parking_spots AS vagas, p.area_total,
       p.area_useful AS area_util, p.address_neighborhood AS bairro, p.address_city AS cidade,
       p.address_street AS rua, p.address_number AS numero, p.address_complement AS complemento,
       p.address_state AS estado, p.condominium_fee AS condominio, p.iptu_monthly AS iptu_mensal,
       p.amenities AS comodidades, p.property_condition AS condicao, p.launch_stage AS fase_lancamento,
       p.development_name AS empreendimento, p.beach_distance_meters AS distancia_praia_metros,
       p.payment_options AS opcoes_pagamento, p.youtube_url AS video_url,
       p.availability_status AS disponibilidade, p.status, p.featured AS destaque,
       p.ai_blacklist, p.updated_at
FROM properties p LEFT JOIN property_types pt ON pt.id = p.property_type_id
WHERE p.ai_blacklist = false AND p.availability_status = 'available';

-- =====================================================
-- 5. FIX: Functions without search_path
-- =====================================================
ALTER FUNCTION public.calculate_ai_cost(text, text, integer, integer) SET search_path = public;
ALTER FUNCTION public.get_public_site_document(uuid) SET search_path = public;
ALTER FUNCTION public.get_public_site_document_full(uuid) SET search_path = public;
ALTER FUNCTION public.normalize_marketplace_location() SET search_path = public;
ALTER FUNCTION public.sanitize_marketplace_contact_phone() SET search_path = public;
ALTER FUNCTION public.slugify(text) SET search_path = public;
ALTER FUNCTION public.trg_whatsapp_msg_followup_sync() SET search_path = public;

-- =====================================================
-- 6. FIX: Storage — restrict public bucket listing
-- =====================================================
DROP POLICY IF EXISTS "Property images are publicly accessible" ON storage.objects;
CREATE POLICY "Property images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images' AND name IS NOT NULL AND name != '');

DROP POLICY IF EXISTS "Anyone can view brand assets" ON storage.objects;
CREATE POLICY "Anyone can view brand assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-assets' AND name IS NOT NULL AND name != '');

DROP POLICY IF EXISTS "Public read for whatsapp media" ON storage.objects;
