
-- Deactivate old plans
UPDATE subscription_plans SET is_active = false WHERE slug IN ('gratuito','starter','professional','enterprise');

-- Insert Marketplace line plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_own_properties, max_users, max_leads, marketplace_access, partnership_access, priority_support, features, display_order, is_active)
VALUES
  ('Visitante', 'visitante', 'Acesso básico ao marketplace com busca limitada', 0, 0, 0, 1, 0, false, false, false,
   '{"line":"marketplace","details_per_day":10,"show_contact":false,"max_favorites":20,"can_publish":false,"ai_art_limit":0,"ai_text_limit":0,"ai_landing_limit":0,"highlight_results":false,"partnerships":false,"alerts":false,"broker_profile":false,"view_stats":false}'::jsonb,
   0, true),

  ('Explorador', 'explorador', 'Busca ilimitada e contato dos anunciantes', 19.90, 199.00, 0, 1, 0, true, false, false,
   '{"line":"marketplace","details_per_day":null,"show_contact":true,"max_favorites":null,"can_publish":false,"ai_art_limit":0,"ai_text_limit":0,"ai_landing_limit":0,"highlight_results":false,"partnerships":false,"alerts":true,"broker_profile":false,"view_stats":false}'::jsonb,
   1, true),

  ('Corretor Marketplace', 'corretor-mp', 'Publique imóveis e receba leads do marketplace', 49.90, 499.00, 10, 1, 0, true, false, false,
   '{"line":"marketplace","details_per_day":null,"show_contact":true,"max_favorites":null,"can_publish":true,"max_published":10,"ai_art_limit":0,"ai_text_limit":0,"ai_landing_limit":1,"highlight_results":false,"partnerships":false,"alerts":true,"broker_profile":true,"view_stats":false,"receive_leads":true}'::jsonb,
   2, true),

  ('Corretor Marketplace Plus', 'corretor-mp-plus', 'Mais imóveis, IA e destaque nos resultados', 89.90, 899.00, 50, 1, 0, true, false, false,
   '{"line":"marketplace","details_per_day":null,"show_contact":true,"max_favorites":null,"can_publish":true,"max_published":50,"ai_art_limit":5,"ai_text_limit":5,"ai_landing_limit":5,"highlight_results":true,"partnerships":false,"alerts":true,"broker_profile":true,"view_stats":true,"receive_leads":true}'::jsonb,
   3, true),

  ('Agência Marketplace', 'agencia-mp', 'Publicação ilimitada, IA completa e parcerias', 149.90, 1499.00, null, 1, 0, true, true, false,
   '{"line":"marketplace","details_per_day":null,"show_contact":true,"max_favorites":null,"can_publish":true,"max_published":null,"ai_art_limit":30,"ai_text_limit":30,"ai_landing_limit":10,"highlight_results":true,"partnerships":true,"alerts":true,"broker_profile":true,"view_stats":true,"receive_leads":true,"verified_badge":true,"priority_results":true}'::jsonb,
   4, true),

-- Insert ERP line plans
  ('ERP Starter', 'erp-starter', 'CRM e gestão básica para corretores individuais', 79.90, 799.00, 30, 1, 100, false, false, false,
   '{"line":"erp","basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":0,"ai_art_limit":0,"ai_text_limit":0,"ai_landing_limit":0,"whatsapp":false,"meta_ads":false,"rd_station":false,"xml_feed":false,"automations_limit":0,"reports":false,"contracts_ai":false,"imobzi_import":false,"max_photos":100,"financial":false}'::jsonb,
   10, true),

  ('ERP Profissional', 'erp-profissional', 'Gestão completa com financeiro, WhatsApp e IA', 179.90, 1799.00, 100, 5, 500, false, false, false,
   '{"line":"erp","basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":20,"ai_art_limit":0,"ai_text_limit":20,"ai_landing_limit":0,"whatsapp":true,"meta_ads":false,"rd_station":false,"xml_feed":false,"automations_limit":0,"reports":true,"contracts_ai":false,"imobzi_import":true,"max_photos":500,"financial":true}'::jsonb,
   11, true),

  ('ERP Business', 'erp-business', 'Integracões avançadas, automações e IA completa', 297.00, 2970.00, 300, 15, 2000, false, false, false,
   '{"line":"erp","basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":50,"ai_art_limit":10,"ai_text_limit":50,"ai_landing_limit":10,"whatsapp":true,"meta_ads":true,"rd_station":true,"xml_feed":true,"automations_limit":5,"reports":true,"contracts_ai":true,"imobzi_import":true,"max_photos":2000,"financial":true,"pdf_extraction":true}'::jsonb,
   12, true),

  ('ERP Enterprise', 'erp-enterprise', 'Tudo ilimitado com white label e suporte prioritário', 497.00, 4970.00, null, null, null, false, true, true,
   '{"line":"erp","basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":200,"ai_art_limit":50,"ai_text_limit":200,"ai_landing_limit":50,"whatsapp":true,"meta_ads":true,"rd_station":true,"xml_feed":true,"automations_limit":null,"reports":true,"contracts_ai":true,"imobzi_import":true,"max_photos":null,"financial":true,"pdf_extraction":true,"white_label":true,"api_access":true,"audit_log":true}'::jsonb,
   13, true),

-- Insert Combo plans
  ('Combo Corretor', 'combo-corretor', 'Corretor MP + ERP Starter com 20% de desconto', 99.90, 999.00, 30, 1, 100, true, false, false,
   '{"line":"combo","marketplace":{"can_publish":true,"max_published":10,"show_contact":true,"ai_art_limit":0,"ai_text_limit":0,"ai_landing_limit":1,"broker_profile":true,"receive_leads":true},"erp":{"basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":0,"max_photos":100}}'::jsonb,
   20, true),

  ('Combo Profissional', 'combo-profissional', 'Corretor Plus + ERP Profissional com 20% de desconto', 219.90, 2199.00, 100, 5, 500, true, false, false,
   '{"line":"combo","marketplace":{"can_publish":true,"max_published":50,"show_contact":true,"ai_art_limit":5,"ai_text_limit":5,"ai_landing_limit":5,"highlight_results":true,"broker_profile":true,"receive_leads":true,"view_stats":true},"erp":{"basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":20,"whatsapp":true,"reports":true,"imobzi_import":true,"max_photos":500,"financial":true}}'::jsonb,
   21, true),

  ('Combo Business', 'combo-business', 'Agência MP + ERP Business com 20% de desconto', 357.00, 3570.00, 300, 15, 2000, true, true, false,
   '{"line":"combo","marketplace":{"can_publish":true,"max_published":null,"show_contact":true,"ai_art_limit":30,"ai_text_limit":30,"ai_landing_limit":10,"highlight_results":true,"partnerships":true,"broker_profile":true,"receive_leads":true,"view_stats":true,"verified_badge":true,"priority_results":true},"erp":{"basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":50,"ai_art_limit":10,"whatsapp":true,"meta_ads":true,"rd_station":true,"xml_feed":true,"automations_limit":5,"reports":true,"contracts_ai":true,"imobzi_import":true,"max_photos":2000,"financial":true,"pdf_extraction":true}}'::jsonb,
   22, true),

  ('Combo Enterprise', 'combo-enterprise', 'Agência MP + ERP Enterprise com 20% de desconto', 497.00, 4970.00, null, null, null, true, true, true,
   '{"line":"combo","marketplace":{"can_publish":true,"max_published":null,"show_contact":true,"ai_art_limit":30,"ai_text_limit":30,"ai_landing_limit":10,"highlight_results":true,"partnerships":true,"broker_profile":true,"receive_leads":true,"view_stats":true,"verified_badge":true,"priority_results":true},"erp":{"basic_crm":true,"dashboard":true,"agenda":true,"ai_monthly_limit":200,"ai_art_limit":50,"ai_text_limit":200,"ai_landing_limit":50,"whatsapp":true,"meta_ads":true,"rd_station":true,"xml_feed":true,"automations_limit":null,"reports":true,"contracts_ai":true,"imobzi_import":true,"max_photos":null,"financial":true,"pdf_extraction":true,"white_label":true,"api_access":true,"audit_log":true}}'::jsonb,
   23, true);
