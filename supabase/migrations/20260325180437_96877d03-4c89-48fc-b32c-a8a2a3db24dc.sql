-- Update Correspondente Bancário plan: new limits and feature flags
UPDATE subscription_plans
SET
  max_own_properties = 250,
  max_leads = -1,
  max_users = 3,
  marketplace_access = false,
  features = jsonb_build_object(
    'line', 'erp',
    'basic_crm', true,
    -- Financial: full access
    'has_financial', true,
    'has_contracts', true,
    'has_commissions', true,
    'has_owners', true,
    'has_import', true,
    'has_reports', true,
    'has_audit_log', false,
    -- Financing specific
    'financing_simulator', true,
    'financing_pipeline', true,
    'financing_docs_checklist', true,
    'contracts_ai', true,
    -- Limits
    'max_own_properties', 250,
    'max_leads', -1,
    'max_users', 3,
    'max_storage_mb', 2048,
    'max_marketplace_properties', 0,
    'max_images_per_property', 5,
    -- AI: limited (no art/video generation)
    'ai_credits_limit', 50,
    'ai_art_limit', 0,
    'ai_landing_limit', 0,
    'ai_video_limit', 0,
    'has_pdf_extract', true,
    'has_contract_ai', true,
    'has_photo_analysis', false,
    -- Marketing: only RD Station and Meta Ads
    'has_meta_ads', true,
    'has_rd_station', true,
    'has_xml_feed', false,
    'has_landing_pages', false,
    -- Marketplace: blocked
    'has_marketplace_publish', false,
    'has_marketplace_contact', false,
    'has_partnerships', false,
    -- WhatsApp / Automations: blocked
    'has_whatsapp', false,
    'has_automations', false,
    'automations_limit', 0,
    'has_push_notifications', false,
    'has_email_automation', false,
    -- Extras
    'priority_support', false,
    'support_level', 'email',
    'extra_user_price', 1990
  )
WHERE slug = 'correspondente';
